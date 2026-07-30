import {
  type AdapterCommand,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";
import { deriveAttentionItems } from "owlagents/selectors/missionControl";
import { selectLedger } from "owlagents/selectors/ledger";
import { type OwlAgentsServices } from "owlagents/services/types";

const PERMISSION_SCOPE: Record<AdapterCommand["kind"], string> = {
  "memory.approve": "memory.approve",
  "memory.publish": "memory.publish",
  "memory.stage": "memory.stage",
  "review.decide": "review.decide",
  "scenario.run": "scenario.run",
  "source.advanceIntake": "source.intake",
  "source.ingest": "source.intake",
  "workOrder.transition": "workorder.transition",
};

/**
 * Object + intent + expected version.
 *
 * A second click while the version is unchanged is a duplicate and is refused.
 * A retry after a genuine failure is not, because the failed attempt recorded
 * nothing; and a legitimate later attempt carries a new version.
 */
const defaultKey = (command: AdapterCommand): string => {
  switch (command.kind) {
    case "memory.approve":
    case "memory.publish":
    case "memory.stage":
      return `${command.kind}:${command.id}:${command.expectedVersion}`;
    case "review.decide":
      return `${command.kind}:${command.id}:${command.decision}:${command.expectedVersion}`;
    case "scenario.run":
      return `${command.kind}:${command.command}`;
    case "source.advanceIntake":
      return `${command.kind}:${command.id}`;
    case "source.ingest":
      return `${command.kind}:${command.projectId}:${command.hash}`;
    default:
      return `${command.kind}:${command.id}:${command.to}:${command.expectedVersion}`;
  }
};

/**
 * The only writers in the system.
 *
 * A component may request a transition; it may never assign a status. Every
 * call here returns a result the UI renders — including a refusal — and no
 * call reports success before the adapter has committed and appended a ledger
 * event.
 */
export const createServices = (
  adapter: OwlAgentsAdapter
): OwlAgentsServices => {
  const send = (
    command: AdapterCommand,
    options: { actorId?: string; idempotencyKey?: string } = {}
  ): ReturnType<OwlAgentsAdapter["applyCommand"]> =>
    adapter.applyCommand({
      actorId: options.actorId ?? "operator",
      command,
      idempotencyKey: options.idempotencyKey ?? defaultKey(command),
      permissionScope: PERMISSION_SCOPE[command.kind],
      requestedAt: 0,
    });

  return {
    environmentService: {
      getAuthority: () => adapter.getAuthority(),
    },
    ledgerService: {
      listEvents: (query = {}) => selectLedger(query)(adapter.readSnapshot()),
    },
    memoryService: {
      approveCandidate: (request) =>
        send(
          {
            expectedVersion: request.expectedVersion,
            id: request.id,
            kind: "memory.approve",
          },
          {
            actorId: request.actorId,
            idempotencyKey: request.idempotencyKey,
          }
        ),
      publishCandidate: (request) =>
        send(
          {
            expectedVersion: request.expectedVersion,
            id: request.id,
            kind: "memory.publish",
          },
          {
            actorId: request.actorId,
            idempotencyKey: request.idempotencyKey,
          }
        ),
      stageCandidate: (request) =>
        send(
          {
            expectedVersion: request.expectedVersion,
            id: request.id,
            kind: "memory.stage",
          },
          {
            actorId: request.actorId,
            idempotencyKey: request.idempotencyKey,
          }
        ),
    },
    missionControlService: {
      getAttentionItems: () => deriveAttentionItems(adapter.readSnapshot()),
    },
    reviewService: {
      submitDecision: (request) =>
        send(
          {
            artifactHash: request.artifactHash,
            decision: request.decision,
            expectedArtifactVersion: request.expectedArtifactVersion,
            expectedVersion: request.expectedVersion,
            id: request.id,
            kind: "review.decide",
            reason: request.reason,
          },
          {
            actorId: request.actorId,
            idempotencyKey: request.idempotencyKey,
          }
        ),
    },
    scenarioService: {
      run: (command) =>
        send(
          { command, kind: "scenario.run" },
          {
            idempotencyKey: `scenario:${command}:${adapter.readSnapshot().version}`,
          }
        ),
    },
    sourceService: {
      advanceIntake: (id) =>
        send(
          { id, kind: "source.advanceIntake" },
          {
            actorId: "runtime",
            idempotencyKey: `source.advanceIntake:${id}:${adapter.readSnapshot().version}`,
          }
        ),
      ingest: (request) =>
        send(
          {
            hash: request.hash,
            kind: "source.ingest",
            name: request.name,
            path: request.path,
            projectId: request.projectId,
            size: request.size,
          },
          // Keyed on the content hash: dropping the same bytes twice into the
          // same project is one intake, not two.
          {
            idempotencyKey: `source.ingest:${request.projectId}:${request.hash}`,
          }
        ),
    },
    workOrderService: {
      requestTransition: (request) =>
        send(
          {
            expectedVersion: request.expectedVersion,
            id: request.id,
            kind: "workOrder.transition",
            reason: request.reason,
            to: request.to,
          },
          {
            actorId: request.actorId,
            idempotencyKey: request.idempotencyKey,
          }
        ),
    },
  };
};
