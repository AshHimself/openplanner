import type { PlannerState } from "@/types";

// ── a2ui component types ───────────────────────────────────────────────────

export interface A2UIText    { type: "text";   content: string }
export interface A2UIAlert   { type: "alert";  variant: "info"|"warning"|"success"|"error"; title?: string; body: string }
export interface A2UITable   { type: "table";  title?: string; columns: string[]; rows: string[][] }
export interface A2UICard    { type: "card";   label: string; value: string; subtext?: string }
export interface A2UIList    { type: "list";   title?: string; items: string[] }
export interface A2UIAction  { type: "action"; label: string; detail: string }

export interface A2UIFormField {
  name: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "color";
  value?: string | number;
  placeholder?: string;
  options?: { label: string; value: string }[];
}
export interface A2UIForm {
  type: "form";
  title?: string;
  tool: string;
  submitLabel?: string;
  fields: A2UIFormField[];
}

export type A2UIComponent = A2UIText | A2UIAlert | A2UITable | A2UICard | A2UIList | A2UIAction | A2UIForm;
export interface A2UIResponse { components: A2UIComponent[] }

// ── tool handler types ─────────────────────────────────────────────────────

export type ToolHandler = (input: Record<string, unknown>) => unknown;
export type ToolHandlers = Record<string, ToolHandler>;

// ── Anthropic wire types ───────────────────────────────────────────────────

interface TextBlock       { type: "text";        text: string }
interface ToolUseBlock    { type: "tool_use";    id: string; name: string; input: Record<string, unknown> }
interface ToolResultBlock { type: "tool_result"; tool_use_id: string; content: string }
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}
interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: string;
  error?: { message?: string };
}

// ── tool definitions (used only when agent calls tool directly) ────────────

const TOOLS = [
  {
    name: "create_project",
    description:
      "Creates a new project in the portfolio. " +
      "Only call this if you are NOT returning a form component. " +
      "Prefer the form component approach so the user can review fields first.",
    input_schema: {
      type: "object",
      properties: {
        name:      { type: "string" },
        code:      { type: "string" },
        status:    { type: "string", enum: ["Planning","Active","On Hold","Completed"] },
        priority:  { type: "number", enum: [1,2,3] },
        color:     { type: "string" },
        startDate: { type: "string" },
        endDate:   { type: "string" },
        manager:   { type: "string" },
        budget:    { type: "number" },
        tags:      { type: "array", items: { type: "string" } },
      },
      required: ["name","code","status","priority","color","startDate","endDate","manager"],
    },
  },
];

// ── form schema Claude must follow for create_project ─────────────────────

const CREATE_PROJECT_FORM_EXAMPLE = `{
  "type": "form",
  "title": "New project",
  "tool": "create_project",
  "submitLabel": "Create project",
  "fields": [
    { "name": "name",      "label": "Name",      "type": "text",   "value": "<inferred name>" },
    { "name": "code",      "label": "Code",      "type": "text",   "value": "<e.g. MOB-003>" },
    { "name": "status",    "label": "Status",    "type": "select", "value": "Planning",
      "options": [{"label":"Planning","value":"Planning"},{"label":"Active","value":"Active"},{"label":"On Hold","value":"On Hold"},{"label":"Completed","value":"Completed"}] },
    { "name": "priority",  "label": "Priority",  "type": "select", "value": "2",
      "options": [{"label":"P1 — Critical","value":"1"},{"label":"P2 — High","value":"2"},{"label":"P3 — Normal","value":"3"}] },
    { "name": "manager",   "label": "Manager",   "type": "text",   "value": "<inferred or empty>" },
    { "name": "startDate", "label": "Start date","type": "date",   "value": "<YYYY-MM-DD near today>" },
    { "name": "endDate",   "label": "End date",  "type": "date",   "value": "<YYYY-MM-DD ~12 weeks later>" },
    { "name": "budget",    "label": "Budget ($)","type": "number", "value": "" },
    { "name": "tags",      "label": "Tags (comma-separated)", "type": "text", "value": "<inferred tags>" },
    { "name": "color",     "label": "Color",     "type": "color",  "value": "#1d4ed8" }
  ]
}`;

