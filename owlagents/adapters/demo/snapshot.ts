import {
  DEMO_AGENTS,
  DEMO_ARTIFACTS,
  DEMO_CONTEXT_PACKS,
  DEMO_EVIDENCE,
  DEMO_INCIDENTS,
  DEMO_INTEGRATIONS,
  DEMO_LEDGER,
  DEMO_MEMORY_CANDIDATES,
  DEMO_MODEL_PROVIDERS,
  DEMO_POLICY_DECISIONS,
  DEMO_POLICY_RULES,
  DEMO_PROJECTS,
  DEMO_REVIEWS,
  DEMO_RUNS,
  DEMO_SERVICES,
  DEMO_SOURCES,
  DEMO_WORK_ORDERS,
  DEMO_WOVENSTEAD_RECORDS,
} from "owlagents/adapters/demo/fixtures";
import { DEMO_SESSION_STARTED_AT } from "owlagents/adapters/demo/fixtures/common";
import { describeEnvironment } from "owlagents/domain/authority";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";

/**
 * Builds the initial demo snapshot.
 *
 * Deterministic by construction: no `Date.now()`, no randomness. `reset` calls
 * this and must produce a value deep-equal to the first one, which
 * `__tests__/owlagents/adapters/scenarios.spec.ts` asserts.
 */
export const createDemoSnapshot = (): OwlAgentsSnapshot => ({
  agents: { ...DEMO_AGENTS },
  artifacts: { ...DEMO_ARTIFACTS },
  contextPacks: { ...DEMO_CONTEXT_PACKS },
  environment: describeEnvironment("DEMO"),
  evidence: { ...DEMO_EVIDENCE },
  incidents: [...DEMO_INCIDENTS],
  integrations: { ...DEMO_INTEGRATIONS },
  ledger: [...DEMO_LEDGER],
  memoryCandidates: { ...DEMO_MEMORY_CANDIDATES },
  modelProviders: [...DEMO_MODEL_PROVIDERS],
  policyDecisions: { ...DEMO_POLICY_DECISIONS },
  policyRules: { ...DEMO_POLICY_RULES },
  projects: { ...DEMO_PROJECTS },
  reviews: { ...DEMO_REVIEWS },
  runs: { ...DEMO_RUNS },
  scenario: { history: [], step: 0 },
  services: [...DEMO_SERVICES],
  sessionStartedAt: DEMO_SESSION_STARTED_AT,
  sources: { ...DEMO_SOURCES },
  version: 1,
  workOrders: { ...DEMO_WORK_ORDERS },
  wovensteadRecords: { ...DEMO_WOVENSTEAD_RECORDS },
});
