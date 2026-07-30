import { type EnvironmentAuthority } from "owlagents/domain/authority";
import {
  type ArtifactId,
  type ContextPackId,
  type EvidenceId,
  type IntegrationId,
  type IsoTimestamp,
  type MemoryCandidateId,
  type PolicyDecisionId,
  type PolicyRuleId,
  type ProjectId,
  type ReviewId,
  type RunId,
  type SourceId,
  type WorkOrderId,
  type WovensteadRecordId,
} from "owlagents/domain/ids";
import {
  type Agent,
  type Artifact,
  type ContextPack,
  type EvidenceItem,
  type ExecutionRun,
  type Incident,
  type Integration,
  type LedgerEvent,
  type MemoryCandidate,
  type ModelProvider,
  type PolicyDecision,
  type PolicyRule,
  type Project,
  type Review,
  type ServiceHealth,
  type Source,
  type WorkOrder,
  type WovensteadRecord,
} from "owlagents/domain/types";

/** Named demo controls, so nothing advances behind the operator's back. */
export const SCENARIO_COMMANDS = [
  "advance",
  "reset",
  "simulateBlockage",
  "simulateDeniedPermission",
  "simulateStaleReview",
] as const;

export type ScenarioCommand = (typeof SCENARIO_COMMANDS)[number];

export const SCENARIO_LABELS: Record<ScenarioCommand, string> = {
  advance: "Advance scenario",
  reset: "Reset scenario",
  simulateBlockage: "Simulate blockage",
  simulateDeniedPermission: "Simulate denied permission",
  simulateStaleReview: "Simulate stale review",
};

type ScenarioState = {
  /** Human-readable trace of what the operator triggered, newest last. */
  history: readonly string[];
  step: number;
};

/**
 * The single immutable value every selector reads. Replaced wholesale on each
 * commit, never mutated, so `useSyncExternalStore` can compare by identity.
 */
export type OwlAgentsSnapshot = {
  agents: Readonly<Record<string, Agent>>;
  artifacts: Readonly<Record<ArtifactId, Artifact>>;
  /**
   * What this operator is allowed to see and do. Applications declare
   * `requiredCapabilities` in the registry and are refused when one is absent —
   * the refusal is visible, not a blank window.
   */
  capabilities: readonly string[];
  contextPacks: Readonly<Record<ContextPackId, ContextPack>>;
  environment: EnvironmentAuthority;
  evidence: Readonly<Record<EvidenceId, EvidenceItem>>;
  incidents: readonly Incident[];
  integrations: Readonly<Record<IntegrationId, Integration>>;
  /** Append-only, newest first. */
  ledger: readonly LedgerEvent[];
  memoryCandidates: Readonly<Record<MemoryCandidateId, MemoryCandidate>>;
  modelProviders: readonly ModelProvider[];
  policyDecisions: Readonly<Record<PolicyDecisionId, PolicyDecision>>;
  policyRules: Readonly<Record<PolicyRuleId, PolicyRule>>;
  projects: Readonly<Record<ProjectId, Project>>;
  reviews: Readonly<Record<ReviewId, Review>>;
  runs: Readonly<Record<RunId, ExecutionRun>>;
  scenario: ScenarioState;
  services: readonly ServiceHealth[];
  /** Boundary for the "since your last session" briefing. */
  sessionStartedAt: IsoTimestamp;
  sources: Readonly<Record<SourceId, Source>>;
  /** Bumped on every commit; the optimistic-concurrency clock. */
  version: number;
  workOrders: Readonly<Record<WorkOrderId, WorkOrder>>;
  wovensteadRecords: Readonly<Record<WovensteadRecordId, WovensteadRecord>>;
};