// ── system prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(state: PlannerState): string {
  return `You are a planning assistant embedded in OpenPlanner, a resource capacity planning tool.
You have full read access to the portfolio state and can help create projects.

RESPONSE FORMAT
Respond ONLY with valid JSON — no markdown fences, no prose outside the JSON.

Schema (use any combination of these component types):
{
  "components": [
    { "type": "text",   "content": "string" },
    { "type": "alert",  "variant": "info|warning|success|error", "title": "optional", "body": "string" },
    { "type": "table",  "title": "optional", "columns": ["Col1"], "rows": [["val"]] },
    { "type": "card",   "label": "Metric", "value": "42", "subtext": "optional" },
    { "type": "list",   "title": "optional", "items": ["item"] },
    { "type": "action", "label": "What was done", "detail": "Confirmation of the change" },
    ${CREATE_PROJECT_FORM_EXAMPLE}
  ]
}

CREATION RULE — IMPORTANT
When the user asks to CREATE a project, you MUST:
1. Add a brief "text" component: one sentence like "Here's a new project based on what you described — review the details and click Create:"
2. Add a "form" component using EXACTLY the schema above, with ALL fields pre-filled using your best inferences
3. Do NOT call the create_project tool — the form handles submission
4. Do NOT ask clarifying questions before showing the form — infer everything and pre-fill it

GUIDELINES FOR OTHER QUESTIONS
- Lead with a "text" component that directly answers the question.
- Use "alert" variant="warning" or "error" for problems.
- Use "table" for comparing multiple items.
- Use "card" for a single key metric.
- Use "list" for recommendations.
- Keep values concise — renders in a narrow chat panel.
- Hours in h/wk. Costs in USD.

PORTFOLIO STATE
${JSON.stringify(state, null, 2)}`;
}

// ── core Anthropic call ────────────────────────────────────────────────────

async function callAnthropic(
  messages: AnthropicMessage[],
  systemPrompt: string,
  apiKey: string,
  withTools: boolean
): Promise<AnthropicResponse> {
  const body: Record<string, unknown> = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  };
  if (withTools) body.tools = TOOLS;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) throw new Error(data.error?.message ?? `API error ${res.status}`);
  return data;
}

function parseA2UI(raw: string): A2UIResponse {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(clean) as A2UIResponse;
  } catch {
    return { components: [{ type: "text", content: clean }] };
  }
}

// ── public API ─────────────────────────────────────────────────────────────

export interface ChatMessage { role: "user" | "assistant"; content: string }

export async function askAgent(
  message: string,
  state: PlannerState,
  apiKey: string,
  history: ChatMessage[],
  toolHandlers: ToolHandlers = {}
): Promise<A2UIResponse> {
  const systemPrompt = buildSystemPrompt(state);
  const hasTools = Object.keys(toolHandlers).length > 0;

  let messages: AnthropicMessage[] = [
    ...history.map((m): AnthropicMessage => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  for (let round = 0; round < 5; round++) {
    const response = await callAnthropic(messages, systemPrompt, apiKey, hasTools);

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((b): b is TextBlock => b.type === "text");
      return parseA2UI(textBlock?.text ?? "{}");
    }

    // Execute tool calls and continue
    const toolResultBlocks: ToolResultBlock[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const handler = toolHandlers[block.name];
      let result: unknown;
      try {
        result = handler ? handler(block.input) : { error: `Unknown tool: ${block.name}` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool failed" };
      }
      toolResultBlocks.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }

    messages = [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user",      content: toolResultBlocks },
    ];
  }

  return { components: [{ type: "text", content: "Could not complete the request. Please try again." }] };
}
