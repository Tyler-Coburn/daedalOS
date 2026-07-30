# Consolidation baseline — repository audit

Recorded at the start of Phase B2 (production consolidation), against
`Tyler-Coburn/daedalOS@0df82d75` on branch `feat/production-consolidation`.

This commit changes no behaviour. It records what the repository already
provides, so the rest of the phase can extend it rather than rebuild it.

## What the repository already owns

| Concern                       | Where it lives                                                                                                                       | Verdict                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Framework                     | Next.js 15 (`pages/`), React 19, TypeScript 5.9 strict, styled-components 6                                                          | Keep                                             |
| Window manager                | `components/system/Window` → `RndWindow` → `useRnd`, with `isWindowOutsideBounds`, `cascadePosition`, `centerPosition`, `minMaxSize` | Reuse                                            |
| Process registry              | `contexts/process/directory.ts`, typed by `Process` in `contexts/process/types.ts`                                                   | Extend                                           |
| Process lifecycle             | `useProcesses()` — `open`, `close`, `minimize`, `maximize`, `argument`, `url`, `linkElement`                                         | Reuse                                            |
| Session persistence           | `contexts/session` → `SessionData` written to `SESSION_FILE` (`/session.json`) through BrowserFS                                     | Reuse, shell state only                          |
| Taskbar                       | `components/system/Taskbar` — entries derived from live processes, peek, tray, clock                                                 | Reuse                                            |
| Start menu                    | `components/system/StartMenu` — a `FileManager` over `/Users/Public/Start Menu`; entries are `.url` files on disk                    | Extend by generating shortcuts from the registry |
| File Explorer                 | `components/system/Files` — `FileManager`, `FileEntry`, Views, columns, sorting, drag-drop, context menus                            | Compose, do not fork                             |
| Run dialog / command surfaces | `components/system/Dialogs/Run`, `Taskbar/Search`                                                                                    | Reuse                                            |
| Deep links (existing)         | `hooks/useUrlLoader.ts` — one-shot `?app=` / `?url=` query params, no history write-back                                             | Extend with real routes                          |
| Theme                         | `styles/defaultTheme` — one theme, type-augmented `DefaultTheme`                                                                     | Leave alone; OwlAgents tokens are scoped         |
| Tests                         | Jest 30 (jsdom) + Playwright 1.56 (chromium/firefox/webkit)                                                                          | Extend                                           |

## What the repository does not have

- No `owlagents/`, `OwlAgents`, `Wovenstead`, `WorkOrder` or `MissionControl` code.
- No Supabase, no `src/` tree, no second router, no second window manager.
- **No Phase B1 domain work has landed.** `main` is unmodified upstream daedalOS.
- No `zod`. No React Testing Library, and therefore no component-render harness.
- No path aliases: `baseUrl: "."`, no `paths`. Imports are bare-root absolute.

## Constraints that shape the implementation

1. **`next.config.js` sets `output: "export"`.** A catch-all route cannot
   statically export arbitrary ids, so deep links pre-render the known fixture
   ids and fall back to `pages/404.tsx`, which renders the same desktop and
   resolves the path client-side.
2. **e2e selects by DOM structure, not `data-testid`.** `DESKTOP_SELECTOR` is
   `body>#__next>main`; `WINDOW_SELECTOR` is `${DESKTOP}>.react-draggable>section`.
   Adding a wrapper element inside those paths breaks the existing suite.
3. **`captureConsoleLogs()` throws on any un-allow-listed console message**, and
   Playwright runs `yarn dev` locally where `removeConsole` does not apply. So:
   no `console.*` in OwlAgents code, `$`-prefixed transient props are mandatory,
   and `useSyncExternalStore` must supply `getServerSnapshot`.
4. **Lint is strict**: alphabetical object keys and type members, no relative
   imports, `memo()` on every component, explicit return types, inline type
   imports, alphabetical CSS properties inside styled templates.
5. **CI runs `yarn test` → `yarn build` → `yarn e2e` only.** `eslint`,
   `stylelint` and `unused-exports` run in `lint-staged`, so the per-commit gate
   is jest plus build, and the lint gates are checked before the pull request.

## Baseline validation

Run on Node 22 with Yarn Classic 1.22.22, at this commit:

| Command                          | Result                                  |
| -------------------------------- | --------------------------------------- |
| `yarn install --frozen-lockfile` | pass                                    |
| `yarn build:prebuild`            | pass (generates `public/.index/*.json`) |
| `yarn test`                      | pass — 14 tests, 1 suite                |
| `yarn stylelint`                 | pass — 0 problems                       |
| `npx tsc --noEmit`               | pass                                    |
| `yarn eslint`                    | pass                                    |

Note: `tsc --noEmit` fails on a fresh clone until `build:prebuild` has run,
because `public/.index/*.json` are generated, not committed. That is
pre-existing behaviour, not a regression introduced by this phase.
