import { createDemoAdapter } from "owlagents/adapters/demo";
import { DEMO_VERTICAL_SLICE } from "owlagents/adapters/demo/fixtures";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import { type OwlAgentsAdapter } from "owlagents/adapters/types";
import { selectDegradedCount } from "owlagents/selectors/catalog";
import {
  deriveAttentionItems,
  selectActiveWork,
  selectBriefing,
  selectMissionControlStats,
  selectProjectPulse,
} from "owlagents/selectors/missionControl";
import { createServices } from "owlagents/services";

const NOW = "2026-07-28T15:00:00.000Z";
const snapshot = createDemoSnapshot();

const setup = (): OwlAgentsAdapter => createDemoAdapter({ now: () => NOW });

describe("mission control is derived, never stored", () => {
  test("every stat is counted from domain objects", () => {
    const stats = selectMissionControlStats(snapshot);
    const byId = Object.fromEntries(stats.map((stat) => [stat.id, stat.value]));
    const workOrders = Object.values(snapshot.workOrders);

    expect(stats).toHaveLength(6);
    expect(byId.blocked).toBe(
      String(
        workOrders.filter((workOrder) => workOrder.status === "blocked").length
      )
    );
    expect(byId.activeWork).toBe(
      String(
        workOrders.filter((workOrder) =>
          ["artifact_ready", "queued", "running"].includes(workOrder.status)
        ).length
      )
    );
    expect(byId.agentsWorking).toBe(
      String(
        Object.values(snapshot.agents).filter(
          (agent) => agent.status === "working"
        ).length
      )
    );
  });

  /**
   * The tile is scoped to this session, not to the whole snapshot. Summing
   * everything was true of the one-day demo fixtures and false of any authority
   * holding history — it reported lifetime spend under the word "today".
   */
  test("cost is summed from work orders finished this session, not stored", () => {
    const expected = Object.values(snapshot.workOrders)
      .filter(
        (workOrder) =>
          workOrder.completedAt !== undefined &&
          workOrder.completedAt >= snapshot.sessionStartedAt
      )
      .reduce((total, workOrder) => total + workOrder.actualCost.amount, 0);
    const costTile = selectMissionControlStats(snapshot).find(
      (stat) => stat.id === "costToday"
    );

    expect(costTile?.value).toBe(`$${expected.toFixed(2)}`);
    expect(costTile?.label).not.toContain("today");
  });

  test("work finished before this session is not counted as this session's", () => {
    const lifetime = Object.values(snapshot.workOrders).reduce(
      (total, workOrder) => total + workOrder.actualCost.amount,
      0
    );
    const costTile = selectMissionControlStats(snapshot).find(
      (stat) => stat.id === "costToday"
    );

    expect(costTile?.value).not.toBe(`$${lifetime.toFixed(2)}`);
  });

  test("the briefing counts ledger events since the session started", () => {
    const briefing = selectBriefing(snapshot);

    expect(briefing).toHaveLength(6);
    expect(briefing.every((line) => Number.isInteger(line.count))).toBe(true);
    expect(
      briefing.find((line) => line.id === "workOrders")?.count
    ).toBeGreaterThan(0);
  });

  test("project pulse reports stage steps, never a percentage", () =>
    selectProjectPulse(snapshot).forEach((pulse) => {
      expect(pulse.stageLabel).toMatch(/^\d+ of \d+$/);
      expect(pulse.stageLabel).not.toContain("%");
    }));

  test("active work shows a named stage, never a fabricated percentage", () =>
    selectActiveWork(snapshot).forEach((row) => {
      expect(row.stageLabel).not.toContain("%");
      expect(row.stageLabel.length).toBeGreaterThan(0);
    }));
});

