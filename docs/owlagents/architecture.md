# The daedalOS command center

What Phase B2 actually landed, and why it is shaped this way.

## The four layers

Never merged, never renamed.

| Layer          | Owns                                                                                                                        | Applications                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **daedalOS**   | Desktop, windows, taskbar, Start menu, search, notifications                                                                | The shell itself, Mission Control, Projects                       |
| **OwlAgents**  | Work orders, context packs, policy decisions, execution scope, evidence, artifacts, reviews, approvals, costs, audit events | Work Orders, Review Queue, Sources & Files, Task Manager          |
| **Olympus**    | Model runtimes, providers, queues, services, incidents, rate limits, health                                                 | Olympus War Room, System Health, Models & Providers, Integrations |
| **Wovenstead** | Reviewed knowledge, canonical records, memory candidates, staged records, provenance, publication history                   | Wovenstead Staging                                                |

The operator manages projects, work orders, reviews, artifacts and decisions.
Agents are assignees with declared tool lists — never the unit of work.

## Layering

```
components/apps/OwlAgents/*        props are only { id }
        │ reads via selectors            │ writes via services
        ▼                                ▼
owlagents/selectors/  ──►  owlagents/domain/  ◄──  owlagents/services/
                                                          │
                                                          ▼
                          owlagents/adapters/{demo,local,remote,supabase}/
```

`owlagents/**` is React-free: no `react`, `styled-components`, `motion` or
`next`. That is not tidiness — `pages/[...deepLink].tsx` imports the fixtures
from `getStaticPaths`, which runs in Node at build time, so the module graph
must not touch the browser.

Enforced twice: `import/no-restricted-paths` zones in `.eslintrc.json`, and
`__tests__/owlagents/architecture.spec.ts`, which walks the tree and checks
every import specifier. The jest test is the one that counts, because CI runs
`yarn test` and does not run `yarn eslint`.

## Reading: selectors

Selectors are pure functions of an immutable snapshot, written as curried
factories (`selectWorkOrder(id)`) so a call site needs one honest `useCallback`
dependency.

Mission Control is entirely derived here. The six tiles are counted from work
orders, reviews, agents and services; the briefing counts ledger events since
the session began; attention items are generated on every read from the
conditions that produced them. Resolve a condition and the row is simply not
generated again — there is nothing to dismiss and nothing to clean up.

No display string is stored as authority anywhere.

## Writing: services

Services are the only writers. A component may _request_ a transition; it may
never assign a status.

```ts
workOrderService.requestTransition({
  id,
  to,
  expectedVersion,
  reason,
  idempotencyKey,
});
reviewService.submitDecision({
  id,
  decision,
  expectedVersion,
  artifactHash,
  idempotencyKey,
});
memoryService.approveCandidate({ id, expectedVersion });
memoryService.stageCandidate({ id, expectedVersion });
memoryService.publishCandidate({ id, expectedVersion }); // operator-only, requires staged
ledgerService.listEvents({ since, systems, limit });
missionControlService.getAttentionItems();
environmentService.getAuthority();
```

Every call returns `{ ok: true, data, eventId, phase: "committed" }` or
`{ ok: false, error: { code, message, action?, detail? } }`. Failure codes:
`stale_version`, `stale_state`, `permission_denied`, `duplicate_request`,
`blocked`, `cancelled`, `failed`, `not_found`.

The idempotency key defaults to object + intent + expected version. A
double-click is a duplicate; a retry after a genuine failure is not, because
the failed attempt recorded nothing.

### Nothing reports success before it commits

`useCommand` moves `requested → accepted → processing → committed`, and reaches
`committed` only once the store's ledger actually contains the event the
service returned. Components render success chrome from `phase === "committed"`
and nothing else.

## State machines

**Work orders** — 14 states. The handoff carries two conflicting vocabularies;
the 14-member set from `domain-model.md` wins, because the state machine
depends on `queued`, `artifact_ready`, `revision_required` and
`cancel_requested`.

```
draft → policy_pending → approved | queued | approval_required | rejected
approval_required → queued | rejected          queued → running
running → artifact_ready → review_pending      running → blocked
running → cancel_requested → cancelled         blocked → queued
review_pending → completed | revision_required → queued
rejected → draft
```

Cancellation is a two-step acknowledgement. A blocked order retries to
`queued`, never straight to `running`. The Work Orders detail panel generates
its buttons from `selectAllowedTransitions`, so an illegal move is never
offered, not merely rejected.

**Reviews** — a review is a decision about a _specific version of a specific
artifact_. It pins `expectedVersion`, `expectedArtifactVersion` and
`expectedArtifactHash`. If any of the three moves, the review goes stale:
approval is refused, the reasons are stated, the previous history is preserved,
and a new cycle is required.

**Memory** — `candidate → approved → staged → published`. Every skip is an
illegal transition, not a warning. Publishing requires an approved and staged
candidate, a version check, operator permission, preservation of the previous
canonical record (marked superseded, never deleted or overwritten), and a
ledger event before the UI reports success. Agents never publish.

## Environment authority

One value, five modes: `DEMO | LOCAL | CONNECTED | DEGRADED | OFFLINE`.

`environmentService.getAuthority()` is read by every application header, System
Health, Integrations and Mission Control. They cannot disagree because there is
nothing else to read. In DEMO mode every record is labelled, no integration
claims a successful sync, and a disconnected system always states why.

