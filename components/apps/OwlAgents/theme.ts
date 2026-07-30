/**
 * OwlAgents design tokens, measured from the accepted prototype.
 *
 * Deliberately NOT merged into `styles/defaultTheme`: augmenting `DefaultTheme`
 * would put eighty command-center tokens into the autocomplete of every styled
 * component in the OS and oblige any future theme to supply them all. Scoping
 * them here also makes the contrast check a plain unit test.
 *
 * Every `text` value is chosen to clear 4.5:1 against `surface1`; the darker
 * accents are for borders, dots and fills only. `__tests__/owlagents/theme`
 * enforces that.
 */
export const OWL_TOKENS = {
  /** Layer accents. Semantic, never decorative. */
  accent: {
    dim: "#8b93a5",
    error: "#e05c5c",
    ok: "#57b96a",
    olympus: "#d9a648",
    owlagents: "#4cc2e8",
    review: "#a78bfa",
    superseded: "#6b7280",
    warning: "#e8964c",
    wovenstead: "#5fb87a",
  },
  color: {
    border: "rgba(255, 255, 255, 7%)",
    borderStrong: "rgba(255, 255, 255, 12%)",
    divider: "rgba(255, 255, 255, 6%)",
    focusRing: "hsla(207, 100%, 72%, 90%)",
    hover: "hsla(207, 30%, 72%, 25%)",
    selected: "hsla(207, 60%, 72%, 35%)",
    surface0: "rgb(24, 24, 24)",
    surface1: "rgb(32, 32, 32)",
    surface2: "rgba(255, 255, 255, 3%)",
    surface3: "rgba(255, 255, 255, 6%)",
    text: "#e8eaf0",
    textDim: "#9aa1b0",
    textMuted: "#b9bfcd",
    textStrong: "#ffffff",
  },
  font: {
    mono: 'Consolas, ui-monospace, "Courier New", monospace',
    monoSize: "11px",
    rowSize: "12px",
    sectionSize: "9.5px",
    sectionTracking: "0.08em",
    titleSize: "14px",
    ui: '"Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif',
  },
  radius: {
    card: "7px",
    chip: "10px",
    control: "6px",
    none: "0",
  },
  size: {
    columnHeader: "25px",
    detailPane: "330px",
    filterRail: "172px",
    listPane: "330px",
    policyList: "240px",
    row: "22px",
    stagingList: "310px",
    statusBar: "23px",
    toolbar: "36px",
  },
  space: {
    lg: "14px",
    md: "10px",
    sm: "6px",
    xl: "18px",
    xs: "3px",
  },
} as const;

/**
 * Chip colours by state.
 *
 * One flat map across work orders, reviews, memory, authority and integrations:
 * where two vocabularies share a word they genuinely mean the same thing, so
 * "approved" looks the same wherever it appears.
 */
const STATUS_TONE: Record<string, { fill: string; text: string }> = {
  approval_required: { fill: "#a78bfa", text: "#c4b0ff" },
  approved: { fill: "#57b96a", text: "#8fd0a3" },
  artifact_ready: { fill: "#4cc2e8", text: "#7fd6f2" },
  blocked: { fill: "#e05c5c", text: "#e08a8a" },
  cancel_requested: { fill: "#e8964c", text: "#e8b07c" },
  cancelled: { fill: "#6b7280", text: "#9aa1b0" },
  candidate: { fill: "#4cc2e8", text: "#7fd6f2" },
  canonical: { fill: "#5fb87a", text: "#8fd0a3" },
  completed: { fill: "#57b96a", text: "#8fd0a3" },
  conflict: { fill: "#e8964c", text: "#e8b07c" },
  connected: { fill: "#57b96a", text: "#8fd0a3" },
  deferred: { fill: "#8b93a5", text: "#b9bfcd" },
  degraded: { fill: "#e8964c", text: "#e8b07c" },
  demo: { fill: "#d9a648", text: "#e8c07c" },
  derived: { fill: "#4cc2e8", text: "#7fd6f2" },
  disconnected: { fill: "#8b93a5", text: "#b9bfcd" },
  draft: { fill: "#8b93a5", text: "#b9bfcd" },
  offline: { fill: "#e05c5c", text: "#e08a8a" },
  pending: { fill: "#a78bfa", text: "#c4b0ff" },
  policy_pending: { fill: "#e8964c", text: "#e8b07c" },
  published: { fill: "#5fb87a", text: "#8fd0a3" },
  queued: { fill: "#8b93a5", text: "#b9bfcd" },
  raw: { fill: "#8b93a5", text: "#b9bfcd" },
  rejected: { fill: "#e05c5c", text: "#e08a8a" },
  review_pending: { fill: "#a78bfa", text: "#c4b0ff" },
  reviewed: { fill: "#a78bfa", text: "#c4b0ff" },
  revision_requested: { fill: "#e8964c", text: "#e8b07c" },
  revision_required: { fill: "#e8964c", text: "#e8b07c" },
  running: { fill: "#4cc2e8", text: "#7fd6f2" },
  staged: { fill: "#5fb87a", text: "#8fd0a3" },
  stale: { fill: "#e05c5c", text: "#e08a8a" },
  superseded: { fill: "#6b7280", text: "#9aa1b0" },
};

const DEFAULT_TONE = { fill: "#8b93a5", text: "#b9bfcd" };

export const toneOf = (status: string): { fill: string; text: string } =>
  STATUS_TONE[status] ?? DEFAULT_TONE;

/** Environment badge colours, one per mode. */
export const AUTHORITY_TONE: Record<string, { fill: string; text: string }> = {
  CONNECTED: { fill: "#57b96a", text: "#8fd0a3" },
  DEGRADED: { fill: "#e8964c", text: "#e8b07c" },
  DEMO: { fill: "#d9a648", text: "#e8c07c" },
  LOCAL: { fill: "#4cc2e8", text: "#7fd6f2" },
  OFFLINE: { fill: "#e05c5c", text: "#e08a8a" },
};
