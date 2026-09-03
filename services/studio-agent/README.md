# Studio agent — `POST /studio/chat`

The Agent tab in the Studio ([sites/home/src/studio/controls.tsx](../../sites/home/src/studio/controls.tsx))
tunes a library by describing the change in words. This directory holds the
server half of that: the route, the parameter spec it validates against, and
the system prompt built from that spec.

It is **not** wired into a build here. `sites/home` deploys to GitHub Pages as
static files and cannot host a route; the Pro platform API is the Cloudflare
Worker at `api.libraries.dev` (`localhost:8787` in dev), which already owns the
`.libraries.dev` session cookie this route authenticates with. These files are
kept in this repo so the route and the client that calls it can be read and
changed together.

## Mounting it in the API Worker

1. Copy `spec.ts` and `handler.ts` into the Worker repo.
2. Add the SDK: `npm i @anthropic-ai/sdk` (it runs on Workers unchanged).
3. Add the secret and a KV namespace:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "STUDIO_USAGE"
id = "<namespace id>"
```

   Optionally, for prompt analytics:

```toml
[[analytics_engine_datasets]]
binding = "STUDIO_ANALYTICS"
dataset = "studio_agent_prompts"
```

4. Route it, passing the Worker's own session resolver:

```ts
if (request.method === "POST" && url.pathname === "/studio/chat") {
  return handleStudioChat(request, env, async (req) => {
    const session = await resolveSession(req);      // the Worker's existing one
    return session ? { userId: session.userId, pro: session.pro } : null;
  });
}
```

The route needs the same CORS treatment as the rest of the API — the Studio
calls it from `libraries.dev` with `credentials: "include"`, so
`Access-Control-Allow-Credentials: true` and an explicit origin, not `*`.

## How a turn works

One HTTP request per user message. The browser owns the controls, the server
owns the model, and the server runs the tool loop rather than round-tripping
each tool call out to the browser and back.

```
client  ──POST {library, params, messages}──>  Worker
                                                 │  messages.stream(tools: set_params)
        <──  data: {"type":"params", patch}  ────┤  validated against spec, applied
        <──  data: {"type":"text",   text}   ────┤  prose deltas
        <──  data: {"type":"done",   usage}  ────┘
```

Patches stream as they happen, so the preview moves while the sentence
explaining it is still arriving.

## The decisions worth knowing

**The spec is the single source of truth.** `spec.ts` generates the JSON
Schema, the prose in the system prompt, and the validation. Ranges mirror the
Studio's sliders exactly — a range that drifts wider than the knob lets the
agent set a value the user cannot then nudge by hand.

**The tool schema covers every parameter, always.** Narrowing it to what is
currently live would change the `tools` block, which sits at the very front of
the prompt-cache prefix, and would invalidate the cache every time the user
toggled `staticColors`. Which props are inert right now is instead told to the
model in the user turn, after the cache breakpoint, and enforced by
`validate()`.

**Rejections are reported back to the model,** not swallowed. A silently
dropped prop leaves it believing in a change no later state reflects, and it
re-sends it every turn.

**`effort: "low"`.** Mapping a mood word onto known sliders is not hard
reasoning, and output tokens dominate per-turn cost here. Raise it only if
measurement on real prompts says quality needs it.

**Caps, in two layers.** 150 turns/user/month bounds one abusive account;
`MONTHLY_BUDGET_USD = 100` bounds the total bill if a thousand honest ones
arrive at once. Both live in KV keyed by month, so they reset without a cron.

The $100 ceiling is a **soft** cap: KV is eventually consistent, so concurrent
turns can read a stale total and overshoot a little, and it cannot see spend
from anything else sharing the API key. **The hard limit is the monthly spend
limit on the Anthropic Console** for the workspace this key belongs to — that
one Anthropic enforces and it cannot be overshot. Set both. Keep the Console
limit at or a little above $100 so the soft cap trips first and users get a
real message instead of a failed request.

Verify `cache_read_input_tokens` is non-zero on the second turn of a session —
if it is zero, input cost roughly triples and something has made the system
prompt unstable.

## Adding the other four libraries

Write a `LibrarySpec` for it, add it to `SPECS`, and pass `agent={{…}}` from
that library's studio component the way
[beam.tsx](../../sites/home/src/studio/beam.tsx) does. Until then its Agent tab
says the controls aren't reachable, which is true, instead of pretending.

## Prompt analytics and the GDPR

With `STUDIO_ANALYTICS` bound, every turn writes one Workers Analytics Engine
point so we can see what people ask the agent for and where it falls short.
It is built to not be personal data, not merely to protect it:

- **No identifier.** No user id, session, IP, or hashed stand-in — nothing
  ties a point to a person or two points to each other. A pseudonymous id
  would still be personal data; no id is not.
- **Redacted text, 300 characters.** Emails, URLs, phone numbers, long digit
  runs, @handles and key-shaped tokens are replaced before the write. The
  agent's reply, the transcript and any rebuilt core are never written.
- **Opt-out, honoured first.** A `Sec-GPC: 1` or `DNT: 1` header, or
  `analytics: false` in the request (the panel's own opt-out, kept in the
  browser), skips the point entirely — the text is not even redacted.
- **Retention** is Analytics Engine's fixed window (three months at the time
  of writing). There is no per-person query because there is nothing to
  query by, which is also why there is no per-person delete.

Per point: library, outcome (`applied` / `declined` / `core` / `error`),
counts of applied and rejected parameters, whether a core was rebuilt and
whether the previous one had failed, latency and cost.

Say so in the privacy policy: "When you use the Studio agent, the text of
your request is stored for three months, anonymised and with personal details
removed, to improve the agent. You can turn this off in the Agent panel."
