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

**Caps.** 150 turns/user/month in KV, keyed by month so it resets without a
cron. A tuning session is 10–15 turns, so the cap is far past honest use and
bounds a single user's worst case at a few dollars rather than the whole $9
subscription. Verify `cache_read_input_tokens` is non-zero on the second turn
of a session — if it is zero, input cost roughly triples and something has
made the system prompt unstable.

## Adding the other four libraries

Write a `LibrarySpec` for it, add it to `SPECS`, and pass `agent={{…}}` from
that library's studio component the way
[beam.tsx](../../sites/home/src/studio/beam.tsx) does. Until then its Agent tab
says the controls aren't reachable, which is true, instead of pretending.
