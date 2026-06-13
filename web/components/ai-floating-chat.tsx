"use client";

import { useEffect, useRef, useState } from "react";
import { A2uiSurface, basicCatalog } from "@a2ui/react/v0_9";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Send, X, Minus, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { onOpenAiChat } from "@/lib/ai-chat-bus";
import {
  usePlanner,
  formatCurrency,
  projectForecast,
  hoursInWeek,
  startOfWeek,
  getWeeks,
  parseLocalDate,
  addWeeks,
} from "@/lib/planner";

const KEY = "openplanner_anthropic_key";

type MsgState = "buffering" | "a2ui" | "text";

interface Message {
  id: string;
  role: "user" | "assistant";
  state: MsgState;
  rawText: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a2uiSurface?: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseA2UIv9(raw: string): any | null {
  const tagged = raw.match(/<a2ui>([\s\S]*?)<\/a2ui>/);
  const src = (tagged ? tagged[1] : raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const tryProcess = (jsonStr: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(jsonStr); } catch { return null; }
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    try {
      const processor = new MessageProcessor([basicCatalog]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processor.processMessages(parsed as any);
      const surfaces = Array.from(processor.model.surfacesMap.values());
      return surfaces[0] ?? null;
    } catch { return null; }
  };

  // Strategy 1: as-is
  const r1 = tryProcess(src);
  if (r1) return r1;

  // Strategy 2: insert closing chars before the last ]} (fixes truncated last component)
  const lastEnd = src.lastIndexOf("]}");
  if (lastEnd !== -1) {
    for (let n = 1; n <= 5; n++) {
      const r = tryProcess(src.slice(0, lastEnd) + "}".repeat(n) + src.slice(lastEnd));
      if (r) return r;
    }
  }

  // Strategy 3: append closing sequences (handles truncated arrays)
  const trimmed = src.replace(/[,\s]+$/, "");
  for (const suffix of ["]", "}]", "}]}]", "}}]", "}}}]", "}}]}]"]) {
    const r = tryProcess(trimmed + suffix);
    if (r) return r;
  }

  return null;
}

function buildContext(
  projects: ReturnType<typeof usePlanner>["projects"],
  resources: ReturnType<typeof usePlanner>["resources"],
  allocations: ReturnType<typeof usePlanner>["allocations"]
): string {
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = startOfWeek(new Date());

  const projectLines = projects.map((p) => {
    const forecast = projectForecast(p.id, allocations, resources);
    const budget = p.budget ? formatCurrency(p.budget) : "no budget";
    const variance = p.budget
      ? forecast > p.budget
        ? `over by ${formatCurrency(forecast - p.budget)}`
        : `under by ${formatCurrency(p.budget - forecast)}`
      : "";
    const staffed = allocations
      .filter((a) => a.projectId === p.id)
      .reduce((s, a) => s + hoursInWeek(a, thisWeek), 0);
    return `- ${p.name} (${p.code}) | ${p.status} | P${p.priority} | Manager: ${p.manager || "none"} | ${p.startDate}→${p.endDate} | Budget: ${budget} | Forecast: ${formatCurrency(forecast)}${variance ? ` | ${variance}` : ""} | Staffed this wk: ${staffed}h`;
  });

  const resourceLines = resources.map((r) => {
    const load = allocations
      .filter((a) => a.resourceId === r.id)
      .reduce((s, a) => s + hoursInWeek(a, thisWeek), 0);
    const util = r.capacity > 0 ? Math.round((load / r.capacity) * 100) : 0;
    const avg12 = (() => {
      const loads = getWeeks(12).map((w) =>
        allocations.filter((a) => a.resourceId === r.id).reduce((s, a) => s + hoursInWeek(a, w), 0)
      );
      return r.capacity > 0
        ? Math.round((loads.reduce((s, l) => s + l, 0) / (r.capacity * 12)) * 100)
        : 0;
    })();
    const myAllocs = allocations.filter((a) => a.resourceId === r.id);
    const lastEnd = myAllocs.reduce<Date | null>((max, a) => {
      const e = parseLocalDate(a.endDate);
      return !max || e > max ? e : max;
    }, null);
    const freeDate = lastEnd ? addWeeks(startOfWeek(lastEnd), 1) : null;
    const freeStr =
      freeDate && freeDate > thisWeek
        ? `free from ${freeDate.toISOString().slice(0, 10)}`
        : "available now";
    return `- ${r.name} | ${r.role} | ${r.team} | ${r.capacity}h/wk | ${r.dayRate ? formatCurrency(r.dayRate) + "/day" : "no rate"} | This wk: ${load}h (${util}%) | 12-wk avg: ${avg12}% | ${freeStr}`;
  });

  const allocLines = allocations.map((a) => {
    const p = projects.find((x) => x.id === a.projectId);
    const r = resources.find((x) => x.id === a.resourceId);
    return `- ${r?.name ?? a.resourceId} → ${p?.name ?? a.projectId}: ${a.hoursPerWeek}h/wk (${a.startDate}→${a.endDate})`;
  });

  return [
    `You are an expert resource planning assistant embedded in OpenPlanner. Today is ${today}.`,
    ``,
    `PROJECTS (${projects.length}):`,
    ...projectLines,
    ``,
    `RESOURCES (${resources.length}):`,
    ...resourceLines,
    ``,
    `ALLOCATIONS (${allocations.length}):`,
    ...allocLines,
  ].join("\n");
}

const SUGGESTED = [
  "Who is overloaded right now?",
  "Which projects are over budget?",
  "Who has availability this week?",
  "Which projects have gaps in staffing?",
];

export function AiFloatingChat() {
  const { projects, resources, allocations, isLoading } = usePlanner();
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setApiKey(localStorage.getItem(KEY)); }, []);
  useEffect(() => onOpenAiChat(() => { setOpen(true); setMinimised(false); }), []);
  useEffect(() => {
    if (!minimised) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, minimised]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !apiKey) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", state: "text", rawText: content };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", state: "buffering", rawText: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    setMinimised(false);

