/**
 * Wovenstead memory-candidate lifecycle.
 *
 * The only path to a canonical record is
 * `candidate -> approved -> staged -> published`. Skipping a step is not a
 * validation warning, it is an illegal transition. Agents never publish.
 */

export const MEMORY_STATES = [
  "approved",
  "candidate",
  "conflict",
  "published",
  "rejected",
  "revision_requested",
  "staged",
  "superseded",
] as const;

export type MemoryState = (typeof MEMORY_STATES)[number];

export type MemoryTransition = {
  operatorOnly: boolean;
  to: MemoryState;
  trigger: string;
};

export const MEMORY_TRANSITIONS: Record<
  MemoryState,
  readonly MemoryTransition[]
> = {
  approved: [
    { operatorOnly: true, to: "staged", trigger: "Stage candidate" },
    { operatorOnly: true, to: "rejected", trigger: "Reject" },
    {
      operatorOnly: true,
      to: "revision_requested",
      trigger: "Request revision",
    },
    { operatorOnly: false, to: "conflict", trigger: "Canon disagreement" },
  ],
  candidate: [
    { operatorOnly: true, to: "approved", trigger: "Approve candidate" },
    { operatorOnly: true, to: "rejected", trigger: "Reject" },
    {
      operatorOnly: true,
      to: "revision_requested",
      trigger: "Request revision",
    },
    { operatorOnly: false, to: "conflict", trigger: "Canon disagreement" },
  ],
  conflict: [
    { operatorOnly: true, to: "candidate", trigger: "Conflict resolved" },
    { operatorOnly: true, to: "rejected", trigger: "Reject" },
  ],
  published: [
    {
      operatorOnly: false,
      to: "superseded",
      trigger: "Newer record published",
    },
  ],
  rejected: [],
  revision_requested: [
    { operatorOnly: false, to: "candidate", trigger: "Revised draft produced" },
  ],
  staged: [
    { operatorOnly: true, to: "published", trigger: "Publish to Wovenstead" },
    { operatorOnly: true, to: "rejected", trigger: "Reject" },
    {
      operatorOnly: true,
      to: "revision_requested",
      trigger: "Request revision",
    },
    { operatorOnly: false, to: "conflict", trigger: "Canon disagreement" },
  ],
  superseded: [],
};

export const allowedMemoryTransitions = (
  from: MemoryState
): readonly MemoryTransition[] => MEMORY_TRANSITIONS[from];

export const canPromoteMemory = (from: MemoryState, to: MemoryState): boolean =>
  MEMORY_TRANSITIONS[from].some((edge) => edge.to === to);

export const isOperatorOnlyMemoryTransition = (
  from: MemoryState,
  to: MemoryState
): boolean =>
  MEMORY_TRANSITIONS[from].some((edge) => edge.to === to && edge.operatorOnly);

export const MEMORY_STATE_LABELS: Record<MemoryState, string> = {
  approved: "Approved",
  candidate: "Candidate",
  conflict: "Conflict",
  published: "Published",
  rejected: "Rejected",
  revision_requested: "Revision requested",
  staged: "Staged",
  superseded: "Superseded",
};

/** The publication gate, stated positively so the UI can explain a refusal. */
export const PUBLICATION_PRECONDITIONS: readonly string[] = [
  "Candidate has been approved by an operator",
  "Candidate has been staged",
  "Expected version matches the stored version",
  "Operator holds the memory.publish permission scope",
  "The existing canonical record is preserved and marked superseded",
  "A ledger event is appended before the UI reports success",
];
