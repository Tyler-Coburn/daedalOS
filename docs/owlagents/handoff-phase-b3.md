# Handoff — daedalOS command center, after Phase B2

For whoever picks this up next: another Claude session, a different AI, or a
person. Claude Design owns product and UX; this document is the engineering
state of the repository.

**Branch:** `feat/production-consolidation` · **PR:** Tyler-Coburn/daedalOS#1
(draft) · **Base:** `main` @ `0df82d75`

---

## 1. What you are inheriting

A working command center inside the real daedalOS shell. Sixteen applications
open as ordinary windows, driven by one registry, one environment authority, and
a domain layer where every operational change is a validated transition.

Read these three files before touching anything:

| File                                 | Why                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `docs/owlagents/architecture.md`     | How the layers fit together and _why_ each shape was chosen              |
| `docs/owlagents/repository-audit.md` | The constraints the repository imposes — read before proposing structure |
| `docs/owlagents/roadmap.md`          | What was deferred, and the seam each deferred item attaches to           |

## 2. The five rules that hold the design together

Break any of these and the phase's guarantees evaporate.

1. **UI never assigns a status.** Components call
   `owlagents/services/*`; the service validates state, version, permission and
   idempotency. Work-order buttons are _generated_ from
   `selectAllowedTransitions`, so an illegal move is never offered.
2. **Nothing reports success before it commits.** `useCommand` reaches
   `committed` only when the store's ledger contains the event the service
   returned. Never render success from a resolved promise.
3. **`owlagents/**`is React-free.**`getStaticPaths`imports the fixtures in
Node at build time.`**tests**/owlagents/architecture.spec.ts`enforces this
and the whole layering matrix — it is the real gate, because CI runs`yarn test`and does not run`yarn eslint`.
4. **`url` is the selection.** `openProcess`'s singleton branch is
   `setProcessSettings(pid, { url })` — it carries `url` and nothing else. A
   parallel selection field would go stale and outrank the deep link. Sources &
   Files is the documented exception: it composes the File Explorer, which reads
   `url` as a filesystem path, so its selection lives in `owlSelectedId`.
5. **Shell state and operational state never mix.** Window geometry, icon
   positions and theme belong to `SessionData`. Per-window view state lives on
   the process and dies with the window. No service reads either.

## 3. Environment setup

```bash
git clone https://github.com/Tyler-Coburn/daedalOS.git
cd daedalOS && git checkout feat/production-consolidation
```

- **Node 22.** CI pins it; `browserfs` (a git dependency) and `utif` are
  sensitive to the version.
- **Yarn Classic.** `corepack enable` or `npm i -g yarn@1`. **Never
  `npm install`** — npm ignores the `resolutions` field pinning
  `@emotion/is-prop-valid`, which styled-components 6 prop filtering needs.
- `npx playwright install` before running e2e.
- `yarn build:prebuild` before `tsc --noEmit` on a fresh clone: `public/.index/*`
  is generated, not committed.

Validation gate — all green on this branch:

```bash
yarn test && yarn eslint && yarn stylelint && npx tsc --noEmit && yarn build && yarn e2e
```

Plus `yarn unused-exports`, which is clean and worth keeping clean.

## 4. Where things live

```
owlagents/registry.json     single owner of the 16-app table
owlagents/domain/           types, state machines, vocabularies — no side effects
owlagents/adapters/         demo (default) + local/remote/supabase boundaries
owlagents/services/         the only writers
owlagents/selectors/        pure reads over an immutable snapshot
owlagents/store/            useSyncExternalStore plumbing; picks the adapter
contexts/owlagents/         the provider, mounted innermost in _app.tsx
components/apps/OwlAgents/  16 apps + shared primitives + hooks + theme.ts
```

To add an application: one entry in `owlagents/registry.json`, one component
under `components/apps/OwlAgents/<Id>/`, one spread entry in
`contexts/process/directory.ts`, then `node scripts/owlAgentsShortcuts.js`.
The registry test will tell you what you missed.

