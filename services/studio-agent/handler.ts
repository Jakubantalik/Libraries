/* Studio agent — POST /studio/chat.
 *
 * Belongs in the api.libraries.dev Worker, alongside the rest of the Pro
 * platform API. It is kept here so the route and the Studio client that
 * calls it can be read together; see README.md for how to mount it.
 *
 * Shape of a turn: the browser owns the controls, the server owns the model.
 * Rather than round-trip every tool call out to the browser and back, the
 * server runs the whole tool loop itself and validates each patch against
 * the same spec the knobs are built from. Applied patches are streamed to
 * the client as they happen, so the preview moves while the reply is still
 * being written. One HTTP request per user message.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SPECS, toolSchema, validate, type LibrarySpec } from "./spec";

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Per-user monthly turn counters. Any KV namespace will do. */
  STUDIO_USAGE: KVNamespace;
}

/** Supplied by the host Worker: resolves the .libraries.dev session cookie to
    a Pro user, or null. Kept as a parameter so this file has no dependency on
    the platform's session internals. */
export type ResolvePro = (request: Request) => Promise<{ userId: string; pro: boolean } | null>;

/* A tuning session is 10-15 turns. 150/month is far past any honest workload
   and caps a single user's worst case at a few dollars rather than the whole
   subscription. */
const MONTHLY_TURN_CAP = 150;

/* Ceiling on what the whole feature may spend in a calendar month, across
   every user. The per-user turn cap above bounds one abusive account; this
   bounds the bill if a thousand honest ones show up at once.
 *
 * This is a SOFT cap and deliberately the second line of defence. It is
 * enforced from a KV counter that is eventually consistent, so a burst of
 * concurrent requests can read a stale total and overshoot slightly, and it
 * cannot see spend from anything else sharing the API key. The hard limit is
 * the monthly spend limit set on the Anthropic Console for this workspace —
 * that one is enforced by Anthropic and cannot be overshot. Set both, and
 * keep the Console limit at or above this number so this one trips first and
 * gives users a real message instead of a 400. */
const MONTHLY_BUDGET_USD = 100;

/* claude-opus-5, USD per million tokens. Cache writes cost 1.25x input and
   reads 0.1x; the system prompt is the only cached block, so a read-heavy
   month sits far below the input line. */
const PRICE_PER_MTOK = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

function turnCostUsd(u: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}): number {
  return (
    (u.inputTokens * PRICE_PER_MTOK.input +
      u.outputTokens * PRICE_PER_MTOK.output +
      u.cacheReadTokens * PRICE_PER_MTOK.cacheRead +
      u.cacheWriteTokens * PRICE_PER_MTOK.cacheWrite) /
    1_000_000
  );
}
/* Only the recent transcript is resent. Tuning turns are near-independent —
   the current parameter values are sent fresh every turn regardless — so the
   older history buys little and grows input cost on every message. */
const HISTORY_TURNS = 8;

interface ClientMessage {
  role: "user" | "agent";
  text: string;
}

function sysPrompt(spec: LibrarySpec): string {
  const lines = Object.entries(spec.params).map(([key, p]) => {
    const range =
      p.kind === "number"
        ? `number ${p.min}–${p.max} (step ${p.step})`
        : p.kind === "enum"
          ? `one of ${p.values.join(" | ")}`
          : "true | false";
    return `- ${key} — ${range}. ${p.describe}${p.when ? ` Only applies while ${p.when}.` : ""}`;
  });

  return [
    `You are the tuning assistant inside the Libraries.dev Studio, a workbench where a designer tunes the ${spec.label} effect live.`,
    "",
    spec.about,
    "",
    "Parameters you can set:",
    ...lines,
    "",
    "How to work:",
    "- Call set_params to make the change. The preview updates the moment you do — this is the whole point of the tool, so use it rather than describing what the user could do by hand.",
    "- Send only the parameters you are actually changing. Never restate values you are leaving alone.",
    "- Mood words map to several parameters at once, and moving one alone usually under-delivers. 'Calmer' is longer duration plus lower strength and brightness; 'more premium' is lower saturation, narrower hue range and a slower duration; 'cooler' is a negative hue shift, often with the ocean palette. Make the whole move in one call.",
    "- Work from the current values given in the user's turn, relatively. 'A bit slower' from 2s is about 3s, not 6s.",
    "- If a request is genuinely outside these parameters (adding a new effect, changing the card's content), say so plainly in one sentence and do not call the tool.",
    "",
    "Then reply in one short sentence saying what you changed and why it serves what they asked. No preamble, no lists, no restating the parameter values — the panel already shows those.",
  ].join("\n");
}

/** The live parameter state, plus which props are currently inert. Sits in the
    user turn rather than the system prompt so the cached prefix stays stable. */
function stateNote(spec: LibrarySpec, params: Record<string, unknown>): string {
  const live = new Set(spec.relevant(params));
  const shown = Object.entries(params)
    .filter(([k]) => live.has(k))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  const inert = Object.keys(spec.params).filter((k) => !live.has(k));
  const inertNote = inert.length
    ? `\nInert with these settings, do not set: ${inert.join(", ")}.`
    : "";
  return `Current settings: ${shown}.${inertNote}`;
}

