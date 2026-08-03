# Where daedalOS sits in the ecosystem

Audited 2026-08-03 against `C:\Ai Workplace\ECOSYSTEM\ECOSYSTEM.md` (last verified
2026-07-22), `olympus\CLAUDE.md`, and the live runtime on `127.0.0.1:3001`.

## First, a naming collision worth resolving

`ECOSYSTEM.md` uses **OwlAgents** for a VS Code extension at
`C:\Users\binak\PixelAgents-Launch-Workspace\04_BUILDS\owl-agent-lab-vscode\` —
work orders, runtime profiles, prompt templates, review inboxes, artifact vault.

This repository also ships something called **OwlAgents**: sixteen command-center
applications inside daedalOS, with work orders, review queues and an artifact
viewer.

They are different software with the same name and overlapping vocabulary, and
`ECOSYSTEM.md` predates this one entirely — the map has no entry for the daedalOS
command center. Two things called OwlAgents, one of them undocumented, is how an
operator ends up approving something in the wrong window.

**This is a product decision, not an engineering one.** Either the daedalOS
command center is the operator UI for the OwlAgents layer and the VS Code
extension is being superseded, or they are separate tools and one needs a
different name. Until that is settled, treat every "OwlAgents" reference in
ecosystem documents as ambiguous.

## The layers, and which ones daedalOS may touch

The Phase B2 contract names four layers that are never merged:

| Layer          | Owns                          | daedalOS's relationship             |
| -------------- | ----------------------------- | ----------------------------------- |
| **daedalOS**   | the shell: windows, processes | this repository                     |
| **OwlAgents**  | controlled work               | the sixteen applications here       |
| **Olympus**    | the runtime                   | **read-only**, via `adapters/local` |
| **Wovenstead** | durable knowledge             | staging only; agents never publish  |

The ecosystem's own rule is stricter than any code: _"Olympus's dispatcher and
the OwlAgents extension do NOT call each other. The operator is the bridge."_
That is why `createLocalAdapter.applyCommand` refuses every command rather than
being wired up — see `olympus-adapter.md`.

## What actually works today

| Integration                 | State                 | Notes                                                       |
| --------------------------- | --------------------- | ----------------------------------------------------------- |
| Olympus → daedalOS (read)   | **built, blocked**    | Mapping verified against 12 live tasks; blocked on CORS     |
| daedalOS → Olympus (write)  | **refused by design** | B4 governance decision, not a gap                           |
| Demo fixtures               | **operational**       | The default; labelled DEMO everywhere it appears            |
| Wovenstead staging          | **operational**       | `candidate → approved → staged → published`, publish manual |
| Sources & Files intake      | **operational**       | Real SHA-256, real writes to the sources mount              |
| Trevs roster (111 agents)   | **not integrated**    | Lives in `~\.claude\agents`; no daedalOS surface reads it   |
| Pixel Agents                | **not integrated**    | VS Code panel; no shared state with this shell              |
| OwlAgents VS Code extension | **not integrated**    | See the naming collision above                              |
| Ollama / local models       | **not integrated**    | `ModelsProviders` renders fixtures, not a live probe        |
| n8n, ComfyUI, Drive, GitHub | **out of scope**      | Explicitly excluded by the Phase B2 brief                   |

## The one thing standing in the way

**Olympus sends no CORS headers.** daedalOS runs on `localhost:3000`, Olympus on
`127.0.0.1:3001`; the browser discards every response. `curl` succeeds, so this
is invisible from a terminal and total from a browser.

The verified patch is in `olympus-adapter.md` — it allows `GET`/`HEAD`
cross-origin and refuses everything else at preflight, which puts the
operator-is-the-bridge rule into the transport layer rather than leaving it as a
convention. Until it lands, the command center reads `OFFLINE` and says why.

## Integration plan, in the order the value arrives

**1. Land CORS.** One middleware in `olympus/api/server.js`. Unblocks everything
below. Nothing else in this list is worth doing first.

**2. Prove the read path against the live runtime.** Mission Control counting
real tasks, deep links resolving, System Health agreeing with the tray badge,
`DEGRADED` appearing when Olympus stops.

**3. Decide the OwlAgents name.** Cheap now, expensive after either tool grows
another dozen surfaces.

**4. Make the runtime tab real.** `OlympusWarRoom` and `SystemHealth` already
map from live data; `ModelsProviders` and `Integrations` still render fixtures.
An `IntegrationAdapter` probing Ollama on `127.0.0.1:11434` is the smallest real
one, and it is a read.

**5. Only then, B4 — the write path.** Whether daedalOS may fire Olympus tasks.
The seam is `applyCommand`; Olympus's `POST /tasks`, `/tasks/:id/approve` and
`/tasks/:id/revision` already match the OwlAgents model, and its `dedupe_key` is
the natural idempotency carrier. This reverses a stated ecosystem rule, so it
needs an explicit decision and a CORS policy change to match.

## What must not happen

- **No environment gains the ability to fire Olympus tasks by accident.** The
  read-only CORS policy makes this structural rather than conventional.
- **No agent publishes to Wovenstead.** Knowledge flows one way: work produces
  lessons, the operator promotes them.
- **No browser state becomes operational authority.** Adapter selection is
  build-time; `localStorage` and `/session.json` hold view state only.
- **No fixture is presented as real.** Every adapter that cannot reach its
  authority returns an empty snapshot, never demo data under a live badge.
