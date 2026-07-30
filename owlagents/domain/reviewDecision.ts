/**
 * Review states, operator decisions and staleness.
 *
 * A review is a decision about a *specific version of a specific artifact*. If
 * the artifact moves underneath it, the review is stale: approval is refused,
 * the previous history is preserved and a new cycle is required.
 */

export const REVIEW_STATES = [
  "approved",
  "deferred",
  "pending",
  "rejected",
  "revision_requested",
  "stale",
] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_DECISIONS = [
  "approve",
  "defer",
  "reject",
  "request_revision",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_DECISION_RESULT: Record<ReviewDecision, ReviewState> = {
  approve: "approved",
  defer: "deferred",
  reject: "rejected",
  request_revision: "revision_requested",
};

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  approve: "Approve",
  defer: "Defer",
  reject: "Reject",
  request_revision: "Request revision",
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  approved: "Approved",
  deferred: "Deferred",
  pending: "Pending",
  rejected: "Rejected",
  revision_requested: "Revision requested",
  stale: "Stale — artifact changed",
};

/** Only a pending review may be decided. A deferred review is re-openable. */
export const isDecidableReviewState = (state: ReviewState): boolean =>
  state === "deferred" || state === "pending";

type ReviewExpectation = {
  expectedArtifactHash: string;
  expectedArtifactVersion: number;
  expectedVersion: number;
};

type ReviewObservation = {
  artifactHash: string;
  artifactVersion: number;
  version: number;
};

export type StalenessReason =
  | "artifact_hash_changed"
  | "artifact_version_changed"
  | "review_version_changed";

export type ReviewStaleness = {
  isStale: boolean;
  reasons: readonly StalenessReason[];
};

const STALENESS_EXPLANATIONS: Record<StalenessReason, string> = {
  artifact_hash_changed:
    "The artifact content hash changed after this review was requested.",
  artifact_version_changed:
    "A newer version of the artifact was produced after this review was requested.",
  review_version_changed:
    "This review was updated elsewhere after you opened it.",
};

export const reviewStaleness = (
  expected: ReviewExpectation,
  observed: ReviewObservation
): ReviewStaleness => {
  const reasons: StalenessReason[] = [];

  if (expected.expectedVersion !== observed.version) {
    reasons.push("review_version_changed");
  }
  if (expected.expectedArtifactVersion !== observed.artifactVersion) {
    reasons.push("artifact_version_changed");
  }
  if (expected.expectedArtifactHash !== observed.artifactHash) {
    reasons.push("artifact_hash_changed");
  }

  return { isStale: reasons.length > 0, reasons };
};

export const explainStaleness = (
  staleness: ReviewStaleness
): readonly string[] =>
  staleness.reasons.map((reason) => STALENESS_EXPLANATIONS[reason]);
