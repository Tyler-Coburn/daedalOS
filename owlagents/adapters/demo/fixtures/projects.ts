import { type Project } from "owlagents/domain/types";

/**
 * DEMO FIXTURE — typed local data. Nothing here was read from a real system.
 *
 * `PRJ-001` (Delphi Research) carries the vertical slice: source SRC-0142 ->
 * context pack PACK-0001 -> work order WO-2026-0051 -> policy decision PD-0051
 * -> run RUN-0051 -> artifact ART-0031 -> evidence -> review REV-2026-0186 ->
 * memory candidate MC-0036 -> published Wovenstead record.
 */
export const DEMO_PROJECTS: Readonly<Record<string, Project>> = {
  "PRJ-001": {
    activeWorkOrderIds: ["WO-2026-0051", "WO-2026-0041"],
    blockers: [],
    costToDate: { amount: 0.97, currency: "USD" },
    createdAt: "2026-06-02T09:00:00.000Z",
    health: "healthy",
    id: "PRJ-001",
    lockedDecisions: [
      "Only whitelisted regulatory domains may be ingested",
      "Every claim carries a six-field rubric score",
    ],
    name: "Delphi Research",
    nextActions: ["Acknowledge cost soft-cap (REV-2026-0189)"],
    phase: "Research",
    purpose:
      "Establish a defensible reading of EU regulatory directives affecting the product line.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-001",
    stage: {
      index: 1,
      steps: [
        "Sources preserved",
        "Context assembled",
        "Rubric applied",
        "Brief reviewed",
        "Memory published",
      ],
    },
    updatedAt: "2026-07-28T14:19:02.000Z",
  },
  "PRJ-002": {
    activeWorkOrderIds: ["WO-2026-0046", "WO-2026-0048"],
    blockers: [],
    costToDate: { amount: 0.45, currency: "USD" },
    createdAt: "2026-04-11T09:00:00.000Z",
    health: "healthy",
    id: "PRJ-002",
    lockedDecisions: ["Operator approves every bounded execution"],
    name: "OwlAgents Core",
    nextActions: ["Approve WO-2026-0047 bounded execution"],
    phase: "Build",
    purpose:
      "The controlled work system: work orders, policy, evidence, review.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-002",
    stage: {
      index: 2,
      steps: [
        "Domain modelled",
        "Transitions enforced",
        "Review safety landed",
        "Adapters connected",
      ],
    },
    updatedAt: "2026-07-28T13:44:08.000Z",
  },
  "PRJ-003": {
    activeWorkOrderIds: ["WO-2026-0049", "WO-2026-0043"],
    blockers: ["Schema migration plan is unreviewed"],
    costToDate: { amount: 1.33, currency: "USD" },
    createdAt: "2026-05-20T09:00:00.000Z",
    health: "at_risk",
    id: "PRJ-003",
    lockedDecisions: [
      "Publication is operator-only",
      "A superseded record is preserved, never deleted",
    ],
    name: "Wovenstead Vault",
    nextActions: ["Review schema migration plan (WO-2026-0049)"],
    phase: "Design",
    purpose:
      "Durable, reviewed knowledge with provenance and publication history.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-003",
    stage: {
      index: 1,
      steps: [
        "Record shape agreed",
        "Migration planned",
        "Staging built",
        "Cutover",
      ],
    },
    updatedAt: "2026-07-28T12:31:00.000Z",
  },
  "PRJ-004": {
    activeWorkOrderIds: [],
    blockers: ["Provider gateway is rate limited"],
    costToDate: { amount: 0.08, currency: "USD" },
    createdAt: "2026-03-02T09:00:00.000Z",
    health: "blocked",
    id: "PRJ-004",
    lockedDecisions: ["A 429 is surfaced, never silently retried"],
    name: "Olympus Runtime",
    nextActions: ["Clear provider rate limit, retry WO-2026-0050"],
    phase: "Stabilize",
    purpose:
      "Providers, models, queues and services that actually execute work.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-004",
    stage: {
      index: 2,
      steps: [
        "Services mapped",
        "Health surfaced",
        "Limits respected",
        "Incidents linked",
      ],
    },
    updatedAt: "2026-07-28T14:32:09.000Z",
  },
  "PRJ-005": {
    activeWorkOrderIds: ["WO-2026-0045"],
    blockers: [],
    costToDate: { amount: 0.96, currency: "USD" },
    createdAt: "2026-05-04T09:00:00.000Z",
    health: "healthy",
    id: "PRJ-005",
    lockedDecisions: ["Conflicting evidence is surfaced, never averaged"],
    name: "Homestead Ledger",
    nextActions: ["Approve supplier memory candidate MC-0031"],
    phase: "Research",
    purpose: "Supplier and cost truth for the homestead build programme.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-005",
    stage: {
      index: 2,
      steps: [
        "Claims collected",
        "Rubric applied",
        "Conflicts resolved",
        "Decision recorded",
      ],
    },
    updatedAt: "2026-07-28T11:20:00.000Z",
  },
  "PRJ-006": {
    activeWorkOrderIds: ["WO-2026-0050"],
    blockers: ["Two adapter tests are failing"],
    costToDate: { amount: 1.47, currency: "USD" },
    createdAt: "2026-06-15T09:00:00.000Z",
    health: "at_risk",
    id: "PRJ-006",
    lockedDecisions: ["Scope expansion always returns to operator approval"],
    name: "Aegis Policy Engine",
    nextActions: ["Fix 2 failing tests (REV-2026-0187)"],
    phase: "Build",
    purpose: "Policy evaluation in front of every execution scope.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-006",
    stage: {
      index: 1,
      steps: [
        "Rules authored",
        "Adapter split",
        "Tests green",
        "Simulation surfaced",
      ],
    },
    updatedAt: "2026-07-28T12:58:00.000Z",
  },
  "PRJ-007": {
    activeWorkOrderIds: ["WO-2026-0047", "WO-2026-0042"],
    blockers: [],
    costToDate: { amount: 0.51, currency: "USD" },
    createdAt: "2026-04-28T09:00:00.000Z",
    health: "healthy",
    id: "PRJ-007",
    lockedDecisions: ["Runtime code changes require operator approval"],
    name: "Argus Monitoring",
    nextActions: ["Review reconnect patch (REV-2026-0184)"],
    phase: "Build",
    purpose: "Event-stream monitoring that never drops an event silently.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-007",
    stage: {
      index: 2,
      steps: ["Drops reproduced", "Patch built", "Patch reviewed", "Deployed"],
    },
    updatedAt: "2026-07-28T13:12:00.000Z",
  },
  "PRJ-008": {
    activeWorkOrderIds: [],
    blockers: [],
    costToDate: { amount: 0.08, currency: "USD" },
    createdAt: "2026-07-10T09:00:00.000Z",
    health: "healthy",
    id: "PRJ-008",
    lockedDecisions: ["Adapters declare their scopes before they connect"],
    name: "Talaria Integrations",
    nextActions: ["Draft adapter interfaces for task service"],
    phase: "Plan",
    purpose:
      "One integration registry with honest authority and credential state.",
    sourceOfTruth: "/OwlAgents/Sources/PRJ-008",
    stage: {
      index: 0,
      steps: [
        "Systems listed",
        "Scopes declared",
        "Adapters built",
        "Connected",
      ],
    },
    updatedAt: "2026-07-27T16:40:00.000Z",
  },
};