    const context = buildContext(projects, resources, allocations);
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.rawText }));

    abortRef.current = new AbortController();
    let buffer = "";

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ messages: history, context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const errText = `Error: ${err?.error?.message ?? err?.error ?? "Unknown error"}`;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, state: "text", rawText: errText } : m)
        );
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              buffer += parsed.delta.text as string;
            }
          } catch { /* skip malformed SSE */ }
        }
      }

      // Stream complete — parse v0.9 A2UI messages, fall back to markdown
      const surface = parseA2UIv9(buffer);
      if (surface) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, state: "a2ui", rawText: buffer, a2uiSurface: surface } : m
          )
        );
      } else {
        const fallback = buffer.replace(/<\/?a2ui>/g, "").trim() || "No response.";
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, state: "text", rawText: fallback } : m)
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, state: "text", rawText: "Connection error. Please try again." } : m
        )
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function close() {
    if (streaming) abortRef.current?.abort();
    setOpen(false);
    setStreaming(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimised(false); }}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
        style={{ width: 52, height: 52 }}
        title="AI assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-200 ${
        minimised ? "h-14 w-72" : "h-[620px] w-[440px]"
      }`}
      style={{ maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 24px)" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b bg-muted/50 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="flex-1 text-sm font-semibold">AI assistant</span>
        {messages.length > 0 && !minimised && (
          <button
            onClick={() => setMessages([])}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => setMinimised((v) => !v)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={minimised ? "Expand" : "Minimise"}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={close}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {minimised ? null : !apiKey ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Add your Anthropic API key in Settings to enable the AI assistant.
          </p>
          <Button size="sm" asChild onClick={close}>
            <Link href="/settings">Go to Settings</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {isLoading
                    ? "Loading planner data…"
                    : `${projects.length} projects · ${resources.length} people loaded`}
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.role === "user" ? "U" : <Bot className="h-3 w-3" />}
                    </div>

                    {m.role === "user" ? (
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {m.rawText}
                      </div>
                    ) : m.state === "buffering" ? (
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Thinking…</span>
                      </div>
                    ) : m.state === "a2ui" && m.a2uiSurface ? (
                      <div className="max-w-[90%] min-w-0 rounded-2xl rounded-tl-sm bg-muted p-3 text-sm">
                        <A2uiSurface surface={m.a2uiSurface} />
                      </div>
                    ) : (
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                        <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:text-[11px]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.rawText}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t px-3 py-3">
            {!isLoading && projects.length === 0 && (
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                No planner data — seed some data for better answers.
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about availability, budget… (Enter to send)"
                rows={2}
                className="resize-none text-xs"
                disabled={streaming}
              />
              <Button
                onClick={() => send()}
                disabled={!input.trim() || streaming}
                size="icon"
                className="h-auto shrink-0 self-stretch"
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              claude-haiku-4-5 · a2ui v0.9 · key in browser only
            </p>
          </div>
        </>
      )}
    </div>
  );
}
