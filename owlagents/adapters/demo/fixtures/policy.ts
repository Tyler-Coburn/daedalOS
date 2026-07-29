import { scope } from "owlagents/adapters/demo/fixtures/common";
import { type PolicyDecision, type PolicyRule } from "owlagents/domain/types";

/** DEMO FIXTURE — the rules the Policy Inspector reads. Read-only in B2. */
export const DEMO_POLICY_RULES: Readonly<Record<string, PolicyRule>> = {
  "POL-001": {
    allow: ["artifacts.write", "tests.run", "scope./artifacts"],
    deny: ["repo.merge", "deploy.prod", "scope./derived (rw)"],
    gate: "Operator approval for runtime code",
    id: "POL-001",
    name: "Bounded execution scope",
    note: "Scope expansion is never automatic. Widening returns the work order to approval.",
    owner: "Operator",
    scope: "/artifacts (rw) · /derived (ro)",
    status: "active",
    version: 4,
  },
  "POL-002": {
    allow: ["sources.read", "sources.scan", "evidence.write"],
    deny: ["publish.external", "sources.delete"],
    gate: "None — bounded read",
    id: "POL-002",
    name: "Source ingestion",
    note: "Ingestion preserves and hashes. It never grants authority.",
    owner: "Operator",
    scope: "whitelisted domains · read-only",
    status: "active",
    version: 2,
  },
  "POL-003": {
    allow: ["candidates.write", "memory.compare"],
    deny: ["memory.publish", "records.overwrite"],
    gate: "Operator click, always",
    id: "POL-003",
    name: "Memory publication",
    note: "Agents may propose a candidate. Only an operator publishes it.",
    owner: "Operator",
    scope: "Wovenstead staging → canonical",
    status: "active",
    version: 3,
  },
  "POL-004": {
    allow: ["spend.estimate"],
    deny: ["spend.money (unbounded)"],
    gate: "Acknowledgement above $1.00 soft cap",
    id: "POL-004",
    name: "Cost thresholds",
    note: "A soft cap pauses work; it does not silently continue.",
    owner: "Cost service",
    scope: "per work order",
    status: "active",
    version: 1,
  },
  "POL-005": {
    allow: ["exports.stage"],
    deny: ["publish.external", "share.link.create"],
    gate: "Operator click + expiry + watermark",
    id: "POL-005",
    name: "External publication",
    note: "Staging locally is allowed. Leaving the machine is not.",
    owner: "Operator",
    scope: "exports → outside world",
    status: "active",
    version: 2,
  },
  "POL-006": {
    allow: ["conflicts.flag"],
    deny: ["conflicts.autoresolve"],
    gate: "Operator judgement recorded",
    id: "POL-006",
    name: "Conflicting evidence",
    note: "Proposed by Athena. Conflicts are surfaced, never averaged away.",
    owner: "Athena (proposed)",
    scope: "evidence lane",
    status: "draft",
    version: 1,
  },
};

/** DEMO FIXTURE — one decision per work order that has reached policy. */
export const DEMO_POLICY_DECISIONS: Readonly<Record<string, PolicyDecision>> = {
  "PD-0045": {
    allowedScope: scope(
      ["/OwlAgents/Evidence"],
      ["sources.read", "evidence.write", "rubric.apply"],
      ["conflicts.autoresolve"],
      1
    ),
    createdAt: "2026-07-27T09:12:00.000Z",
    evaluatedRuleIds: ["POL-002", "POL-006"],
    id: "PD-0045",
    policyVersion: 2,
    reasons: ["Six-field rubric applied to all sources."],
    requestedScope: scope(
      ["/OwlAgents/Evidence"],
      ["sources.read", "evidence.write", "rubric.apply"],
      [],
      1
    ),
    requiresOperatorApproval: false,
    result: "allowed",
    workOrderId: "WO-2026-0045",
  },
  "PD-0046": {
    allowedScope: scope(
      ["/OwlAgents/Sources/PRJ-002"],
      ["sources.read", "sources.scan"],
      ["sources.delete"],
      0.5
    ),
    createdAt: "2026-07-28T13:44:08.000Z",
    evaluatedRuleIds: ["POL-002"],
    id: "PD-0046",
    policyVersion: 2,
    reasons: ["Classification only, no writes outside the intake lane."],
    requestedScope: scope(
      ["/OwlAgents/Sources/PRJ-002"],
      ["sources.read", "sources.scan"],
      [],
      0.5
    ),
    requiresOperatorApproval: false,
    result: "allowed",
    workOrderId: "WO-2026-0046",
  },
  "PD-0047": {
    allowedScope: scope(
      ["/artifacts"],
      ["artifacts.write", "tests.run"],
      ["repo.merge", "deploy.prod"],
      2
    ),
    createdAt: "2026-07-28T13:58:30.000Z",
    evaluatedRuleIds: ["POL-001"],
    id: "PD-0047",
    policyVersion: 4,
    reasons: [
      "Execution scope touches runtime service code.",
      "Operator must approve bounded execution before anything runs.",
    ],
    requestedScope: scope(
      ["/artifacts", "/derived"],
      ["artifacts.write", "tests.run"],
      [],
      2
    ),
    requiresOperatorApproval: true,
    result: "needs_approval",
    workOrderId: "WO-2026-0047",
  },
  "PD-0050": {
    allowedScope: scope(
      ["/artifacts"],
      ["artifacts.write", "tests.run"],
      ["repo.merge"],
      2.5
    ),
    createdAt: "2026-07-28T11:02:00.000Z",
    evaluatedRuleIds: ["POL-001"],
    id: "PD-0050",
    policyVersion: 4,
    reasons: ["Allowed with review — the merge gate requires green tests."],
    requestedScope: scope(
      ["/artifacts"],
      ["artifacts.write", "tests.run"],
      [],
      2.5
    ),
    requiresOperatorApproval: false,
    result: "allowed",
    workOrderId: "WO-2026-0050",
  },
  "PD-0051": {
    allowedScope: scope(
      ["/OwlAgents/Sources/PRJ-001", "/OwlAgents/Evidence"],
      ["sources.read", "sources.scan", "evidence.write"],
      ["publish.external", "sources.delete"],
      1
    ),
    createdAt: "2026-07-28T13:44:00.000Z",
    evaluatedRuleIds: ["POL-002", "POL-004"],
    id: "PD-0051",
    policyVersion: 2,
    reasons: [
      "Bounded read-only source ingestion.",
      "No external calls beyond whitelisted domains.",
    ],
    requestedScope: scope(
      ["/OwlAgents/Sources/PRJ-001", "/OwlAgents/Evidence"],
      ["sources.read", "sources.scan", "evidence.write"],
      [],
      1
    ),
    requiresOperatorApproval: false,
    result: "allowed",
    workOrderId: "WO-2026-0051",
  },
};
