/**
 * Two kinds of authority, deliberately kept apart.
 *
 * `EnvironmentMode` answers "how much of what you see was really checked?" and
 * has exactly one producer, so the tray, System Health, Integrations and every
 * application header are structurally incapable of disagreeing.
 *
 * `AuthorityLevel` answers "how settled is this artifact?" and rises only
 * through review.
 */

// ts-prune-ignore-next — the documented mode vocabulary; adapters read it.
export const ENVIRONMENT_MODES = [
  "CONNECTED",
  "DEGRADED",
  "DEMO",
  "LOCAL",
  "OFFLINE",
] as const;

type EnvironmentMode = (typeof ENVIRONMENT_MODES)[number];

export type EnvironmentAuthority = {
  /** Operational writes permitted at all in this mode. */
  canWrite: boolean;
  /** Operator-facing sentence explaining exactly what is and is not connected. */
  detail: string;
  /** True when every operational read came from a labelled fixture. */
  isFixture: boolean;
  mode: EnvironmentMode;
  /** Why writes are refused, when they are. Empty when `canWrite`. */
  writeBlockedReason: string;
};

/**
 * Read semantics per mode, quoted on the data-authority flyout. Kept as data so
 * no application can invent its own wording.
 */
const ENVIRONMENT_READ_SOURCE: Record<EnvironmentMode, string> = {
  CONNECTED: "Local authority plus external adapters, per-adapter authority.",
  DEGRADED: "Last authoritative state, read-only.",
  DEMO: "Typed local fixtures. No external system was contacted.",
  LOCAL: "Local authoritative adapter.",
  OFFLINE: "Shell only. No operational data is available.",
};

const ENVIRONMENT_WRITE_RULE: Record<EnvironmentMode, string> = {
  CONNECTED: "Allowed per adapter authority.",
  DEGRADED: "Blocked — the authoritative store is unreachable.",
  DEMO: "Simulated against fixtures and recorded in the demo ledger.",
  LOCAL: "Allowed and validated by the local authority.",
  OFFLINE: "Disabled — nothing can be committed while offline.",
};

const canWriteInMode = (mode: EnvironmentMode): boolean =>
  mode === "CONNECTED" || mode === "DEMO" || mode === "LOCAL";

/**
 * DEMO is the only mode whose writes commit without an authoritative store, so
 * it is also the only mode that must label every record it returns.
 */
const isFixtureMode = (mode: EnvironmentMode): boolean => mode === "DEMO";

export const describeEnvironment = (
  mode: EnvironmentMode
): EnvironmentAuthority => ({
  canWrite: canWriteInMode(mode),
  detail: ENVIRONMENT_READ_SOURCE[mode],
  isFixture: isFixtureMode(mode),
  mode,
  writeBlockedReason: canWriteInMode(mode) ? "" : ENVIRONMENT_WRITE_RULE[mode],
});

/** Source and artifact authority, lowest to highest. */
// ts-prune-ignore-next — the documented authority ladder, lowest to highest.
export const AUTHORITY_LEVELS = [
  "raw",
  "derived",
  "candidate",
  "reviewed",
  "approved",
  "canonical",
  "superseded",
] as const;

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  approved: "Approved",
  candidate: "Candidate",
  canonical: "Canonical",
  derived: "Derived",
  raw: "Raw source",
  reviewed: "Reviewed",
  superseded: "Superseded",
};

// ts-prune-ignore-next — the documented integration state vocabulary.
export const INTEGRATION_STATES = [
  "connected",
  "degraded",
  "demo",
  "disconnected",
] as const;

export type IntegrationState = (typeof INTEGRATION_STATES)[number];

export const INTEGRATION_STATE_LABELS: Record<IntegrationState, string> = {
  connected: "Connected",
  degraded: "Degraded",
  demo: "Demo fixture",
  disconnected: "Disconnected",
};

/** A disconnected system must never render as healthy. */
export const isHealthyIntegrationState = (state: IntegrationState): boolean =>
  state === "connected";

/** Source intake is staged and visible — a dropped file is not yet authoritative. */
const INTAKE_STAGES = [
  "received",
  "hashing",
  "preserved",
  "classifying",
  "policy_checked",
  "assigned",
  "ready",
  "failed",
] as const;

export type IntakeStage = (typeof INTAKE_STAGES)[number];

export const INTAKE_STAGE_LABELS: Record<IntakeStage, string> = {
  assigned: "Assigned",
  classifying: "Classifying",
  failed: "Failed",
  hashing: "Hashing",
  policy_checked: "Policy checked",
  preserved: "Preserved",
  ready: "Ready",
  received: "Received",
};

export const nextIntakeStage = (
  stage: IntakeStage
): IntakeStage | undefined => {
  if (stage === "failed" || stage === "ready") return undefined;

  return INTAKE_STAGES[INTAKE_STAGES.indexOf(stage) + 1];
};
