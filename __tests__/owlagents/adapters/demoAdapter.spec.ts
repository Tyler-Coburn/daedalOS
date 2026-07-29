import { createDemoAdapter } from "owlagents/adapters/demo";
import { DEMO_VERTICAL_SLICE } from "owlagents/adapters/demo/fixtures";
import {
  type AdapterCommand,
  type CommandEnvelope,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";

const NOW = "2026-07-28T15:00:00.000Z";

const envelope = (
  command: AdapterCommand,
  overrides: Partial<CommandEnvelope> = {}
): CommandEnvelope => ({
  actorId: "operator",
  command,
  idempotencyKey: `key-${JSON.stringify(command)}`,
  permissionScope:
    command.kind === "review.decide"
      ? "review.decide"
      : command.kind === "workOrder.transition"
        ? "workorder.transition"
        : command.kind,
  requestedAt: 0,
  ...overrides,
});

const setup = (): OwlAgentsAdapter => createDemoAdapter({ now: () => NOW });

describe("work order transitions", () => {
  test("a legal transition commits, bumps the version and appends one event", async () => {
    const adapter = setup();
    const before = adapter.readSnapshot();
    const workOrder = before.workOrders["WO-2026-0047"];
    const result = await adapter.applyCommand(
      envelope({
        expectedVersion: workOrder?.version ?? 0,
        id: "WO-2026-0047",
        kind: "workOrder.transition",
        to: "queued",
      })
    );
    const after = adapter.readSnapshot();

    expect(result.ok).toBe(true);
    expect(after.workOrders["WO-2026-0047"]?.status).toBe("queued");
    expect(after.workOrders["WO-2026-0047"]?.version).toBe(
      (workOrder?.version ?? 0) + 1
    );
    expect(after.ledger).toHaveLength(before.ledger.length + 1);
    expect(after.ledger[0]?.previousState).toBe("approval_required");
    expect(after.ledger[0]?.nextState).toBe("queued");
  });

  test("an illegal transition is refused and nothing changes", async () => {
    const adapter = setup();
    const before = adapter.readSnapshot();
    const result = await adapter.applyCommand(
      envelope({
        expectedVersion: before.workOrders["WO-2026-0043"]?.version ?? 0,
        id: "WO-2026-0043",
        kind: "workOrder.transition",
        to: "completed",
      })
    );
    const after = adapter.readSnapshot();

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("stale_state");
    expect(after.workOrders["WO-2026-0043"]?.status).toBe("draft");
    expect(after.ledger).toHaveLength(before.ledger.length);
  });

  test("a stale expected version is refused", async () => {
    const adapter = setup();
    const result = await adapter.applyCommand(
      envelope({
        expectedVersion: 999,
        id: "WO-2026-0043",
        kind: "workOrder.transition",
        to: "policy_pending",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("stale_version");
  });

  test("a missing permission scope is refused before any state is read", async () => {
    const adapter = setup();
    const result = await adapter.applyCommand(
      envelope(
        {
          expectedVersion: 1,
          id: "WO-2026-0043",
          kind: "workOrder.transition",
          to: "policy_pending",
        },
        { permissionScope: "workorder.nonsense" }
      )
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("permission_denied");
  });

  test("a repeated idempotency key is reported and never applied twice", async () => {
    const adapter = setup();
    const command: AdapterCommand = {
      expectedVersion:
        adapter.readSnapshot().workOrders["WO-2026-0043"]?.version ?? 0,
      id: "WO-2026-0043",
      kind: "workOrder.transition",
      to: "policy_pending",
    };

    const first = await adapter.applyCommand(
      envelope(command, { idempotencyKey: "same-key" })
    );
    const ledgerAfterFirst = adapter.readSnapshot().ledger.length;
    const second = await adapter.applyCommand(
      envelope(command, { idempotencyKey: "same-key" })
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.ok ? undefined : second.error.code).toBe("duplicate_request");
    expect(adapter.readSnapshot().ledger).toHaveLength(ledgerAfterFirst);
  });

  test("a blocked order retries to queued rather than straight to running", async () => {
    const adapter = setup();
    const version =
      adapter.readSnapshot().workOrders["WO-2026-0050"]?.version ?? 0;

    const straightToRunning = await adapter.applyCommand(
      envelope({
        expectedVersion: version,
        id: "WO-2026-0050",
        kind: "workOrder.transition",
        to: "running",
      })
    );
    const toQueued = await adapter.applyCommand(
      envelope({
        expectedVersion: version,
        id: "WO-2026-0050",
        kind: "workOrder.transition",
        to: "queued",
      })
    );

    expect(straightToRunning.ok).toBe(false);
    expect(toQueued.ok).toBe(true);
  });
});

/**
 * Approves the slice review the way the UI would: the operator submits what
 * they were shown, which is what the review pinned — not a fresh read of an
 * artifact that may have moved since.
 */
const decideCurrentReview = (
  adapter: OwlAgentsAdapter
): ReturnType<OwlAgentsAdapter["applyCommand"]> => {
  const review = adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId];

  return adapter.applyCommand(
    envelope({
      artifactHash: review?.expectedArtifactHash ?? "",
      decision: "approve",
      expectedArtifactVersion: review?.expectedArtifactVersion ?? 0,
      expectedVersion: review?.version ?? 0,
      id: DEMO_VERTICAL_SLICE.reviewId,
      kind: "review.decide",
    })
  );
};

/** Promotes a candidate one step, reading its current version each time. */
const promote = (
  adapter: OwlAgentsAdapter,
  kind: "memory.approve" | "memory.publish" | "memory.stage",
  id: string = DEMO_VERTICAL_SLICE.memoryCandidateId
): ReturnType<OwlAgentsAdapter["applyCommand"]> =>
  adapter.applyCommand(
    envelope(
      {
        expectedVersion:
          adapter.readSnapshot().memoryCandidates[id]?.version ?? 0,
        id,
        kind,
      },
      { idempotencyKey: `${kind}-${id}-${adapter.readSnapshot().version}` }
    )
  );

describe("review safety", () => {
  test("a current review can be approved", async () => {
    const adapter = setup();
    const result = await decideCurrentReview(adapter);

    expect(result.ok).toBe(true);
    expect(
      adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId]?.status
    ).toBe("approved");
  });

  test("a changed artifact hash makes the review stale and blocks approval", async () => {
    const adapter = setup();

    await adapter.applyCommand(
      envelope({ command: "simulateStaleReview", kind: "scenario.run" })
    );

    const result = await decideCurrentReview(adapter);
    const review = adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId];

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("stale_version");
    expect(review?.status).toBe("stale");
    expect(review?.decision).toBeUndefined();
  });

  test("a stale review explains why and preserves its history", async () => {
    const adapter = setup();

    await adapter.applyCommand(
      envelope({ command: "simulateStaleReview", kind: "scenario.run" })
    );

    const result = await decideCurrentReview(adapter);
    const snapshot = adapter.readSnapshot();

    expect(result.ok ? undefined : result.error.detail).toContain(
      "artifact_hash_changed"
    );
    expect(snapshot.ledger[0]?.eventType).toBe("review.stale");
    expect(snapshot.reviews[DEMO_VERTICAL_SLICE.reviewId]?.requestedBy).toBe(
      "Hermes · Olympus Runtime"
    );
  });

  test("an already-decided review cannot be decided again", async () => {
    const adapter = setup();

    await decideCurrentReview(adapter);

    const second = await adapter.applyCommand(
      envelope(
        {
          artifactHash:
            adapter.readSnapshot().artifacts[DEMO_VERTICAL_SLICE.artifactId]
              ?.hash ?? "",
          decision: "reject",
          expectedArtifactVersion: 2,
          expectedVersion:
            adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId]
              ?.version ?? 0,
          id: DEMO_VERTICAL_SLICE.reviewId,
          kind: "review.decide",
        },
        { idempotencyKey: "second-decision" }
      )
    );

    expect(second.ok).toBe(false);
    expect(second.ok ? undefined : second.error.code).toBe("stale_state");
  });
});

describe("wovenstead publication gate", () => {
  test("a candidate cannot be staged before it is approved", async () => {
    const result = await promote(setup(), "memory.stage");

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("stale_state");
  });

  test("a candidate cannot be published", async () => {
    const result = await promote(setup(), "memory.publish");

    expect(result.ok).toBe(false);
  });

  test("an approved candidate cannot be published without staging", async () => {
    const adapter = setup();

    await promote(adapter, "memory.approve");

    const result = await promote(adapter, "memory.publish");

    expect(result.ok).toBe(false);
    expect(adapter.readSnapshot().memoryCandidates["MC-0036"]?.status).toBe(
      "approved"
    );
  });

  test("an approved candidate can be staged, and a staged one published", async () => {
    const adapter = setup();

    await promote(adapter, "memory.approve");

    expect((await promote(adapter, "memory.stage")).ok).toBe(true);
    expect((await promote(adapter, "memory.publish")).ok).toBe(true);
    expect(adapter.readSnapshot().memoryCandidates["MC-0036"]?.status).toBe(
      "published"
    );
  });

  test("a rejected candidate can never be staged", async () => {
    const adapter = setup();
    const result = await promote(adapter, "memory.stage", "MC-0033");

    // MC-0033 is approved, so staging is legal; MC-0031 is a plain candidate.
    expect(result.ok).toBe(true);
    expect((await promote(adapter, "memory.stage", "MC-0031")).ok).toBe(false);
  });

  test("publishing preserves the previous canonical record as superseded", async () => {
    const adapter = setup();

    await promote(adapter, "memory.approve", "MC-0033");
    await promote(adapter, "memory.stage", "MC-0033");
    await promote(adapter, "memory.publish", "MC-0033");

    const snapshot = adapter.readSnapshot();
    const previous = snapshot.wovensteadRecords["WSR-0003"];
    const published = Object.values(snapshot.wovensteadRecords).find(
      (record) => record.provenance.candidateId === "MC-0033"
    );

    expect(previous).toBeDefined();
    expect(previous?.authority).toBe("superseded");
    expect(previous?.supersededByRecordId).toBe(published?.id);
    expect(published?.authority).toBe("canonical");
    expect(previous?.content).toContain("Source-quality rubric v1");
  });

  test("publication appends a ledger event before the UI can report success", async () => {
    const adapter = setup();

    await promote(adapter, "memory.approve");
    await promote(adapter, "memory.stage");

    const result = await promote(adapter, "memory.publish");
    const snapshot = adapter.readSnapshot();

    expect(result.ok).toBe(true);
    expect(result.ok ? result.eventId : "").toBe(snapshot.ledger[0]?.id);
    expect(snapshot.ledger[0]?.eventType).toBe("memory.published");
    expect(snapshot.ledger[0]?.system).toBe("WOV");
  });

  test("publication is refused when the operator lacks the scope", async () => {
    const adapter = setup();

    await promote(adapter, "memory.approve");
    await promote(adapter, "memory.stage");
    await adapter.applyCommand(
      envelope({ command: "simulateDeniedPermission", kind: "scenario.run" })
    );

    const result = await promote(adapter, "memory.publish");

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("permission_denied");
    expect(adapter.readSnapshot().memoryCandidates["MC-0036"]?.status).toBe(
      "staged"
    );
  });

  test("an agent may propose a candidate but never publish one", async () => {
    const adapter = setup();

    await promote(adapter, "memory.approve");
    await promote(adapter, "memory.stage");

    const result = await adapter.applyCommand(
      envelope(
        {
          expectedVersion:
            adapter.readSnapshot().memoryCandidates["MC-0036"]?.version ?? 0,
          id: "MC-0036",
          kind: "memory.publish",
        },
        { actorId: "Athena", idempotencyKey: "agent-publish" }
      )
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("permission_denied");
  });
});
