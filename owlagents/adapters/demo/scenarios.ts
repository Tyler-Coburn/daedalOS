import { DEMO_VERTICAL_SLICE } from "owlagents/adapters/demo/fixtures";
import {
  applyCommandToSnapshot,
  type ReducerContext,
} from "owlagents/adapters/demo/reducer";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import { type AdapterCommand } from "owlagents/adapters/types";
import {
  SCENARIO_LABELS,
  type OwlAgentsSnapshot,
  type ScenarioCommand,
} from "owlagents/domain/snapshot";

/** Every scope an operator holds by default in the demo environment. */
export const DEMO_OPERATOR_SCOPES: readonly string[] = [
  "memory.approve",
  "memory.publish",
  "memory.stage",
  "review.decide",
  "source.intake",
  "workorder.transition",
];

type ScenarioResult = {
  scopes: ReadonlySet<string>;
  snapshot: OwlAgentsSnapshot;
};

const run = (
  snapshot: OwlAgentsSnapshot,
  command: AdapterCommand,
  context: ReducerContext
): OwlAgentsSnapshot =>
  applyCommandToSnapshot(
    snapshot,
    {
      actorId: "operator",
      command,
      idempotencyKey: `scenario-${snapshot.version}-${command.kind}`,
      permissionScope:
        command.kind === "review.decide"
          ? "review.decide"
          : command.kind === "workOrder.transition"
            ? "workorder.transition"
            : command.kind === "source.advanceIntake"
              ? "source.intake"
              : command.kind,
      requestedAt: 0,
    },
    context
  ).snapshot;

/**
 * One scripted step of the vertical slice, driven by an explicit operator
 * action — never by a hidden timer. Each step goes through the same reducer the
 * UI uses, so an illegal step is refused here too.
 */
const advanceSlice = (
  snapshot: OwlAgentsSnapshot,
  context: ReducerContext
): OwlAgentsSnapshot => {
  const workOrder = snapshot.workOrders[DEMO_VERTICAL_SLICE.workOrderId];
  const review = snapshot.reviews[DEMO_VERTICAL_SLICE.reviewId];
  const candidate =
    snapshot.memoryCandidates[DEMO_VERTICAL_SLICE.memoryCandidateId];

  if (workOrder?.status === "running") {
    return run(
      snapshot,
      {
        expectedVersion: workOrder.version,
        id: workOrder.id,
        kind: "workOrder.transition",
        reason: "Scenario: output produced",
        to: "artifact_ready",
      },
      context
    );
  }
  if (workOrder?.status === "artifact_ready") {
    return run(
      snapshot,
      {
        expectedVersion: workOrder.version,
        id: workOrder.id,
        kind: "workOrder.transition",
        reason: "Scenario: artifact registered",
        to: "review_pending",
      },
      context
    );
  }
  if (review?.status === "pending") {
    // Submit what the review pinned, so a revised artifact is caught here too.
    return run(
      snapshot,
      {
        artifactHash: review.expectedArtifactHash,
        decision: "approve",
        expectedArtifactVersion: review.expectedArtifactVersion,
        expectedVersion: review.version,
        id: review.id,
        kind: "review.decide",
        reason: "Scenario: operator approves the brief",
      },
      context
    );
  }
  if (workOrder?.status === "review_pending") {
    return run(
      snapshot,
      {
        expectedVersion: workOrder.version,
        id: workOrder.id,
        kind: "workOrder.transition",
        reason: "Scenario: review approved",
        to: "completed",
      },
      context
    );
  }
  if (candidate?.status === "candidate") {
    return run(
      snapshot,
      {
        expectedVersion: candidate.version,
        id: candidate.id,
        kind: "memory.approve",
      },
      context
    );
  }
  if (candidate?.status === "approved") {
    return run(
      snapshot,
      {
        expectedVersion: candidate.version,
        id: candidate.id,
        kind: "memory.stage",
      },
      context
    );
  }
  if (candidate?.status === "staged") {
    return run(
      snapshot,
      {
        expectedVersion: candidate.version,
        id: candidate.id,
        kind: "memory.publish",
      },
      context
    );
  }

  return snapshot;
};

const withScenarioNote = (
  snapshot: OwlAgentsSnapshot,
  note: string
): OwlAgentsSnapshot => ({
  ...snapshot,
  scenario: {
    history: [...snapshot.scenario.history, note],
    step: snapshot.scenario.step + 1,
  },
});

export const runScenario = (
  snapshot: OwlAgentsSnapshot,
  command: ScenarioCommand,
  scopes: ReadonlySet<string>,
  context: ReducerContext
): ScenarioResult => {
  const note = SCENARIO_LABELS[command];

  if (command === "reset") {
    return {
      scopes: new Set(DEMO_OPERATOR_SCOPES),
      snapshot: createDemoSnapshot(),
    };
  }

  if (command === "advance") {
    return {
      scopes,
      snapshot: withScenarioNote(advanceSlice(snapshot, context), note),
    };
  }

  if (command === "simulateDeniedPermission") {
    const reduced = new Set(scopes);

    reduced.delete("memory.publish");

    return { scopes: reduced, snapshot: withScenarioNote(snapshot, note) };
  }

  if (command === "simulateBlockage") {
    const workOrder = snapshot.workOrders[DEMO_VERTICAL_SLICE.workOrderId];

    if (workOrder?.status !== "running") {
      return {
        scopes,
        snapshot: withScenarioNote(snapshot, `${note} — not applicable`),
      };
    }

    const blocked = run(
      snapshot,
      {
        expectedVersion: workOrder.version,
        id: workOrder.id,
        kind: "workOrder.transition",
        reason: "Scenario: provider returned 429 LIMIT_HIT",
        to: "blocked",
      },
      context
    );
    const updated = blocked.workOrders[workOrder.id];

    return {
      scopes,
      snapshot: withScenarioNote(
        updated
          ? {
              ...blocked,
              workOrders: {
                ...blocked.workOrders,
                [workOrder.id]: {
                  ...updated,
                  blockedReason:
                    "Provider gateway returned 429 LIMIT_HIT. Surfaced to the operator; retry requires an explicit command.",
                },
              },
            }
          : blocked,
        note
      ),
    };
  }

  // simulateStaleReview — move the artifact underneath the open review.
  const artifact = snapshot.artifacts[DEMO_VERTICAL_SLICE.artifactId];

  if (!artifact) {
    return {
      scopes,
      snapshot: withScenarioNote(snapshot, `${note} — not applicable`),
    };
  }

  return {
    scopes,
    snapshot: withScenarioNote(
      {
        ...snapshot,
        artifacts: {
          ...snapshot.artifacts,
          [artifact.id]: {
            ...artifact,
            hash: `${artifact.hash.slice(0, 28)}ffff`,
            previousContent: artifact.content,
            version: artifact.version + 1,
          },
        },
        ledger: [
          {
            actorId: "Athena",
            actorType: "agent",
            eventType: "artifact.revised",
            id: context.nextEventId(),
            message: `${artifact.id} was revised to v${artifact.version + 1}. Open reviews against v${artifact.version} are now stale.`,
            objectId: artifact.id,
            objectType: "artifact",
            projectId: artifact.projectId,
            severity: "warning",
            system: "OWL",
            timestamp: context.now(),
          },
          ...snapshot.ledger,
        ],
        version: snapshot.version + 1,
      },
      note
    ),
  };
};
