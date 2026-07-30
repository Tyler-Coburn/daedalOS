import {
  type AuthorityLevel,
  type IntakeStage,
  type IntegrationState,
} from "owlagents/domain/authority";
import {
  type ArtifactId,
  type ContextPackId,
  type EvidenceId,
  type IncidentId,
  type IntegrationId,
  type IsoTimestamp,
  type LedgerEventId,
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
import { type MemoryState } from "owlagents/domain/memoryLifecycle";
import {
  type ReviewDecision,
  type ReviewState,
} from "owlagents/domain/reviewDecision";
import { type WorkOrderStatus } from "owlagents/domain/workOrderStatus";

/** The four product layers. Never merged, never renamed. */
export type SystemLayer = "OLY" | "OWL" | "SYS" | "WOV";

export type Money = {
  amount: number;
  currency: "USD";
};

/**
 * Stage-based progress. There is no percentage field on purpose: open-ended AI
 * work has no honest denominator, so we name the step instead.
 */
export type StageProgress = {
  index: number;
  steps: readonly string[];
};

export type ExecutionScope = {
  costLimit: Money;
  denied: readonly string[];
  paths: readonly string[];
  permissions: readonly string[];
};

export type Project = {
  activeWorkOrderIds: readonly WorkOrderId[];
  blockers: readonly string[];
  costToDate: Money;
  createdAt: IsoTimestamp;
  health: "at_risk" | "blocked" | "healthy";
  id: ProjectId;
  lockedDecisions: readonly string[];
  name: string;
  nextActions: readonly string[];
  phase: "Build" | "Design" | "Plan" | "Research" | "Stabilize";
  purpose: string;
  sourceOfTruth: string;
  stage: StageProgress;
  updatedAt: IsoTimestamp;
};

export type Source = {
  authority: AuthorityLevel;
  hash: string;
  hashAlgorithm: "sha256";
  id: SourceId;
  ingestedAt: IsoTimestamp;
  ingestedBy: string;
  intakeFailureReason?: string;
  intakeStage: IntakeStage;
  mount: "READ-ONLY" | "STAGING · RW";
  name: string;
  originalLocation: string;
  /** Projection of the domain object onto the virtual filesystem. */
  path: string;
  preservedLocation: string;
  projectId: ProjectId;
  referencedByWorkOrderIds: readonly WorkOrderId[];
  size: number;
  type: string;
};

export type ContextPack = {
  constraints: readonly string[];
  createdAt: IsoTimestamp;
  createdBy: string;
  hash: string;
  id: ContextPackId;
  instructions: string;
  lockedDecisions: readonly string[];
  projectId: ProjectId;
  sourceIds: readonly SourceId[];
  title: string;
  version: number;
};

export type PolicyRule = {
  allow: readonly string[];
  deny: readonly string[];
  gate: string;
  id: PolicyRuleId;
  name: string;
  note: string;
  owner: string;
  scope: string;
  status: "active" | "draft" | "retired";
  version: number;
};

export type PolicyDecision = {
  allowedScope: ExecutionScope;
  createdAt: IsoTimestamp;
  evaluatedRuleIds: readonly PolicyRuleId[];
  id: PolicyDecisionId;
  policyVersion: number;
  reasons: readonly string[];
  requestedScope: ExecutionScope;
  requiresOperatorApproval: boolean;
  result: "allowed" | "denied" | "needs_approval";
  workOrderId: WorkOrderId;
};

export type ExecutionRun = {
  attempt: number;
  cost: Money;
  endedAt?: IsoTimestamp;
  error?: string;
  id: RunId;
  model: string;
  outputArtifactIds: readonly ArtifactId[];
  provider: string;
  runtime: string;
  startedAt: IsoTimestamp;
  status: "blocked" | "cancelled" | "completed" | "running";
  tokenUsage: number;
  workOrderId: WorkOrderId;
};

export type WorkOrder = {
  actualCost: Money;
  agentId?: string;
  approvedScope?: ExecutionScope;
  artifactIds: readonly ArtifactId[];
  blockedReason?: string;
  completedAt?: IsoTimestamp;
  contextPackId?: ContextPackId;
  createdAt: IsoTimestamp;
  description: string;
  estimatedCost: Money;
  evidenceIds: readonly EvidenceId[];
  id: WorkOrderId;
  lane: string;
  policyDecisionId?: PolicyDecisionId;
  priority: "high" | "low" | "normal" | "urgent";
  projectId: ProjectId;
  requestedBy: string;
  requestedScope: ExecutionScope;
  reviewIds: readonly ReviewId[];
  risk: "high" | "low" | "medium";
  runIds: readonly RunId[];
  sourceIds: readonly SourceId[];
  stage: StageProgress;
  status: WorkOrderStatus;
  title: string;
  updatedAt: IsoTimestamp;
  version: number;
};

export type Artifact = {
  authority: AuthorityLevel;
  content: string;
  createdAt: IsoTimestamp;
  createdBy: string;
  evidenceIds: readonly EvidenceId[];
  hash: string;
  id: ArtifactId;
  language: string;
  mimeType: string;
  name: string;
  path: string;
  previousContent?: string;
  projectId: ProjectId;
  reviewIds: readonly ReviewId[];
  supersedesArtifactId?: ArtifactId;
  type: string;
  version: number;
  workOrderId: WorkOrderId;
};

export type EvidenceItem = {
  artifactId?: ArtifactId;
  createdAt: IsoTimestamp;
  createdBy: string;
  description: string;
  hash: string;
  id: EvidenceId;
  location: string;
  projectId: ProjectId;
  sourceId?: SourceId;
  type: "citation" | "excerpt" | "measurement" | "test_result";
  workOrderId: WorkOrderId;
};

export type Review = {
  artifactIds: readonly ArtifactId[];
  changeSummary: string;
  decision?: ReviewDecision;
  decisionReason?: string;
  destination: string;
  evidenceIds: readonly EvidenceId[];
  expectedArtifactHash: string;
  expectedArtifactVersion: number;
  expectedVersion: number;
  id: ReviewId;
  policyResult: string;
  projectId: ProjectId;
  rationale: string;
  requestedAt: IsoTimestamp;
  requestedBy: string;
  reviewedAt?: IsoTimestamp;
  reviewedBy?: string;
  risk: "high" | "low" | "medium";
  sourceIds: readonly SourceId[];
  status: ReviewState;
  title: string;
  type: string;
  version: number;
  workOrderId: WorkOrderId;
};

export type MemoryCandidate = {
  approvedAt?: IsoTimestamp;
  comparison: string;
  conflicts: readonly string[];
  draftContent: string;
  existingRecordId?: WovensteadRecordId;
  id: MemoryCandidateId;
  projectId: ProjectId;
  publishedAt?: IsoTimestamp;
  publishedBy?: string;
  sourceArtifactIds: readonly ArtifactId[];
  sourceWorkOrderId: WorkOrderId;
  stagedAt?: IsoTimestamp;
  status: MemoryState;
  title: string;
  version: number;
};

type Provenance = {
  artifactId?: ArtifactId;
  candidateId?: MemoryCandidateId;
  contextPackId?: ContextPackId;
  evidenceIds: readonly EvidenceId[];
  reviewId?: ReviewId;
  sourceIds: readonly SourceId[];
  workOrderId?: WorkOrderId;
};

export type WovensteadRecord = {
  authority: AuthorityLevel;
  content: string;
  hash: string;
  id: WovensteadRecordId;
  projectId: ProjectId;
  provenance: Provenance;
  publishedAt: IsoTimestamp;
  publishedBy: string;
  supersededAt?: IsoTimestamp;
  supersededByRecordId?: WovensteadRecordId;
  title: string;
  version: number;
};

export type LedgerEvent = {
  actorId: string;
  actorType: "agent" | "operator" | "policy" | "runtime";
  correlationId?: string;
  eventType: string;
  id: LedgerEventId;
  idempotencyKey?: string;
  message: string;
  nextState?: string;
  objectId: string;
  objectType: string;
  previousState?: string;
  projectId?: ProjectId;
  severity: "error" | "info" | "success" | "warning";
  system: SystemLayer;
  timestamp: IsoTimestamp;
};

/** The subset a transition appends. Mapped into a full `LedgerEvent`. */
export type LedgerAppend = {
  actorId: string;
  actorType: LedgerEvent["actorType"];
  eventType: string;
  idempotencyKey?: string;
  message: string;
  nextState?: string;
  objectId: string;
  objectType: string;
  previousState?: string;
  projectId?: ProjectId;
  severity: LedgerEvent["severity"];
  system: SystemLayer;
};

export type Integration = {
  costStatus: string;
  credentialStatus: string;
  error?: string;
  id: IntegrationId;
  lastCheckedAt?: IsoTimestamp;
  lastSuccessfulSyncAt?: IsoTimestamp;
  latencyMs?: number;
  name: string;
  readScopes: readonly string[];
  state: IntegrationState;
  type: string;
  writeScopes: readonly string[];
};

export type Incident = {
  detail: string;
  id: IncidentId;
  openedAt: IsoTimestamp;
  severity: "critical" | "major" | "minor";
  system: SystemLayer;
  title: string;
};

export type ServiceHealth = {
  detail: string;
  id: string;
  latencyMs?: number;
  name: string;
  queueDepth: number;
  state: IntegrationState;
};

export type Agent = {
  currentTaskId?: WorkOrderId;
  deniedTools: readonly string[];
  id: string;
  lane: string;
  model: string;
  name: string;
  queuedTaskIds: readonly WorkOrderId[];
  recentLog: readonly string[];
  role: string;
  status: "blocked" | "idle" | "waiting" | "working";
  system: "OLY" | "OWL";
  tools: readonly string[];
};

export type ModelProvider = {
  contextWindow: number;
  id: string;
  latencyMs?: number;
  name: string;
  provider: string;
  role: string;
  state: IntegrationState;
};

/**
 * Derived, never stored. An attention item exists only while the condition that
 * produced it is still true, which is why it carries the object reference
 * rather than a pre-rendered sentence.
 */
export type AttentionItem = {
  detail: string;
  id: string;
  kind: "approval" | "blocked" | "cost" | "memory" | "review";
  objectId: string;
  objectType: "integration" | "memory" | "project" | "review" | "workOrder";
  projectId?: ProjectId;
  risk: "high" | "low" | "medium";
  title: string;
};
