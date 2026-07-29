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
| A real local authority (API, SQLite or Postgres)                                      | `owlagents/adapters/local` — returns OFFLINE and refuses writes with a reason                                                               |
| Remote companion access                                                               | `owlagents/adapters/remote`                                                                                                                 |
| Optional Supabase companion for remote reads, shell-preference sync and ledger backup | `owlagents/adapters/supabase` — reports DEGRADED when unconfigured rather than failing open                                                 |
| Live integrations (Ollama and the local filesystem first)                             | `IntegrationAdapter` in `owlagents/adapters/types.ts`: `describe`, `check`, `read`, optional `write` carrying its approving policy decision |
| Stage advance driven by execution events                                              | `scenarioService` is the current seam; a real adapter appends the same ledger events                                                        |
| Cost reporting by project and work order                                              | `Money` on work orders and runs; Mission Control already sums it                                                                            |
| Policy editing and simulation                                                         | `PolicyInspector` is read-only; a change is a proposal that routes through the Review Queue                                                 |
| Permission management                                                                 | `permissionScope` is validated per command; the scope set is currently fixed                                                                |

## Known gaps in what did land

- **Sources & Files intake is not interactive.** The intake stage machine and
  `sourceService.advanceIntake` exist and are tested, but dropping a file onto
  the window does not yet run it: the drop lands in the repository's own
  `useFileDrop`, which has no knowledge of domain objects. Wiring the two is
  the next bounded piece of that application.
- **Capabilities are declared but not gated.** Every registry entry carries
  `requiredCapabilities`, and the registry test asserts they exist, but nothing
  hides an application yet — there is one operator with every scope.
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

One bounded piece: **make the intake real**. Wire drag-and-drop in Sources &
Files to `sourceService.advanceIntake`, so a dropped file walks
`received → hashing → preserved → classifying → policy checked → assigned →
ready`, appending ledger events at each step, and lands as a `Source` linked to
a project — with the local adapter behind it rather than the demo one. No new
applications.