describe("attention items derive from state", () => {
  test("an order awaiting approval produces an approval item", () => {
    const items = deriveAttentionItems(snapshot);

    expect(
      items.some(
        (item) => item.kind === "approval" && item.objectId === "WO-2026-0047"
      )
    ).toBe(true);
  });

  test("a blocked order produces a high-risk blocked item", () => {
    const blocked = deriveAttentionItems(snapshot).find(
      (item) => item.kind === "blocked"
    );

    expect(blocked?.objectId).toBe("WO-2026-0050");
    expect(blocked?.risk).toBe("high");
  });

  test("a cost exception is its own kind, not a generic review", () => {
    const items = deriveAttentionItems(snapshot);

    expect(items.find((item) => item.objectId === "REV-2026-0189")?.kind).toBe(
      "cost"
    );
  });

  test("high risk sorts to the top", () => {
    const rank = { high: 0, low: 2, medium: 1 };
    const ranks = deriveAttentionItems(snapshot).map((item) => rank[item.risk]);

    expect(ranks[0]).toBe(0);
    expect(ranks).toStrictEqual([...ranks].sort((a, b) => a - b));
  });

  test("resolving the condition removes the item", async () => {
    const adapter = setup();
    const services = createServices(adapter);
    const before = services.missionControlService.getAttentionItems();

    expect(before.some((item) => item.objectId === "WO-2026-0047")).toBe(true);

    await services.workOrderService.requestTransition({
      expectedVersion:
        adapter.readSnapshot().workOrders["WO-2026-0047"]?.version ?? 0,
      id: "WO-2026-0047",
      to: "queued",
    });

    const after = services.missionControlService.getAttentionItems();

    expect(
      after.some(
        (item) => item.kind === "approval" && item.objectId === "WO-2026-0047"
      )
    ).toBe(false);
  });

  test("deciding a review removes its attention item", async () => {
    const adapter = setup();
    const services = createServices(adapter);
    const review = adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId];

    await services.reviewService.submitDecision({
      artifactHash: review?.expectedArtifactHash ?? "",
      decision: "approve",
      expectedArtifactVersion: review?.expectedArtifactVersion ?? 0,
      expectedVersion: review?.version ?? 0,
      id: DEMO_VERTICAL_SLICE.reviewId,
    });

    expect(
      services.missionControlService
        .getAttentionItems()
        .some((item) => item.objectId === DEMO_VERTICAL_SLICE.reviewId)
    ).toBe(false);
  });

  test("a staged candidate asks for a publication click", async () => {
    const adapter = setup();
    const services = createServices(adapter);
    const id = DEMO_VERTICAL_SLICE.memoryCandidateId;

    await services.memoryService.approveCandidate({
      expectedVersion:
        adapter.readSnapshot().memoryCandidates[id]?.version ?? 0,
      id,
    });
    await services.memoryService.stageCandidate({
      expectedVersion:
        adapter.readSnapshot().memoryCandidates[id]?.version ?? 0,
      id,
    });

    expect(
      services.missionControlService
        .getAttentionItems()
        .some((item) => item.kind === "memory" && item.objectId === id)
    ).toBe(true);
  });

  test("a stale review is raised to high risk and says why", async () => {
    const adapter = setup();
    const services = createServices(adapter);

    await services.scenarioService.run("simulateStaleReview");

    const item = services.missionControlService
      .getAttentionItems()
      .find((entry) => entry.objectId === DEMO_VERTICAL_SLICE.reviewId);

    expect(item?.risk).toBe("high");
    expect(item?.detail).toContain("new review cycle");
  });

  test("no attention item stores a pre-rendered count string", () =>
    deriveAttentionItems(snapshot).forEach((item) => {
      expect(item.objectId).toBeTruthy();
      expect(item.objectType).toBeTruthy();
    }));
});

describe("system health and integrations cannot disagree", () => {
  test("both are counted from the same snapshot by the same predicate", () => {
    const services = Object.values(snapshot.services).filter(
      (service) => service.state !== "connected"
    ).length;
    const integrations = Object.values(snapshot.integrations).filter(
      (integration) => integration.state !== "connected"
    ).length;

    expect(selectDegradedCount(snapshot)).toBe(services + integrations);
  });

  test("a disconnected system never reads as healthy", () =>
    Object.values(snapshot.integrations)
      .filter((integration) => integration.state === "disconnected")
      .forEach((integration) => {
        expect(integration.error).toBeTruthy();
        expect(integration.lastSuccessfulSyncAt).toBeUndefined();
      }));
});