function sse(event: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function handleStudioChat(
  request: Request,
  env: Env,
  resolvePro: ResolvePro
): Promise<Response> {
  const session = await resolvePro(request);
  if (!session) return json({ error: "not_authenticated" }, 401);
  if (!session.pro) return json({ error: "pro_required" }, 403);

  let body: { library?: string; params?: Record<string, unknown>; messages?: ClientMessage[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const spec = SPECS[String(body.library ?? "")];
  if (!spec) return json({ error: "unknown_library" }, 400);

  const history = Array.isArray(body.messages) ? body.messages : [];
  const latest = history[history.length - 1];
  if (!latest || latest.role !== "user" || !latest.text.trim()) {
    return json({ error: "no_message" }, 400);
  }

  /* Both caps are keyed by month so they reset on their own without a cron. */
  const month = new Date().toISOString().slice(0, 7);
  const usageKey = `studio:${session.userId}:${month}`;
  const spendKey = `studio:spend:${month}`;

  const [usedRaw, spentRaw] = await Promise.all([
    env.STUDIO_USAGE.get(usageKey),
    env.STUDIO_USAGE.get(spendKey),
  ]);
  const used = Number(usedRaw ?? 0);
  const spent = Number(spentRaw ?? 0);

  if (used >= MONTHLY_TURN_CAP) return json({ error: "turn_cap_reached" }, 429);
  if (spent >= MONTHLY_BUDGET_USD) return json({ error: "budget_exhausted" }, 429);

  const params = body.params ?? {};
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const priorTurns = history.slice(-HISTORY_TURNS - 1, -1).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));

  const messages: Anthropic.MessageParam[] = [
    ...priorTurns,
    { role: "user", content: `${stateNote(spec, params)}\n\n${latest.text.trim()}` },
  ];

  const tools: Anthropic.Tool[] = [
    {
      name: "set_params",
      description: `Apply parameter changes to the live ${spec.label} preview. Send only the parameters you are changing.`,
      input_schema: toolSchema(spec) as Anthropic.Tool.InputSchema,
    },
  ];

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  /* The loop outlives the response object, so it runs detached and closes the
     stream itself. Any throw becomes a final error event rather than a dead
     connection the client has to time out on. */
  (async () => {
    /* Mirrors the browser's state as patches are applied, so validation of a
       later call in the same turn sees what the earlier one did — a turn that
       switches to `line` and then sets `spikes` must not have the spikes
       rejected as inert. */
    let liveParams = { ...params };
    let outputTokens = 0;
    let inputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    try {
      for (let hop = 0; hop < 4; hop++) {
        const stream = client.messages.stream({
          model: "claude-opus-5",
          max_tokens: 2000,
          thinking: { type: "adaptive" },
          /* Mapping a mood word onto known sliders is not hard reasoning, and
             low effort roughly halves the output tokens that dominate the
             per-turn cost here. Raise this only if quality measurement says to. */
          output_config: { effort: "low" },
          system: [
            {
              type: "text",
              text: sysPrompt(spec),
              cache_control: { type: "ephemeral" },
            },
          ],
          tools,
          messages,
        });

        stream.on("text", (delta) => {
          void writer.write(sse({ type: "text", text: delta }));
        });

        const message = await stream.finalMessage();
        inputTokens += message.usage.input_tokens;
        outputTokens += message.usage.output_tokens;
        cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
        cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;

        messages.push({ role: "assistant", content: message.content });

        if (message.stop_reason !== "tool_use") break;

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of message.content) {
          if (block.type !== "tool_use" || block.name !== "set_params") continue;

          const patch = block.input as Record<string, unknown>;
          const { applied, rejected } = validate(spec, liveParams, patch);

          if (Object.keys(applied).length) {
            liveParams = { ...liveParams, ...applied };
            await writer.write(sse({ type: "params", patch: applied }));
          }

          /* Tell the model exactly what landed. Silently swallowing a rejected
             prop would leave it believing a change it can see in no later
             state, and it would keep re-sending it. */
          const parts = [
            Object.keys(applied).length
              ? `Applied: ${Object.entries(applied).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}.`
              : "Nothing applied.",
          ];
          if (rejected.length) {
            parts.push(
              `Rejected: ${rejected.map((r) => `${r.key} (${r.reason})`).join("; ")}.`
            );
          }
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: parts.join(" "),
            is_error: rejected.length > 0 && Object.keys(applied).length === 0,
          });
        }

        if (!results.length) break;
        messages.push({ role: "user", content: results });
      }

      /* 40 days outlives the month each key names; the next month writes a
         fresh key, so no cleanup job is needed. Counters are advanced only
         once the turn has actually completed — a failed turn that billed
         nothing should not eat someone's allowance. */
      const cost = turnCostUsd({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });
      const expirationTtl = 60 * 60 * 24 * 40;
      await Promise.all([
        env.STUDIO_USAGE.put(usageKey, String(used + 1), { expirationTtl }),
        /* Read-modify-write on an eventually-consistent store: concurrent
           turns can lose an increment, so the recorded total runs slightly
           low under load. Acceptable for a backstop whose hard counterpart
           is the Console spend limit; it is not an accounting record. */
        env.STUDIO_USAGE.put(spendKey, (spent + cost).toFixed(4), { expirationTtl }),
      ]);

      await writer.write(
        sse({
          type: "done",
          usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd: cost },
          turnsRemaining: Math.max(0, MONTHLY_TURN_CAP - used - 1),
        })
      );
    } catch (err) {
      /* The upstream message can carry request ids, key states and other
         internals, so it goes to the log and never to the panel. In
         `wrangler dev` the log is the terminal running the Worker. */
      console.error("[studio-chat] turn failed", err);
      await writer.write(
        sse({ type: "error", message: "The agent hit an error. Try again in a moment." })
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
