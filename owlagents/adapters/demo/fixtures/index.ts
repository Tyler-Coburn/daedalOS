import { DEMO_ARTIFACTS } from "owlagents/adapters/demo/fixtures/artifacts";
import { DEMO_MEMORY_CANDIDATES } from "owlagents/adapters/demo/fixtures/memory";
import { DEMO_PROJECTS } from "owlagents/adapters/demo/fixtures/projects";
import { DEMO_REVIEWS } from "owlagents/adapters/demo/fixtures/reviews";
import { DEMO_SOURCES } from "owlagents/adapters/demo/fixtures/sources";
import { DEMO_WORK_ORDERS } from "owlagents/adapters/demo/fixtures/workOrders";

export { DEMO_AGENTS } from "owlagents/adapters/demo/fixtures/agents";
export {
  DEMO_ARTIFACTS,
  DEMO_EVIDENCE,
  DEMO_RUNS,
} from "owlagents/adapters/demo/fixtures/artifacts";
export {
  DEMO_INCIDENTS,
  DEMO_MODEL_PROVIDERS,
  DEMO_SERVICES,
} from "owlagents/adapters/demo/fixtures/health";
export { DEMO_INTEGRATIONS } from "owlagents/adapters/demo/fixtures/integrations";
export { DEMO_LEDGER } from "owlagents/adapters/demo/fixtures/ledger";
export {
  DEMO_MEMORY_CANDIDATES,
  DEMO_WOVENSTEAD_RECORDS,
} from "owlagents/adapters/demo/fixtures/memory";
export {
  DEMO_POLICY_DECISIONS,
  DEMO_POLICY_RULES,
} from "owlagents/adapters/demo/fixtures/policy";
export { DEMO_PROJECTS } from "owlagents/adapters/demo/fixtures/projects";
export { DEMO_REVIEWS } from "owlagents/adapters/demo/fixtures/reviews";
export {
  DEMO_CONTEXT_PACKS,
  DEMO_SOURCES,
} from "owlagents/adapters/demo/fixtures/sources";
export { DEMO_WORK_ORDERS } from "owlagents/adapters/demo/fixtures/workOrders";

/**
 * Every deep link the static export pre-renders.
 *
 * `getStaticPaths` calls this at build time in Node, which is why nothing under
 * `owlagents/` may import React, styled-components or `next` —
 * `__tests__/owlagents/architecture.spec.ts` enforces that.
 */
export const listDemoDeepLinkPaths = (): readonly string[] => [
  ...Object.keys(DEMO_PROJECTS).map((id) => `/projects/${id}`),
  ...Object.keys(DEMO_WORK_ORDERS).map((id) => `/work-orders/${id}`),
  ...Object.keys(DEMO_REVIEWS).map((id) => `/reviews/${id}`),
  ...Object.keys(DEMO_ARTIFACTS).map((id) => `/artifacts/${id}`),
  ...Object.keys(DEMO_SOURCES).map((id) => `/sources/${id}`),
  ...Object.keys(DEMO_MEMORY_CANDIDATES).map((id) => `/memory/${id}`),
];

/**
 * The vertical slice, named so tests and documentation refer to one chain
 * rather than re-deriving it: source -> context pack -> work order -> policy
 * decision -> run -> artifact -> evidence -> review -> memory candidate.
 */
export const DEMO_VERTICAL_SLICE = {
  artifactId: "ART-0031",
  contextPackId: "PACK-0001",
  evidenceIds: ["EV-0031", "EV-0032"],
  memoryCandidateId: "MC-0036",
  policyDecisionId: "PD-0051",
  projectId: "PRJ-001",
  reviewId: "REV-2026-0186",
  runId: "RUN-0051",
  sourceId: "SRC-0142",
  workOrderId: "WO-2026-0051",
} as const;