## 5. The recommended next phase

**Make the intake real.** One bounded piece, no new applications.

Today: dropping a file on Sources & Files runs the repository's own
`useFileDrop`, which knows nothing about domain objects. The intake stage
machine (`received → hashing → preserved → classifying → policy checked →
assigned → ready | failed`) and `sourceService.advanceIntake` both exist and are
tested — they are simply not connected.

The work:

1. Wrap the drop handler in `components/apps/OwlAgents/SourcesFiles` so a
   dropped file creates a `Source` in the store rather than only a file on the
   virtual filesystem.
2. Walk the stage machine, appending a ledger event per stage, so the operator
   watches it become authoritative rather than being told it already is.
3. Link the new `Source` to a project by the folder it landed in, and to a work
   order when one is open.
4. Put the local adapter behind it (`owlagents/adapters/local`) instead of the
   demo one — this is the first real exercise of that boundary.

Acceptance: drop a file, watch the stages advance in the Event Timeline, see the
source appear with `Raw source` authority and a hash, and see it referenced from
the work order that consumes it. A dropped file must never be authoritative on
arrival.

## 6. Other open items, in priority order

| Item                                    | Notes                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capability gating**                   | Every registry entry declares `requiredCapabilities` and the test asserts they exist, but nothing hides an application. There is one operator holding every scope. Decide whether B3 needs real scopes before wiring UI gating. |
| **Command palette over domain objects** | The repository's search is a build-time lunr index over the filesystem (`scripts/searchIndex.js`). Work orders and reviews are not in it.                                                                                       |
| **Start-menu presentation**             | Categories currently drive a folder tree (`OwlAgents/`, `OwlAgents/Diagnostics/`, `OwlAgents/Advanced/`). Flatter inline sections would mean changing the shared `StartMenu` component — a product call for Claude Design.      |
| **Supabase migrations**                 | Not written. The Lovable UI-shaped schema (`kpi_snapshots`, `attention_item_text`, `display_events`, `since_last_strings`) is **obsolete** — do not adopt it. Derive those values from the domain.                              |
| **Real integrations**                   | Ollama and the local filesystem first, against `IntegrationAdapter`. Every write must carry its approving policy decision and work-order id.                                                                                    |

## 7. Traps that cost time in Phase B2

- **`captureConsoleLogs()` throws on any un-allow-listed console message**, and
  Playwright's local server is `yarn dev`, where `removeConsole` does not apply.
  No `console.*` in OwlAgents code; `$`-prefixed transient props are mandatory;
  `getServerSnapshot` is mandatory or hydration warnings fail the suite.
- **e2e selects by DOM structure**, not `data-testid`. Adding a wrapper element
  under `main` or inside a window breaks the existing suite.
- **Playwright's `getByRole(name)` matches substrings.** A list row named
  "… Approved" will swallow a click intended for the "Approve" button. Use
  `exact: true` — `e2e/owlagents/functions.ts` already does.
- **Lint is strict**: alphabetical object keys and type members, no relative
  imports, `memo()` on every component, explicit return types, inline type
  imports, alphabetical CSS properties. Use `--fix`; never hand-order.
- **`output: "export"`** means dynamic routes must be enumerable. New
  deep-linkable object types need their ids added to `listDemoDeepLinkPaths()`.
- **`yarn dev` occasionally 500s** during concurrent route compilation, which
  reads as an e2e flake. Run the suite against the static export (`CI=1`) for a
  clean signal.

## 8. What must not be reopened

These were decided in B2 and are load-bearing:

- One canonical application. No second shell, no `src/` tree, no TanStack
  Router, no second window manager, no permanent sidebar.
- The 14-member work-order vocabulary (the state machine depends on `queued`,
  `artifact_ready`, `revision_required`, `cancel_requested`).
- `candidate → approved → staged → published`, operator-only, previous record
  preserved as superseded. Agents never publish.
- Progress is a named stage, never a percentage.
- A disconnected system never renders as healthy, and demo data is always
  labelled.
