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
  Text     → "text": "plain string here", "variant": "h1"|"h2"|"h3"|"h4"|"h5"|"body"|"caption"
  Column   → "children": ["id1","id2",...]
  Row      → "children": ["id1","id2",...]
  List     → "children": ["id1","id2",...]
  Card     → "child": "child-id"
  Divider  → (no extra props)
  Button   → "child": "label-id", "action": {"name":"action-name"}

Rules:
- "component" is a plain STRING (the type name), NOT an object
- Text "text" must be a PLAIN STRING — never use {"literal":"..."} or any object wrapper
- "children" is a FLAT ARRAY of id strings, NOT wrapped in {explicitList:[...]}
- "Card" takes ONE child id via "child" (singular)
- Every id must be unique within the components array
- The root component id must be "root"
- Use Column for vertical stacking, Card to highlight groups, List for bullet items

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
      messages,
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
