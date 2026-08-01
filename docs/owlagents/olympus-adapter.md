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
origin. On the Olympus Express app, reads only:

```js
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "http://localhost:3000");
  next();
});
```

That is a change to the Olympus runtime, not to this repository, and it is the
operator's call. Until it lands, the badge reads `OFFLINE` and says exactly why
rather than leaving it to guesswork.

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
