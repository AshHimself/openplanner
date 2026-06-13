"use client";

import { useEffect, useRef, useState } from "react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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
    const fc = formatCurrency(forecast);
    const variance = p.budget
      ? forecast > p.budget
        ? `over by ${formatCurrency(forecast - p.budget)}`
        : `under by ${formatCurrency(p.budget - forecast)}`
      : "";
    const staffed = allocations
      .filter((a) => a.projectId === p.id)
      .reduce((s, a) => s + hoursInWeek(a, thisWeek), 0);
    return `- ${p.name} (${p.code}) | ${p.status} | P${p.priority} | Manager: ${p.manager || "none"} | ${p.startDate}→${p.endDate} | Budget: ${budget} | Forecast: ${fc}${variance ? ` | ${variance}` : ""} | Staffed this wk: ${staffed}h`;
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
    `You are an expert resource planning assistant embedded in OpenPlanner. Be concise and data-driven. Use markdown for structure — bold key names, use lists for multiple items. Today is ${today}.`,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem(KEY));
  }, []);

  // subscribe to open events from sidebar button
  useEffect(() => onOpenAiChat(() => { setOpen(true); setMinimised(false); }), []);

  useEffect(() => {
    if (!minimised) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, minimised]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !apiKey) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    setMinimised(false);

    const context = buildContext(projects, resources, allocations);
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ messages: history, context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `**Error:** ${err?.error?.message ?? err?.error ?? "Unknown error"}` }
              : m
          )
        );
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + parsed.delta.text } : m
                )
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: "Connection error. Please try again." } : m
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

  // FAB button when closed
  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimised(false); }}
        className="fixed bottom-6 right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
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
        minimised ? "h-14 w-72" : "h-[600px] w-[420px]"
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
        /* No key state */
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
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm bg-muted"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        m.content ? (
                          <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )
                      ) : (
                        m.content
                      )}
                    </div>
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
                ref={textareaRef}
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
              claude-haiku-4-5 · key in browser only
            </p>
          </div>
        </>
      )}
    </div>
  );
}