## Shell state versus operational state

| Shell state — may persist                                                                                                                     | Operational state — never persisted client-side as authority                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window positions and sizes, focus order, icon positions, taskbar pins, theme, wallpaper, file view and sort (`SessionData` → `/session.json`) | Project, work-order and review status, approvals, artifacts, evidence, memory candidates, publication, policies, costs, runtime state, integration authority, ledger events |

Per-window view state (selected object, tab, filter) lives on the **process**
via `ProcessArguments`, not in `SessionData`. It dies with the window, and no
service reads it — every service call takes its expected version from the store
snapshot — so operational authority cannot leak through view state.

## The registry

`owlagents/registry.json` is the single owner of all sixteen applications:
category, default and minimum size, icon, lane badge, singleton flag, required
capabilities and deep-link patterns.

- `contexts/process/directory.ts` spreads each entry and adds only the component.
- `scripts/owlAgentsShortcuts.js` generates the Start-menu and desktop `.url`
  shortcuts from the same JSON, wired into `build:prebuild`.
- Deep links resolve against it.

The Start menu is filesystem-driven in this repository — its entries are `.url`
files under `/Users/Public/Start Menu`. Rather than rebuild it, the shortcuts
are generated and committed (`yarn dev` does not run `build:prebuild`, and
Playwright's local web server is `yarn dev`), and
`__tests__/owlagents/startMenuShortcuts.spec.ts` fails if the files on disk stop
matching what the generator produces. That is what keeps the registry the
single owner.

## Deep links

```
route → intent → registry lookup → openProcess(pid, { url }) → app selects object
```

`/projects/:id` · `/work-orders/:id` · `/reviews/:id` · `/artifacts/:id` ·
`/sources/:id` · `/memory/:id`

`url` carries the object id because `openProcess`'s singleton branch re-targets
`url` and nothing else — so a link to an open application focuses it and swaps
the selection, leaving every other window alone. `ArtifactViewer` is
non-singleton, so each artifact gets its own pid and its own window.

`next.config.js` sets `output: "export"`, which cannot pre-render an unbounded
id space. So `pages/[...deepLink].tsx` statically renders every known object,
and `pages/404.tsx` renders the identical desktop and resolves the path
client-side. An unrecognised link opens Mission Control with "link not
recognised" rather than 404-ing the desktop.

In-app navigation uses raw `window.history.pushState`. `next/router` is never
used here: `router.push` would remount the page component and destroy all
process state. For the same reason `ObjectLink` renders a `<button>`, never an
`<a href>`.

## Sources & Files

The repository's `Navigation` and `FileManager` are composed unmodified —
history, address bar, icon and details views, sortable and resizable columns,
drag-and-drop intake, multi-select and keyboard shortcuts all come from the OS.

Authority, intake stage and hash live in an owned panel beside it rather than
as extra `FileManager` columns: `FileManager` derives its columns from file
stats, holds them in internal state that an effect resets, and has no knowledge
of domain objects. Extending the shared column union would have changed every
File Explorer in the OS.

Preserved sources live under `public/OwlAgents/Sources/<project>/<id>.md`, so
`scripts/fs2json.js` indexes them into the virtual filesystem automatically —
no new mount. `Source.path` is a projection of the domain object onto the
filesystem, and a fixture test asserts every path resolves.

Sources & Files is also the one application whose `url` is a filesystem path
rather than an object id, because it composes the File Explorer. Its selection
travels in `owlSelectedId` alone.

## The demo

`createDemoAdapter` returns typed fixtures and runs _real_ validation: an
illegal transition, a stale version, a missing permission or a duplicate
request fails exactly as it would against a live adapter. Nothing it returns is
authoritative, and `environment.isFixture` says so.

Motion is operator-driven. There is no timer: `scenarioService.run(...)` takes
`advance`, `simulateBlockage`, `simulateStaleReview`,
`simulateDeniedPermission` and `reset`, exposed in Mission Control and in the
Restricted Terminal. `advance` walks the vertical slice one legal step at a
time through the same reducer the UI uses.

**The vertical slice** (`PRJ-001`, Delphi Research):

```
SRC-0142 → PACK-0001 → WO-2026-0051 → PD-0051 → RUN-0051
        → ART-0031 → EV-0031, EV-0032 → REV-2026-0186 → MC-0036 → published record
```

`local`, `remote` and `supabase` adapters exist as boundaries only. They report
OFFLINE or DEGRADED and refuse writes with a reason rather than failing open.
Supabase may never own execution state, policy decisions, review approval,
filesystem permissions, runtime state, Wovenstead publication or canonical
project truth.

## What was reused, not rebuilt

`contexts/process` · `contexts/session` · `contexts/fileSystem` ·
`components/system/Window` and `RndWindow` · the taskbar and its entries, peek
and tray · the Start menu · the Run dialog · `components/system/Files` ·
the icon system · the theme.

The only edits to existing files are: three optional metadata fields on
`Process`, sixteen registry entries in `directory.ts`, one provider in
`_app.tsx`, `pages/index.tsx` delegating to `components/pages/Shell.tsx`, one
script in `build:prebuild`, and `.gitignore` allowances for the generated
shortcuts. `Shell.tsx` is a component boundary, not a wrapper element, so
`body>#__next>main` and every e2e selector beneath it are unchanged.
