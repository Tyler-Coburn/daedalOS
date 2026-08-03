# What Phase B2 deliberately did not do

Adapter boundaries exist for all of the below. None of it is wired.

## Out of scope by instruction

Public SaaS support · full multi-user permissions · mobile redesign ·
paid-provider execution · automatic model downloads · broad filesystem writes ·
automatic repository execution · autonomous scope expansion · automatic
Wovenstead publication · advanced policy editing · complete n8n integration ·
complete ComfyUI integration · Google Drive write access · GitHub write
automation · additional wallpapers · screensavers · new decorative applications.

## Deferred with a boundary already in place

| Item                                                                                  | Where the seam is                                                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A real local authority (API, SQLite or Postgres)                                      | **Landed in B3** — `owlagents/adapters/local` reads the Olympus runtime. See `olympus-adapter.md`. Still refuses writes with a reason       |
| Remote companion access                                                               | `owlagents/adapters/remote`                                                                                                                 |
| Optional Supabase companion for remote reads, shell-preference sync and ledger backup | `owlagents/adapters/supabase` — reports DEGRADED when unconfigured rather than failing open                                                 |
| Live integrations (Ollama and the local filesystem first)                             | `IntegrationAdapter` in `owlagents/adapters/types.ts`: `describe`, `check`, `read`, optional `write` carrying its approving policy decision |
| Stage advance driven by execution events                                              | `scenarioService` is the current seam; a real adapter appends the same ledger events                                                        |
| Cost reporting by project and work order                                              | `Money` on work orders and runs; Mission Control already sums it                                                                            |
| Policy editing and simulation                                                         | `PolicyInspector` is read-only; a change is a proposal that routes through the Review Queue                                                 |
| Multi-operator permission management                                                  | `permissionScope` is validated per command and `capabilities` gate applications; the set belongs to one operator and is not yet persisted   |

## Known gaps in what did land

- **Only one operator identity exists.** Capabilities are declared, enforced and
  revocable, but there is a single operator holding the full set. Multi-operator
  identity, and persisting a per-operator scope set, is a later phase.
- **Intake runs against the demo adapter.** The stages are real — the hash is
  measured with `crypto.subtle`, the file is written to the sources mount, and
  each stage is a separate committed transition — but the authority behind it is
  still `owlagents/adapters/demo`. Putting the local adapter behind it is the
  first real exercise of that boundary.
- **The Start menu shows the OwlAgents group as a folder**, not as three
  inline sections. Categories drive the folder layout; a flatter presentation
  would mean changing the shared `StartMenu` component.
- **The command palette does not yet search domain objects.** The repository's
  search is a lunr index built at build time from the filesystem; adding work
  orders and reviews to it means extending `scripts/searchIndex.js`.
- **Supabase migrations are not written.** The obsolete Lovable UI-shaped
  schema (`kpi_snapshots`, `attention_item_text`, `display_events`,
  `since_last_strings`) is recorded as obsolete here and must not be adopted;
  the same values are derived from the domain instead.

## Suggested next phase

**B4 — the write path, if and only if the operator decides to open it.**

B3 made the local adapter real but read-only: it maps the Olympus queue into
work orders and refuses every command. Whether daedalOS may _fire_ Olympus tasks
is a governance decision, not a missing feature. The current ecosystem rule is
that other environments never fire Olympus tasks — the operator is the bridge.

If that rule changes, the seam is `createLocalAdapter.applyCommand`, and the
Olympus routes that already match the OwlAgents model are `POST /tasks`,
`POST /tasks/:id/approve` (logs `human_approved`, deliberately leaves status
alone) and `POST /tasks/:id/revision` (opens a new task carrying `revision_of`).
Olympus's own `dedupe_key` is the natural carrier for the idempotency key.

If it does not change, the next bounded piece is **make the intake real**: wire
drag-and-drop in Sources & Files to `sourceService.advanceIntake`, so a dropped
file walks `received → hashing → preserved → classifying → policy checked →
assigned → ready`, appending ledger events at each step, and lands as a `Source`
linked to a project. No new applications.
