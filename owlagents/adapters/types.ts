import { type EnvironmentAuthority } from "owlagents/domain/authority";
import { type ServiceResult } from "owlagents/domain/outcome";
import { type ReviewDecision } from "owlagents/domain/reviewDecision";
import {
  type OwlAgentsSnapshot,
  type ScenarioCommand,
} from "owlagents/domain/snapshot";
import { type WorkOrderStatus } from "owlagents/domain/workOrderStatus";

/**
 * Everything the UI can ask an adapter to change, as one closed union. A new
 * kind of mutation has to be added here first, which is what keeps components
 * from inventing their own writes.
 */
export type AdapterCommand =
  | {
      expectedVersion: number;
      id: string;
      kind: "memory.approve" | "memory.publish" | "memory.stage";
    }
  | {
      artifactHash: string;
      decision: ReviewDecision;
      expectedArtifactVersion: number;
      expectedVersion: number;
      id: string;
      kind: "review.decide";
      reason?: string;
    }
  | { command: ScenarioCommand; kind: "scenario.run" }
  | { id: string; kind: "source.advanceIntake" }
  | {
      expectedVersion: number;
      id: string;
      kind: "workOrder.transition";
      reason?: string;
      to: WorkOrderStatus;
    };

/**
 * The safe-transition payload. Every high-impact request carries all of it, so
 * the authoritative store can check state, version, permission, and whether an
 * identical request already committed.
 */
export type CommandEnvelope = {
  actorId: string;
  command: AdapterCommand;
  idempotencyKey: string;
  permissionScope: string;
  requestedAt: number;
};

export type CommandOutcome = {
  nextState?: string;
  objectId: string;
  objectType: string;
};

/**
 * The operational repository port.
 *
 * `DemoOperationalAdapter` is the default. `local` is the intended authority,
 * `remote` and `supabase` are optional companions. None of them may own policy
 * decisions, review approval or Wovenstead publication beyond what the domain
 * layer already validates.
 */
export type OwlAgentsAdapter = {
  applyCommand: (
    envelope: CommandEnvelope
  ) => Promise<ServiceResult<CommandOutcome>>;
  getAuthority: () => EnvironmentAuthority;
  id: string;
  readSnapshot: () => OwlAgentsSnapshot;
  subscribe: (listener: () => void) => () => void;
};

type HealthResult = {
  credentialState: string;
  latencyMs?: number;
  reachable: boolean;
  reason?: string;
};

type IntegrationDescriptor = {
  capabilities: readonly string[];
  id: string;
  mode: "demo" | "live";
  name: string;
  readScopes: readonly string[];
  type: string;
  writeScopes: readonly string[];
};

type ReadRequest = { scope: string };

type ReadResult =
  | { data: unknown; ok: true }
  | { ok: false; reason: "scope_denied" | "unavailable" };

type WriteRequest = {
  /** A write is impossible without the decision that approved it. */
  policyDecisionId: string;
  scope: string;
  value: unknown;
  workOrderId: string;
};

type WriteResult =
  | { cost?: number; ok: true }
  | { ok: false; reason: "policy_required" | "scope_denied" | "unavailable" };

/**
 * The integration port. A `write` method exists only when the integration is
 * meant to write, and every call carries the approving policy decision and
 * work-order id. Adapters return credential *state*, never credentials.
 *
 * No implementation exists yet — this is the boundary the first live
 * integration (Ollama, then the local filesystem) will be built against, so it
 * is exported deliberately rather than pruned.
 */
// ts-prune-ignore-next
export type IntegrationAdapter = {
  check: () => Promise<HealthResult>;
  describe: () => IntegrationDescriptor;
  id: string;
  read: (request: ReadRequest) => Promise<ReadResult>;
  write?: (request: WriteRequest) => Promise<WriteResult>;
};
