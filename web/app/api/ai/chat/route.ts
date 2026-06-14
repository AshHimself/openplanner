import { auth } from "@/auth";
import type { NextRequest } from "next/server";

const CATALOG_ID = "https://a2ui.org/specification/v0_9/basic_catalog.json";

const A2UI_FORMAT = `
OUTPUT FORMAT — MANDATORY:
Respond with a JSON array of A2UI v0.9 messages wrapped in <a2ui> tags. No text outside the tags.

<a2ui>[
  {"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"${CATALOG_ID}"}},
  {"version":"v0.9","updateComponents":{"surfaceId":"main","components":[
    ...component definitions...
  ]}}
]</a2ui>

Component format (each component is a flat object in the "components" array):
  { "id": "<unique-id>", "component": "<TypeName>", ...props }

Available types and their props:
  Text         → "text": "plain string here", "variant": "h1"|"h2"|"h3"|"h4"|"h5"|"body"|"caption"
  Column       → "children": ["id1","id2",...]
  Row          → "children": ["id1","id2",...]
  List         → "children": ["id1","id2",...]
  Card         → "child": "child-id"
  Divider      → (no extra props)
  Button       → "child": "label-id", "action": {"event":{"name":"<action>","context":{...}}}
  ProjectChart → "projectId": "<project-id>"   (renders a live budget-health graphic for that project)

Rules:
- "component" is a plain STRING (the type name), NOT an object
- Text "text" must be a PLAIN STRING — never use {"literal":"..."} or any object wrapper
- NEVER put markdown syntax in text values — no ##, ####, **, *, _, >, -, etc.
  Use "variant" for hierarchy: h2 for section titles, h3 for item names, body/caption for details
- "children" is a FLAT ARRAY of id strings, NOT wrapped in {explicitList:[...]}
- "Card" takes ONE child id via "child" (singular)
- Every id must be unique within the components array
- The root component id must be "root"
- Use Column for vertical stacking, Card to highlight groups, List for bullet items

PROJECT DETAIL PATTERN:
When the user asks about a SPECIFIC project, render a Card containing a Column with:
  1. A Text (variant h3) with the project name
  2. A few Text rows of key facts (status, manager, dates, budget vs forecast, staffing)
  3. ONE ProjectChart for that project (the live budget-health graphic)
  4. A Button labelled "Open full details" whose action opens the project:
     {"id":"open-btn","component":"Button","child":"open-lbl","action":{"event":{"name":"open_project","context":{"projectId":"<the-project-id>"}}}}
Use the project's "id:" value (shown in the PROJECTS list) for ProjectChart.projectId and the action context.projectId.

Example — "Who is overloaded?":
<a2ui>[
  {"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"${CATALOG_ID}"}},
  {"version":"v0.9","updateComponents":{"surfaceId":"main","components":[
    {"id":"root","component":"Column","children":["title","list"]},
    {"id":"title","component":"Text","text":"Overloaded Resources","variant":"h2"},
    {"id":"list","component":"List","children":["c1"]},
    {"id":"c1","component":"Card","child":"c1-col"},
    {"id":"c1-col","component":"Column","children":["c1-name","c1-detail"]},
    {"id":"c1-name","component":"Text","text":"Alice Johnson","variant":"h3"},
    {"id":"c1-detail","component":"Text","text":"40h allocated · 100% of 40h/wk capacity","variant":"body"}
  ]}}
]</a2ui>

Example — "Tell me about the Website Relaunch project" (id web-001):
<a2ui>[
  {"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"${CATALOG_ID}"}},
  {"version":"v0.9","updateComponents":{"surfaceId":"main","components":[
    {"id":"root","component":"Card","child":"col"},
    {"id":"col","component":"Column","children":["name","status","dates","budget","chart","open-btn"]},
    {"id":"name","component":"Text","text":"Website Relaunch (WEB)","variant":"h3"},
    {"id":"status","component":"Text","text":"Active · P2 · Manager: Sarah Chen","variant":"body"},
    {"id":"dates","component":"Text","text":"May 1 → Aug 31, 2026","variant":"caption"},
    {"id":"budget","component":"Text","text":"Budget $120,000 · Forecast $98,000","variant":"body"},
    {"id":"chart","component":"ProjectChart","projectId":"web-001"},
    {"id":"open-btn","component":"Button","child":"open-lbl","action":{"event":{"name":"open_project","context":{"projectId":"web-001"}}}},
    {"id":"open-lbl","component":"Text","text":"Open full details"}
  ]}}
]</a2ui>
`.trim();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey?.startsWith("sk-ant-")) {
    return Response.json({ error: "Invalid or missing Anthropic API key" }, { status: 400 });
  }

  let body: { messages: { role: string; content: string }[]; context: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const systemPrompt = `${context}\n\n${A2UI_FORMAT}`;

  // Prefill the assistant's response with the opening tag so the model cannot
  // produce markdown — it can only continue the JSON array.
  const messagesWithPrefill = [
    ...messages,
    { role: "assistant", content: "<a2ui>[" },
  ];

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messagesWithPrefill,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status, headers: { "content-type": "application/json" } });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
