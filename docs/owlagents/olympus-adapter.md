# The Olympus local adapter (Phase B3)

Read-only. daedalOS reads the Olympus runtime; it does not drive it.

## Why this adapter is small

Olympus already is the local authority. It owns a transition table, an append-only
event ledger, dedupe keys, per-task and per-day cost caps, and the three agents
(`hermes`, `athena`, `hephaestus`) over SQLite. Its `tasks` table already carries
`work_order_id`, `project_id`, `correlation_id`, `causation_id` and
`artifact_refs` — columns nothing in Olympus populates yet, because they were cut
for a governance layer that had not been built.

So this adapter does not reimplement execution. It maps one Olympus task onto one
`ExecutionRun` and derives the governing `WorkOrder` around it.

```
owlagents/adapters/local/
  types.ts    the Olympus wire shapes, transcribed from the live service
  client.ts   six reads in parallel, from one moment
  map.ts      pure mappers — no I/O, no dates, no randomness
  index.ts    polling, degradation, and the write refusal
```

`map.ts` is pure, so the whole mapping is tested without a network. The contract
it is tested against lives in
`__tests__/owlagents/adapters/fixtures/olympusContract.ts`.

## The one mapping that matters

Olympus's task status is _execution_ state. It says what the runtime did, not
whether anyone accepted it.

| Olympus               | `ExecutionRun` | `WorkOrder`                          |
| --------------------- | -------------- | ------------------------------------ |
| `pending`, `assigned` | `running`      | `queued`                             |
| `in_progress`         | `running`      | `running`                            |
| `done`                | `completed`    | `review_pending` — or `completed` \* |
| `failed`, `blocked`   | `blocked`      | `blocked`                            |
| `rejected`            | `cancelled`    | `rejected`                           |
| `cancelled`           | `cancelled`    | `cancelled`                          |

\* `completed` only when the ledger holds a `human_approved` event for that task.

`done` means the agent finished. Mapping it straight to `completed` would claim a
review that never happened. This is not an invented rule: Olympus's own
`POST /tasks/:id/approve` logs `human_approved` and deliberately leaves the status
alone, and `POST /tasks/:id/revision` opens a _new_ task carrying `revision_of`.
The ledger is where the answer lives, so the ledger is where the adapter looks.

## What stays empty

Sources, artifacts, evidence, reviews, memory candidates, policy rules and
Wovenstead records are all `{}`. Olympus does not model them, so the adapter does
not invent them. An empty Review Queue under a LOCAL badge is the truth.

No adapter borrows the demo fixtures — not this one, not `remote`, not
`supabase`. An authority that cannot be reached returns `createEmptySnapshot`.
Showing fabricated work orders under an OFFLINE badge is the exact confusion the
environment badge exists to prevent.

## Olympus must send CORS headers

**As of this writing it does not, and that is the one thing standing between this
adapter and a working command center.**

daedalOS runs on `localhost:3000`; Olympus answers on `127.0.0.1:3001`. Different
port means different origin, so the browser discards every response unless
Olympus sends `Access-Control-Allow-Origin`. `curl` succeeds and the browser
fails, which is why the mapping tested clean and the app still showed `OFFLINE`.

A static export cannot proxy around this — `output: "export"` has no server at
runtime. So it is fixed on the Olympus side, or by putting both behind one
origin.

### The patch

Do not reach for `app.use(cors())`. The ecosystem rule is that other
environments never _fire_ Olympus tasks — the operator is the bridge — and
Olympus exposes `POST /tasks` and `POST /drafts/:slug/publish`. A blanket CORS
policy would hand a browser on another port the ability to spend money.

Allow reads, refuse everything else, and the governance rule becomes true at the
wire instead of only in a document. In `olympus/api/server.js`, immediately after
`app.use(express.json({ limit: '2mb' }))`:

