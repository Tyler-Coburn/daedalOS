import { createDemoAdapter } from "owlagents/adapters/demo";
import { DEMO_VERTICAL_SLICE } from "owlagents/adapters/demo/fixtures";
import { createServices } from "owlagents/services";
import { type OwlAgentsServices } from "owlagents/services/types";
import { type OwlAgentsAdapter } from "owlagents/adapters/types";

const NOW = "2026-07-28T15:00:00.000Z";

type Harness = { adapter: OwlAgentsAdapter; services: OwlAgentsServices };

const setup = (): Harness => {
  const adapter = createDemoAdapter({ now: () => NOW });

  return { adapter, services: createServices(adapter) };
};

const versionOf = (
  adapter: OwlAgentsAdapter,
  table: "memoryCandidates" | "reviews" | "workOrders",
  id: string
): number => {
  const records: Record<string, { version: number } | undefined> =
    adapter.readSnapshot()[table];

  return records[id]?.version ?? 0;
};

/** Promotes a candidate one step, always reading its current version. */
const promote = (
  harness: Harness,
  step: "approveCandidate" | "publishCandidate" | "stageCandidate",
  id: string = DEMO_VERTICAL_SLICE.memoryCandidateId
): ReturnType<OwlAgentsServices["memoryService"]["approveCandidate"]> =>
  harness.services.memoryService[step]({
    expectedVersion: versionOf(harness.adapter, "memoryCandidates", id),
    id,
  });

describe("workOrderService", () => {
  test("a transition request commits and reports the ledger event", async () => {
    const { adapter, services } = setup();
    const result = await services.workOrderService.requestTransition({
      expectedVersion: versionOf(adapter, "workOrders", "WO-2026-0047"),
      id: "WO-2026-0047",
      reason: "Bounded execution approved",
      to: "queued",
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.phase : "").toBe("committed");
    expect(result.ok ? result.eventId : "").toBe(
      adapter.readSnapshot().ledger[0]?.id
    );
  });

  test("a stale expected version is refused with an action to take", async () => {
    const { services } = setup();
    const result = await services.workOrderService.requestTransition({
      expectedVersion: 1,
      id: "WO-2026-0051",
      to: "artifact_ready",
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("stale_version");
    expect(result.ok ? undefined : result.error.action).toBeTruthy();
  });

  test("the derived idempotency key makes a double-click a duplicate", async () => {
    const { adapter, services } = setup();
    const request = {
      expectedVersion: versionOf(adapter, "workOrders", "WO-2026-0043"),
      id: "WO-2026-0043",
      to: "policy_pending" as const,
    };

    const first = await services.workOrderService.requestTransition(request);
    const ledgerLength = adapter.readSnapshot().ledger.length;
    const second = await services.workOrderService.requestTransition(request);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.ok ? undefined : second.error.code).toBe("duplicate_request");
    expect(adapter.readSnapshot().ledger).toHaveLength(ledgerLength);
  });

  test("a genuine retry after a refusal is not treated as a duplicate", async () => {
    const { adapter, services } = setup();

    const refused = await services.workOrderService.requestTransition({
      expectedVersion: 999,
      id: "WO-2026-0043",
      to: "policy_pending",
    });
    const retried = await services.workOrderService.requestTransition({
      expectedVersion: versionOf(adapter, "workOrders", "WO-2026-0043"),
      id: "WO-2026-0043",
      to: "policy_pending",
    });

    expect(refused.ok).toBe(false);
    expect(retried.ok).toBe(true);
  });
});

describe("reviewService", () => {
  test("a current review commits", async () => {
    const { adapter, services } = setup();
    const review = adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId];
    const result = await services.reviewService.submitDecision({
      artifactHash: review?.expectedArtifactHash ?? "",
      decision: "approve",
      expectedArtifactVersion: review?.expectedArtifactVersion ?? 0,
      expectedVersion: review?.version ?? 0,
      id: DEMO_VERTICAL_SLICE.reviewId,
    });

    expect(result.ok).toBe(true);
  });

  test("approving a review whose artifact moved is refused and explained", async () => {
    const { adapter, services } = setup();

    await services.scenarioService.run("simulateStaleReview");

    const review = adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId];
    const result = await services.reviewService.submitDecision({
      artifactHash: review?.expectedArtifactHash ?? "",
      decision: "approve",
      expectedArtifactVersion: review?.expectedArtifactVersion ?? 0,
      expectedVersion: review?.version ?? 0,
      id: DEMO_VERTICAL_SLICE.reviewId,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.detail).toContain(
      "artifact_hash_changed"
    );
    expect(
      adapter.readSnapshot().reviews[DEMO_VERTICAL_SLICE.reviewId]?.status
    ).toBe("stale");
  });

  test("approve and reject at the same version are distinct requests", async () => {
    const { adapter, services } = setup();
    const review = adapter.readSnapshot().reviews["REV-2026-0184"];
    const base = {
      artifactHash: review?.expectedArtifactHash ?? "",
      expectedArtifactVersion: review?.expectedArtifactVersion ?? 0,
      expectedVersion: review?.version ?? 0,
      id: "REV-2026-0184",
    };

    const approved = await services.reviewService.submitDecision({
      ...base,
      decision: "approve",
    });
    const rejected = await services.reviewService.submitDecision({
      ...base,
      decision: "reject",
    });

    expect(approved.ok).toBe(true);
    // Refused because the review is decided, not because the key collided.
    expect(rejected.ok).toBe(false);
    expect(rejected.ok ? undefined : rejected.error.code).toBe("stale_state");
  });
});

describe("memoryService", () => {
  test("the lifecycle must be walked in order", async () => {
    const harness = setup();

    expect((await promote(harness, "stageCandidate")).ok).toBe(false);
    expect((await promote(harness, "publishCandidate")).ok).toBe(false);
    expect((await promote(harness, "approveCandidate")).ok).toBe(true);
    expect((await promote(harness, "publishCandidate")).ok).toBe(false);
    expect((await promote(harness, "stageCandidate")).ok).toBe(true);
    expect((await promote(harness, "publishCandidate")).ok).toBe(true);
  });

  test("publication supersedes the previous canonical record without deleting it", async () => {
    const harness = setup();

    await promote(harness, "approveCandidate", "MC-0033");
    await promote(harness, "stageCandidate", "MC-0033");
    await promote(harness, "publishCandidate", "MC-0033");

    const records = harness.adapter.readSnapshot().wovensteadRecords;

    expect(records["WSR-0003"]?.authority).toBe("superseded");
    expect(records["WSR-0003"]?.content).toBeTruthy();
    expect(records["WSR-0003"]?.supersededByRecordId).toBeTruthy();
  });
});

describe("ledgerService", () => {
  test("filters by system, since and limit", () => {
    const { services } = setup();

    expect(
      services.ledgerService.listEvents({ systems: ["WOV"] })
    ).toHaveLength(2);
    expect(services.ledgerService.listEvents({ limit: 3 })).toHaveLength(3);
    expect(
      services.ledgerService.listEvents({ since: "2026-07-28T14:00:00.000Z" })
    ).toHaveLength(4);
  });

  test("returns the whole ledger with no query", () => {
    const { adapter, services } = setup();

    expect(services.ledgerService.listEvents()).toHaveLength(
      adapter.readSnapshot().ledger.length
    );
  });
});

describe("environmentService", () => {
  test("reports one authority value that labels itself as fixture data", () => {
    const { services } = setup();
    const authority = services.environmentService.getAuthority();

    expect(authority.mode).toBe("DEMO");
    expect(authority.isFixture).toBe(true);
    expect(authority.detail).toContain("No external system was contacted");
  });
});
