import { auth } from "@/auth";
import type { NextRequest } from "next/server";

const SYSTEM = `
You are a resource-planning advisor for a professional-services firm. You receive a capacity-forecast summary with:
  - "proposedMoves": people the engine already plans to move onto projects as they roll off (resource, role, project, startsWeek).
  - "bench": named people with spare, UNASSIGNED capacity (resource, role, freeFromWeek, spareFte).
  - "gaps": role shortfalls per project (project, role, shortfallFte, fromWeek→toWeek, noResourcesOfRole).
  - "rolesWithNoResources": roles the firm has nobody in.

Produce a concrete, actionable staffing plan by calling submit_plan. One action per concrete decision a planner must make. Be specific — reference real names, projects, roles and dates from the data. Prefer assigning NAMED bench people when their role and free date fit a gap. When noResourcesOfRole is true, the action MUST be "hire". Do not invent people or numbers that are not in the summary.
`.trim();

const PLAN_TOOL = {
  name: "submit_plan",
  description: "Return the staffing recommendations as structured actions.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two sentences summarising the plan." },
      actions: {
        type: "array",
        description: "The concrete actions a planner should take, most urgent first.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["reassign", "hire", "delay", "upskill", "monitor"],
              description: "reassign = move an existing person; hire = recruit/contract; delay = push project dates; upskill = borrow/train adjacent role; monitor = watch, no action yet.",
            },
            project: { type: "string", description: "The project this action affects (name from the data)." },
            role: { type: "string", description: "The role involved." },
            resource: { type: "string", description: "The named person to move (reassign only). Omit otherwise." },
            timing: { type: "string", description: "When it should happen, e.g. 'week of 2026-06-15'." },
            urgency: { type: "string", enum: ["high", "medium", "low"] },
            detail: { type: "string", description: "Short rationale / instruction." },
          },
          required: ["type", "project", "role", "detail", "urgency"],
        },
      },
    },
    required: ["summary", "actions"],
  },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey?.startsWith("sk-ant-")) {
    return Response.json({ error: "Invalid or missing Anthropic API key" }, { status: 400 });
  }

  let body: { summary: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.summary) return Response.json({ error: "summary required" }, { status: 400 });

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: SYSTEM,
      tools: [PLAN_TOOL],
      tool_choice: { type: "tool", name: "submit_plan" },
      messages: [
        { role: "user", content: `Capacity-forecast summary (JSON):\n${JSON.stringify(body.summary)}` },
      ],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status, headers: { "content-type": "application/json" } });
  }

  const data = await upstream.json();
  const toolUse = Array.isArray(data.content)
    ? data.content.find((b: { type: string }) => b.type === "tool_use")
    : null;

  if (!toolUse?.input) {
    return Response.json({ error: "Model did not return a structured plan." }, { status: 502 });
  }

  return Response.json({ plan: toolUse.input });
}
