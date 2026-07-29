/**
 * The result contract every service call returns.
 *
 * A transition is Requested, then Accepted, then Processing, then Committed.
 * The UI renders success only from `committed`, so a refusal — stale version,
 * denied permission, duplicate request — can never be mistaken for a success
 * that simply has not finished yet.
 */

export const OUTCOME_PHASES = [
  "requested",
  "accepted",
  "processing",
  "committed",
] as const;

export type OutcomePhase = (typeof OUTCOME_PHASES)[number];

export const FAILURE_REASONS = [
  "blocked",
  "cancelled",
  "duplicate_request",
  "failed",
  "not_found",
  "permission_denied",
  "stale_state",
  "stale_version",
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export const FAILURE_LABELS: Record<FailureReason, string> = {
  blocked: "Blocked",
  cancelled: "Cancelled",
  duplicate_request: "Duplicate request",
  failed: "Failed",
  not_found: "Not found",
  permission_denied: "Permission denied",
  stale_state: "Wrong state",
  stale_version: "Stale version",
};

export type ServiceFailure = {
  error: {
    /** What the operator should do about it, when there is something to do. */
    action?: string;
    code: FailureReason;
    /** The transition that was refused, for the ledger and for the UI. */
    detail?: string;
    message: string;
  };
  ok: false;
};

export type ServiceSuccess<T> = {
  data: T;
  /** Id of the appended ledger event. Absent means nothing was committed. */
  eventId: string;
  ok: true;
  phase: "committed";
};

export type ServiceResult<T> = ServiceFailure | ServiceSuccess<T>;

export const okResult = <T>(data: T, eventId: string): ServiceSuccess<T> => ({
  data,
  eventId,
  ok: true,
  phase: "committed",
});

export const failResult = (
  code: FailureReason,
  message: string,
  extra?: { action?: string; detail?: string }
): ServiceFailure => ({
  error: { action: extra?.action, code, detail: extra?.detail, message },
  ok: false,
});

/** Narrowing helper so call sites never read `.data` off a failure. */
export const isOk = <T>(
  result: ServiceResult<T>
): result is ServiceSuccess<T> => result.ok;

/**
 * The payload the authoritative store validates before anything commits.
 * Present on every high-impact request, not just the ones that seem risky.
 */
export type TransitionEnvelope = {
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
  permissionScope: string;
  reason?: string;
  requestedAt: number;
};
