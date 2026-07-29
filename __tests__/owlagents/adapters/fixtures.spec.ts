import { existsSync } from "fs";
import { join } from "path";
import { DEMO_VERTICAL_SLICE } from "owlagents/adapters/demo/fixtures";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import { isId } from "owlagents/domain/ids";
import { MEMORY_STATES } from "owlagents/domain/memoryLifecycle";
import { REVIEW_STATES } from "owlagents/domain/reviewDecision";
import { WORK_ORDER_STATUSES } from "owlagents/domain/workOrderStatus";

const snapshot = createDemoSnapshot();

/** Names a reference that points at nothing, so a failure says which one. */
const dangling = (
  label: string,
  id: string | undefined,
  table: object
): string[] => (!id || Object.hasOwn(table, id) ? [] : [`${label} ${id}`]);

describe("demo fixtures use the documented stable ids", () => {
  const namedIds: [string, boolean][] = [
    ["PRJ-001", Boolean(snapshot.projects["PRJ-001"])],
    ["SRC-0142", Boolean(snapshot.sources["SRC-0142"])],
    ["PACK-0001", Boolean(snapshot.contextPacks["PACK-0001"])],
    ["WO-2026-0043", Boolean(snapshot.workOrders["WO-2026-0043"])],
    ["WO-2026-0051", Boolean(snapshot.workOrders["WO-2026-0051"])],
    ["ART-0031", Boolean(snapshot.artifacts["ART-0031"])],
    ["REV-2026-0184", Boolean(snapshot.reviews["REV-2026-0184"])],
    ["MC-0031", Boolean(snapshot.memoryCandidates["MC-0031"])],
    ["POL-001", Boolean(snapshot.policyRules["POL-001"])],
    ["POL-006", Boolean(snapshot.policyRules["POL-006"])],
  ];

  test.each(namedIds)("%p exists: %p", (_id, exists) =>
    expect(exists).toBe(true)
  );

  test("every id matches its documented format", () => {
    Object.keys(snapshot.projects).forEach((id) =>
      expect(isId("project", id)).toBe(true)
    );
    Object.keys(snapshot.workOrders).forEach((id) =>
      expect(isId("workOrder", id)).toBe(true)
    );
    Object.keys(snapshot.reviews).forEach((id) =>
      expect(isId("review", id)).toBe(true)
    );
    Object.keys(snapshot.artifacts).forEach((id) =>
      expect(isId("artifact", id)).toBe(true)
    );
    Object.keys(snapshot.sources).forEach((id) =>
      expect(isId("source", id)).toBe(true)
    );
    Object.keys(snapshot.memoryCandidates).forEach((id) =>
      expect(isId("memoryCandidate", id)).toBe(true)
    );
  });

  test("the record key always matches the object's own id", () => {
    Object.entries(snapshot.workOrders).forEach(([key, workOrder]) =>
      expect(workOrder.id).toBe(key)
    );
    Object.entries(snapshot.reviews).forEach(([key, review]) =>
      expect(review.id).toBe(key)
    );
    Object.entries(snapshot.artifacts).forEach(([key, artifact]) =>
      expect(artifact.id).toBe(key)
    );
  });
});

