import { createDemoAdapter } from "owlagents/adapters/demo";
import { DEMO_VERTICAL_SLICE } from "owlagents/adapters/demo/fixtures";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import {
  type CommandEnvelope,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";
import {
  SCENARIO_COMMANDS,
  type ScenarioCommand,
} from "owlagents/domain/snapshot";

const NOW = "2026-07-28T15:00:00.000Z";

const scenario = (command: ScenarioCommand, seq: number): CommandEnvelope => ({
  actorId: "operator",
  command: { command, kind: "scenario.run" },
  idempotencyKey: `scenario-${command}-${seq}`,
  permissionScope: "scenario.run",
  requestedAt: 0,
});

const setup = (): OwlAgentsAdapter => createDemoAdapter({ now: () => NOW });

describe("the demo scenario runner is explicit, not a timer", () => {
  test("nothing changes unless a scenario command is issued", () => {
    const adapter = setup();
    const first = adapter.readSnapshot();

    expect(adapter.readSnapshot()).toBe(first);
    expect(first.scenario.step).toBe(0);
  });

  test("every named control is accepted", async () => {
    const results = await Promise.all(
      SCENARIO_COMMANDS.map((command, index) =>
        setup().applyCommand(scenario(command, index))
      )
    );

    results.forEach((result) => expect(result.ok).toBe(true));
  });

  test("advance walks the vertical slice to a published record", async () => {
    const adapter = setup();

    for (let step = 0; step < 8; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.applyCommand(scenario("advance", step));
    }

    const snapshot = adapter.readSnapshot();

    expect(snapshot.workOrders[DEMO_VERTICAL_SLICE.workOrderId]?.status).toBe(
      "completed"
    );
    expect(snapshot.reviews[DEMO_VERTICAL_SLICE.reviewId]?.status).toBe(
      "approved"
    );
    expect(
      snapshot.memoryCandidates[DEMO_VERTICAL_SLICE.memoryCandidateId]?.status
    ).toBe("published");
    expect(
      Object.values(snapshot.wovensteadRecords).some(
        (record) =>
          record.provenance.candidateId ===
          DEMO_VERTICAL_SLICE.memoryCandidateId
      )
    ).toBe(true);
  });

  test("advance never skips a lifecycle step", async () => {
    const adapter = setup();
    const seen: string[] = [];

    for (let step = 0; step < 8; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      await adapter.applyCommand(scenario("advance", step));
      seen.push(
        adapter.readSnapshot().memoryCandidates[
          DEMO_VERTICAL_SLICE.memoryCandidateId
        ]?.status ?? "?"
      );
    }

    expect(seen).toContain("approved");
    expect(seen).toContain("staged");
    expect(seen.indexOf("approved")).toBeLessThan(seen.indexOf("staged"));
    expect(seen.indexOf("staged")).toBeLessThan(seen.indexOf("published"));
  });

  test("simulateBlockage blocks the running order and states the reason", async () => {
    const adapter = setup();

    await adapter.applyCommand(scenario("simulateBlockage", 0));

    const workOrder =
      adapter.readSnapshot().workOrders[DEMO_VERTICAL_SLICE.workOrderId];

    expect(workOrder?.status).toBe("blocked");
    expect(workOrder?.blockedReason).toContain("429");
  });

  test("simulateStaleReview revises the artifact and says so in the ledger", async () => {
    const adapter = setup();
    const before =
      adapter.readSnapshot().artifacts[DEMO_VERTICAL_SLICE.artifactId];

    await adapter.applyCommand(scenario("simulateStaleReview", 0));

    const after =
      adapter.readSnapshot().artifacts[DEMO_VERTICAL_SLICE.artifactId];

    expect(after?.version).toBe((before?.version ?? 0) + 1);
    expect(after?.hash).not.toBe(before?.hash);
    expect(adapter.readSnapshot().ledger[0]?.message).toContain("stale");
  });

  test("reset restores a snapshot deep-equal to the initial one", async () => {
    const adapter = setup();

    await adapter.applyCommand(scenario("simulateBlockage", 0));
    await adapter.applyCommand(scenario("advance", 1));
    await adapter.applyCommand(scenario("reset", 2));

    expect(adapter.readSnapshot()).toStrictEqual(createDemoSnapshot());
  });

  test("reset restores revoked permissions too", async () => {
    const adapter = setup();

    await adapter.applyCommand(scenario("simulateDeniedPermission", 0));
    await adapter.applyCommand(scenario("reset", 1));
    await adapter.applyCommand({
      actorId: "operator",
      command: {
        expectedVersion: 2,
        id: "MC-0033",
        kind: "memory.stage",
      },
      idempotencyKey: "after-reset",
      permissionScope: "memory.stage",
      requestedAt: 0,
    });

    expect(adapter.readSnapshot().memoryCandidates["MC-0033"]?.status).toBe(
      "staged"
    );
  });

  test("subscribers are notified once per committed command", async () => {
    const adapter = setup();
    let notifications = 0;
    const unsubscribe = adapter.subscribe(() => {
      notifications += 1;
    });

    await adapter.applyCommand(scenario("advance", 0));
    await adapter.applyCommand(scenario("advance", 1));
    unsubscribe();
    await adapter.applyCommand(scenario("advance", 2));

    expect(notifications).toBe(2);
  });
});
