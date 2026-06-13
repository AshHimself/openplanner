import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { newId, usePlanner } from "@/store";
import type { Project } from "@/types";
import { askAgent, type A2UIResponse, type ChatMessage, type ToolHandlers } from "@/lib/ai";
import { A2UIRenderer } from "@/components/A2UIRenderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  a2ui?: A2UIResponse;
}

const SUGGESTIONS = [
  "Summarise the portfolio health right now.",
  "Who is overallocated in the next 4 weeks?",
  "Which projects are forecast over budget?",
  "When does Grace Lindqvist become available?",
  "How can I flatten load across the data team?",
];

export function AiChat() {
  const { projects, resources, allocations, settings, saveProject } = usePlanner();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  if (!settings.aiEnabled) return null;

  // Tool handlers — available to both direct tool-use loop and form submission
  const toolHandlers: ToolHandlers = {
    create_project: (input) => {
      // Tags may arrive as a comma-separated string (from form) or array (from tool use)
      const rawTags = input.tags;
      const tags = Array.isArray(rawTags)
        ? (rawTags as string[])
        : typeof rawTags === "string" && rawTags.trim()
        ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const project: Project = {
        id:        newId("p"),
        name:      String(input.name      ?? ""),
        code:      String(input.code      ?? ""),
        status:    (input.status as Project["status"]) ?? "Planning",
        priority:  (Number(input.priority) as 1 | 2 | 3) || 2,
        color:     String(input.color     ?? "#1d4ed8"),
        startDate: String(input.startDate ?? ""),
        endDate:   String(input.endDate   ?? ""),
        manager:   String(input.manager   ?? ""),
        budget:    input.budget ? Number(input.budget) : undefined,
        tags,
      };
      saveProject(project);
      return { success: true, project };
    },
  };

  function handleFormSubmit(tool: string, rawData: Record<string, unknown>) {
    const handler = toolHandlers[tool];
    if (!handler) return;

    try {
      const result = handler(rawData) as { project?: { name?: string; code?: string } };
      const name = result?.project?.name ?? "Project";
      const code = result?.project?.code ? ` (${result.project.code})` : "";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          a2ui: {
            components: [
              {
                type: "action",
                label: "Project created",
                detail: `"${name}"${code} has been added to your portfolio.`,
              },
              {
                type: "text",
                content:
                  "You can find it in Projects and Timeline. Allocate resources from the Capacity plan.",
              },
            ],
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function send(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");
    setError(null);

    if (!settings.aiApiKey) {
      setError("No API key set. Add your Anthropic key in Settings.");
      return;
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.role === "user" ? (m.text ?? "") : JSON.stringify(m.a2ui ?? {}),
      }));

      const a2ui = await askAgent(
        userText,
        { projects, resources, allocations },
        settings.aiApiKey,
        history,
        toolHandlers
      );

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", a2ui },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        title="AI planning assistant"
        className="fixed bottom-6 right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-3.5 shadow-lg ring-2 ring-primary/20 transition-transform hover:scale-105 active:scale-95"
      >
        <Sparkles className="h-5 w-5 text-primary-foreground" />
      </button>

      {/* Chat sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4" />
              Planning Assistant
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                a2ui
              </span>
            </SheetTitle>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="py-6 text-center">
                  <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="mb-4 text-sm text-muted-foreground">
                    Ask me anything about your portfolio.
                  </p>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="block w-full rounded-md border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl rounded-tl-sm border bg-muted/40 px-3.5 py-2.5">
                      {m.a2ui && (
                        <A2UIRenderer
                          response={m.a2ui}
                          onFormSubmit={handleFormSubmit}
                        />
                      )}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
                placeholder="Ask about your portfolio…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={() => send()}
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
