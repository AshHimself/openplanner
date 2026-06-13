"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Settings, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    const variance =
      p.budget
        ? forecast > p.budget
          ? `over by ${formatCurrency(forecast - p.budget)}`
          : `under by ${formatCurrency(p.budget - forecast)}`
        : "";
    const staffedThisWeek = allocations
      .filter((a) => a.projectId === p.id)
      .reduce((s, a) => s + hoursInWeek(a, thisWeek), 0);
    return `- ${p.name} (${p.code}) | ${p.status} | P${p.priority} | Manager: ${p.manager || "none"} | ${p.startDate}→${p.endDate} | Budget: ${budget} | Forecast: ${fc}${variance ? ` | ${variance}` : ""} | Staffed this week: ${staffedThisWeek}h`;
  });

  const resourceLines = resources.map((r) => {
    const load = allocations
      .filter((a) => a.resourceId === r.id)
      .reduce((s, a) => s + hoursInWeek(a, thisWeek), 0);
    const util = r.capacity > 0 ? Math.round((load / r.capacity) * 100) : 0;
    const projects12wk = getWeeks(12).map((w) =>
      allocations
        .filter((a) => a.resourceId === r.id)
        .reduce((s, a) => s + hoursInWeek(a, w), 0)
    );
    const avgUtil12 = r.capacity > 0
      ? Math.round(projects12wk.reduce((s, l) => s + l, 0) / (r.capacity * 12) * 100)
      : 0;
    const myAllocs = allocations.filter((a) => a.resourceId === r.id);
    const lastEnd = myAllocs.reduce<Date | null>((max, a) => {
      const e = parseLocalDate(a.endDate);
      return !max || e > max ? e : max;
    }, null);
    const freeFom = lastEnd ? addWeeks(startOfWeek(lastEnd), 1) : null;
    const freeStr = freeFom && freeFom > thisWeek
      ? `free from ${freeFom.toISOString().slice(0, 10)}`
      : "available now";
    return `- ${r.name} | ${r.role} | ${r.team} team | ${r.capacity}h/wk | ${r.dayRate ? formatCurrency(r.dayRate) + "/day" : "no rate"} | This week: ${load}h (${util}%) | 12-wk avg: ${avgUtil12}% | ${freeStr}`;
  });

  const allocLines = allocations.map((a) => {
    const p = projects.find((x) => x.id === a.projectId);
    const r = resources.find((x) => x.id === a.resourceId);
    return `- ${r?.name ?? a.resourceId} → ${p?.name ?? a.projectId}: ${a.hoursPerWeek}h/wk (${a.startDate}→${a.endDate})`;
  });

  return [
    `You are an expert resource planner AI assistant embedded in OpenPlanner.`,
    `Today is ${today}.`,
    ``,
    `PROJECTS (${projects.length}):`,
    ...projectLines,
    ``,
    `RESOURCES (${resources.length}):`,
    ...resourceLines,
    ``,
    `ALLOCATIONS (${allocations.length}):`,
    ...allocLines,
    ``,
    `Answer questions about team availability, project health, budget, scheduling conflicts, and workload. Be concise and data-driven. Format numbers clearly. When suggesting changes, mention the specific projects/resources by name.`,
  ].join("\n");
}

const SUGGESTED = [
  "Who is overloaded right now?",
  "Which projects are over budget?",
  "When does Alice next have availability?",
  "Which projects have no one scheduled this week?",
  "What's the total forecast cost across all active projects?",
  "Who could I add to the Website Relaunch?",
];

export default function AiPage() {
  const { projects, resources, allocations, isLoading } = usePlanner();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem(KEY));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !apiKey) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

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
              ? { ...m, content: `Error: ${err?.error?.message ?? err?.error ?? "Unknown error"}` }
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
              const chunk = parsed.delta.text as string;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m
                )
              );
            }
          } catch {
            // skip malformed lines
          }
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clear() {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  }

  if (!apiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">AI assistant</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Ask questions about your team, projects, and schedule. Add your Anthropic API key in
            Settings to get started.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings">
            <Settings className="mr-1.5 h-4 w-4" />
            Go to Settings
          </Link>
        </Button>
      </div>
    );
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-lg font-semibold">AI assistant</h2>
          <p className="text-sm text-muted-foreground">
            Ask about team availability, budget health, or scheduling.
          </p>
        </div>
        {!empty && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
            Clear chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading planner data…</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Context loaded: {projects.length} projects · {resources.length} people ·{" "}
                  {allocations.length} allocations
                </p>
                <div className="flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content || (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t pt-3">
        {!isLoading && projects.length === 0 && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            No planner data found — seed some data first for better answers.
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about availability, budget, scheduling… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="resize-none text-sm"
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
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Using claude-haiku-4-5 · Key stored only in your browser
        </p>
      </div>
    </div>
  );
}