```js
// --- Read-only CORS: the operator-is-the-bridge rule, enforced at the wire ---
// GET/HEAD are allowed cross-origin and nothing else is. A cross-origin
// POST /tasks or POST /drafts/:slug/publish gets no CORS headers on its
// preflight, so the browser refuses to send it. Reading is a convenience;
// firing stays a decision the operator makes in Olympus.
//
// A request with no Origin header — the village dashboard on :3001, curl, the
// dispatcher — skips all of this and is unaffected.
const CORS_ORIGINS = (
  envLocal.OLYMPUS_CORS_ORIGINS ??
  process.env.OLYMPUS_CORS_ORIGINS ??
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const originAllowed = (origin) =>
  CORS_ORIGINS.length > 0
    ? CORS_ORIGINS.includes(origin)
    : LOOPBACK_ORIGIN.test(origin);

app.use((req, res, next) => {
  const { origin } = req.headers;
  if (!origin) return next();
  res.set("Vary", "Origin"); // never let a cache serve one origin's answer to another
  if (!originAllowed(origin)) return next();

  const method =
    req.method === "OPTIONS"
      ? String(req.headers["access-control-request-method"] ?? "")
      : req.method;
  if (method !== "GET" && method !== "HEAD") {
    return req.method === "OPTIONS" ? res.status(403).end() : next();
  }

  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "GET, HEAD");
  res.set("Access-Control-Max-Age", "600");
  // No Allow-Credentials: reads carry no cookies and no ambient authority.
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});
```

Loopback origins are allowed by default because Olympus already binds
`127.0.0.1` only, so nothing off this machine can reach it regardless. Set
`OLYMPUS_CORS_ORIGINS=https://…` in `olympus/.env` to pin an explicit list for
the VPS phase, where that assumption stops holding.

Verify it, from the daedalOS side:

```bash
curl -si http://127.0.0.1:3001/health -H "Origin: http://localhost:3000" | head -3
```

`Access-Control-Allow-Origin: http://localhost:3000` means reads work. Then
confirm writes are still refused:

```bash
curl -si -X OPTIONS http://127.0.0.1:3001/tasks -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" | head -1
```

`HTTP/1.1 403 Forbidden` is the correct answer.

Until this lands the badge reads `OFFLINE` and says exactly why, rather than
leaving it to guesswork.

## Degradation

`readOlympus` fails as a unit: if any of the six routes fails, the whole reading
fails. Half a snapshot would show real work as _missing_ rather than as
_unknown_, which is worse than showing nothing.

On failure the adapter keeps the last authoritative state and changes only the
badge — `DEGRADED` if it ever had a successful read this session, `OFFLINE` if it
never did. Polling runs only while something is subscribed.

## Writes

The badge reads `LOCAL`, but with `canWrite: false` and a stated reason.
`describeEnvironment("LOCAL")` allows writes — correct for a _writable_ local
authority — so this adapter overrides those two fields rather than letting the
badge promise something it will not do. The mode is unchanged: the reads really
are local and really are authoritative.

Every command is refused with a reason and an action:

> daedalOS is reading the Olympus runtime, not driving it. Nothing was committed.
> Perform this transition in Olympus. Enabling writes from here is a governance
> decision, not a missing feature.

The current ecosystem rule is that other environments never fire Olympus tasks —
the operator is the bridge. Changing that is Phase B4, and it is the operator's
call, not a gap to be quietly filled.

## Selecting it

Build-time, via environment variables — never `localStorage` or `/session.json`,
because browser state is not authoritative for operational decisions.

```bash
NEXT_PUBLIC_OWLAGENTS_ADAPTER=local
NEXT_PUBLIC_OLYMPUS_URL=http://127.0.0.1:3001   # optional; this is the default
```

An unrecognised value falls back to `demo`, which is labelled as fixtures
everywhere it appears. No `.env` file is committed.

## Re-recording the contract

The fixture pins field names, types and nullability. Its _content_ is synthetic —
real payloads and results are business material. To re-record after an Olympus
schema change, read `/health`, `/tasks`, `/events`, `/projects`, `/tasks/stats`
and `/tasks/limits`, transcribe the shape, and replace the content with
descriptive placeholders.

`OlympusLimits` members are all optional: Olympus owns that table and adds caps as
it learns what needs capping, and a new key must not break the read.
