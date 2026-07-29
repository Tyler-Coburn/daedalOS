/**
 * Work-order state machine.
 *
 * Status changes are transitions, not assignments. A component may *request* a
 * transition; the authoritative store decides whether it commits. Nothing in
 * this module mutates — it only answers "is this move legal?".
 */

export const WORK_ORDER_STATUSES = [
  "approval_required",
  "approved",
  "artifact_ready",
  "blocked",
  "cancel_requested",
  "cancelled",
  "completed",
  "draft",
  "policy_pending",
  "queued",
  "rejected",
  "review_pending",
  "revision_required",
  "running",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type TransitionActor = "operator" | "policy" | "runtime";

export type WorkOrderTransition = {
  actor: TransitionActor;
  to: WorkOrderStatus;
  trigger: string;
};

/** Every legal edge, keyed by the status you are leaving. */
export const WORK_ORDER_TRANSITIONS: Record<
  WorkOrderStatus,
  readonly WorkOrderTransition[]
> = {
  approval_required: [
    { actor: "operator", to: "queued", trigger: "Approve bounded execution" },
    { actor: "operator", to: "rejected", trigger: "Reject" },
  ],
  approved: [{ actor: "operator", to: "queued", trigger: "Start execution" }],
  artifact_ready: [
    { actor: "runtime", to: "review_pending", trigger: "Artifact registered" },
  ],
  blocked: [
    { actor: "operator", to: "queued", trigger: "Retry (operator command)" },
    {
      actor: "operator",
      to: "cancel_requested",
      trigger: "Cancel work order",
    },
  ],
  cancel_requested: [
    {
      actor: "runtime",
      to: "cancelled",
      trigger: "Runtime acknowledged cancel",
    },
  ],
  cancelled: [],
  completed: [],
  draft: [
    {
      actor: "operator",
      to: "policy_pending",
      trigger: "Submit for policy decision",
    },
  ],
  policy_pending: [
    { actor: "policy", to: "approved", trigger: "Allowed within scope" },
    { actor: "policy", to: "queued", trigger: "Allowed, no approval needed" },
    { actor: "policy", to: "approval_required", trigger: "Needs human" },
    { actor: "policy", to: "rejected", trigger: "Denied" },
  ],
  queued: [{ actor: "runtime", to: "running", trigger: "Runtime picks up" }],
  rejected: [{ actor: "operator", to: "draft", trigger: "Reopen as draft" }],
  review_pending: [
    { actor: "operator", to: "completed", trigger: "Approve" },
    {
      actor: "operator",
      to: "revision_required",
      trigger: "Request revision",
    },
  ],
  revision_required: [
    { actor: "runtime", to: "queued", trigger: "New execution run" },
  ],
  running: [
    { actor: "runtime", to: "artifact_ready", trigger: "Output produced" },
    {
      actor: "runtime",
      to: "blocked",
      trigger: "Provider or scope failure",
    },
    {
      actor: "operator",
      to: "cancel_requested",
      trigger: "Cancel work order",
    },
  ],
};

export const allowedTransitions = (
  from: WorkOrderStatus
): readonly WorkOrderTransition[] => WORK_ORDER_TRANSITIONS[from];

export const canTransition = (
  from: WorkOrderStatus,
  to: WorkOrderStatus
): boolean => WORK_ORDER_TRANSITIONS[from].some((edge) => edge.to === to);

export const transitionTrigger = (
  from: WorkOrderStatus,
  to: WorkOrderStatus
): string | undefined =>
  WORK_ORDER_TRANSITIONS[from].find((edge) => edge.to === to)?.trigger;

export const isTerminalStatus = (status: WorkOrderStatus): boolean =>
  WORK_ORDER_TRANSITIONS[status].length === 0;

/**
 * Operator-facing labels. Never render a raw status key — and never rely on
 * colour alone to communicate one.
 */
export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  approval_required: "Awaiting approval",
  approved: "Approved",
  artifact_ready: "Artifact ready",
  blocked: "Blocked",
  cancel_requested: "Cancelling",
  cancelled: "Cancelled",
  completed: "Completed",
  draft: "Draft",
  policy_pending: "Awaiting policy",
  queued: "Queued",
  rejected: "Rejected",
  review_pending: "Review required",
  revision_required: "Revision required",
  running: "Running",
};

/**
 * Filter-rail order: attention-worthy first, terminal last. Every status
 * appears exactly once so no work order can hide from every filter.
 */
export const WORK_ORDER_FILTER_ORDER: readonly WorkOrderStatus[] = [
  "running",
  "approval_required",
  "policy_pending",
  "review_pending",
  "blocked",
  "queued",
  "approved",
  "artifact_ready",
  "draft",
  "revision_required",
  "cancel_requested",
  "completed",
  "rejected",
  "cancelled",
];
