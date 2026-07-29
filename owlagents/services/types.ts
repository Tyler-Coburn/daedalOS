import { type CommandOutcome } from "owlagents/adapters/types";
import { type EnvironmentAuthority } from "owlagents/domain/authority";
import { type ServiceResult } from "owlagents/domain/outcome";
import { type ReviewDecision } from "owlagents/domain/reviewDecision";
import { type ScenarioCommand } from "owlagents/domain/snapshot";
import { type AttentionItem, type LedgerEvent } from "owlagents/domain/types";
import { type WorkOrderStatus } from "owlagents/domain/workOrderStatus";
import { type LedgerQuery } from "owlagents/selectors/ledger";

export type Committed = Promise<ServiceResult<CommandOutcome>>;

export type TransitionRequest = {
  actorId?: string;
  expectedVersion: number;
  id: string;
  /**
   * Optional. When absent the service derives one from the object, the target
   * and the expected version — so a double-click is a duplicate, but a retry
   * after a genuine failure is not.
   */
  idempotencyKey?: string;
  reason?: string;
  to: WorkOrderStatus;
};

export type ReviewDecisionRequest = {
  actorId?: string;
  /** What the operator was shown, not a fresh read of the artifact. */
  artifactHash: string;
  decision: ReviewDecision;
  expectedArtifactVersion: number;
  expectedVersion: number;
  id: string;
  idempotencyKey?: string;
  reason?: string;
};

export type MemoryRequest = {
  actorId?: string;
  expectedVersion: number;
  id: string;
  idempotencyKey?: string;
};

export type OwlAgentsServices = {
  environmentService: {
    getAuthority: () => EnvironmentAuthority;
  };
  ledgerService: {
    listEvents: (query?: LedgerQuery) => readonly LedgerEvent[];
  };
  memoryService: {
    approveCandidate: (request: MemoryRequest) => Committed;
    publishCandidate: (request: MemoryRequest) => Committed;
    stageCandidate: (request: MemoryRequest) => Committed;
  };
  missionControlService: {
    getAttentionItems: () => readonly AttentionItem[];
  };
  reviewService: {
    submitDecision: (request: ReviewDecisionRequest) => Committed;
  };
  scenarioService: {
    run: (command: ScenarioCommand) => Committed;
  };
  sourceService: {
    advanceIntake: (id: string) => Committed;
  };
  workOrderService: {
    requestTransition: (request: TransitionRequest) => Committed;
  };
};