describe("demo fixtures are one linked object graph", () => {
  test("every work order points at a real project, pack, policy and agent", () =>
    expect(
      Object.values(snapshot.workOrders).flatMap((workOrder) => [
        ...dangling("project", workOrder.projectId, snapshot.projects),
        ...dangling("pack", workOrder.contextPackId, snapshot.contextPacks),
        ...dangling(
          "policy decision",
          workOrder.policyDecisionId,
          snapshot.policyDecisions
        ),
        ...dangling("agent", workOrder.agentId, snapshot.agents),
      ])
    ).toStrictEqual([]));

  test("every referenced source, artifact, evidence and review resolves", () =>
    Object.values(snapshot.workOrders).forEach((workOrder) => {
      workOrder.sourceIds.forEach((id) =>
        expect(snapshot.sources[id]).toBeDefined()
      );
      workOrder.artifactIds.forEach((id) =>
        expect(snapshot.artifacts[id]).toBeDefined()
      );
      workOrder.evidenceIds.forEach((id) =>
        expect(snapshot.evidence[id]).toBeDefined()
      );
      workOrder.reviewIds.forEach((id) =>
        expect(snapshot.reviews[id]).toBeDefined()
      );
      workOrder.runIds.forEach((id) => expect(snapshot.runs[id]).toBeDefined());
    }));

  test("every review pins an artifact that exists at the pinned version", () =>
    Object.values(snapshot.reviews).forEach((review) => {
      const artifact = snapshot.artifacts[review.artifactIds[0] ?? ""];

      expect(artifact).toBeDefined();
      expect(artifact?.version).toBe(review.expectedArtifactVersion);
      expect(artifact?.hash).toBe(review.expectedArtifactHash);
    }));

  test("every memory candidate traces back to a work order and artifact", () =>
    expect(
      Object.values(snapshot.memoryCandidates).flatMap((candidate) => [
        ...dangling(
          "work order",
          candidate.sourceWorkOrderId,
          snapshot.workOrders
        ),
        ...candidate.sourceArtifactIds.flatMap((id) =>
          dangling("artifact", id, snapshot.artifacts)
        ),
        ...dangling(
          "wovenstead record",
          candidate.existingRecordId,
          snapshot.wovensteadRecords
        ),
      ])
    ).toStrictEqual([]));

  test("the vertical slice is a single unbroken chain", () => {
    const slice = DEMO_VERTICAL_SLICE;
    const workOrder = snapshot.workOrders[slice.workOrderId];
    const review = snapshot.reviews[slice.reviewId];
    const candidate = snapshot.memoryCandidates[slice.memoryCandidateId];

    expect(workOrder?.projectId).toBe(slice.projectId);
    expect(workOrder?.sourceIds).toContain(slice.sourceId);
    expect(workOrder?.contextPackId).toBe(slice.contextPackId);
    expect(workOrder?.policyDecisionId).toBe(slice.policyDecisionId);
    expect(workOrder?.runIds).toContain(slice.runId);
    expect(workOrder?.artifactIds).toContain(slice.artifactId);
    expect(workOrder?.evidenceIds).toStrictEqual(slice.evidenceIds);
    expect(review?.workOrderId).toBe(slice.workOrderId);
    expect(review?.artifactIds).toContain(slice.artifactId);
    expect(candidate?.sourceWorkOrderId).toBe(slice.workOrderId);
    expect(candidate?.sourceArtifactIds).toContain(slice.artifactId);
  });
});

describe("demo fixtures use only finite typed states", () => {
  test("work order statuses are all in the vocabulary", () =>
    Object.values(snapshot.workOrders).forEach((workOrder) =>
      expect(WORK_ORDER_STATUSES).toContain(workOrder.status)
    ));

  test("review statuses are all in the vocabulary", () =>
    Object.values(snapshot.reviews).forEach((review) =>
      expect(REVIEW_STATES).toContain(review.status)
    ));

  test("memory statuses are all in the vocabulary", () =>
    Object.values(snapshot.memoryCandidates).forEach((candidate) =>
      expect(MEMORY_STATES).toContain(candidate.status)
    ));

  test("stage index never points past the end of the stage list", () =>
    Object.values(snapshot.workOrders).forEach((workOrder) => {
      expect(workOrder.stage.steps.length).toBeGreaterThan(0);
      expect(workOrder.stage.index).toBeLessThan(workOrder.stage.steps.length);
    }));
});

describe("every source projects onto a real preserved file", () => {
  test("the path of each source exists under public/", () =>
    expect(
      Object.values(snapshot.sources)
        .filter((source) => !existsSync(join("public", source.path)))
        .map((source) => `${source.id} -> ${source.path}`)
    ).toStrictEqual([]));

  test("preserved records are served from the sources mount", () =>
    Object.values(snapshot.sources).forEach((source) =>
      expect(source.path.startsWith("/OwlAgents/Sources/")).toBe(true)
    ));
});

describe("demo data is visibly demo data", () => {
  test("the environment reports DEMO and labels itself a fixture", () => {
    expect(snapshot.environment.mode).toBe("DEMO");
    expect(snapshot.environment.isFixture).toBe(true);
  });

  test("no integration claims a successful sync while in demo mode", () =>
    Object.values(snapshot.integrations).forEach((integration) =>
      expect(integration.lastSuccessfulSyncAt).toBeUndefined()
    ));

  test("a disconnected integration always states why", () =>
    Object.values(snapshot.integrations)
      .filter((integration) => integration.state === "disconnected")
      .forEach((integration) => expect(integration.error).toBeTruthy()));

  test("no integration is shown as connected", () =>
    Object.values(snapshot.integrations).forEach((integration) =>
      expect(integration.state).not.toBe("connected")
    ));
});
