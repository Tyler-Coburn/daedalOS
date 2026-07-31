import { OLYMPUS_READING } from "__tests__/owlagents/adapters/fixtures/olympusContract";
import { createLocalAdapter } from "owlagents/adapters/local";
import {
  toLedgerEvent,
  toSnapshot,
  workOrderStatusFor,
} from "owlagents/adapters/local/map";
import { type OlympusTask } from "owlagents/adapters/local/types";
import { WORK_ORDER_STATUSES } from "owlagents/domain/workOrderStatus";
import {
  deriveAttentionItems,
  selectMissionControlStats,
} from "owlagents/selectors/missionControl";

const SESSION = "2026-07-29T00:00:00.000Z";
const snapshot = toSnapshot(OLYMPUS_READING, SESSION);
const taskById = (id: number): OlympusTask =>
  OLYMPUS_READING.tasks.find((task) => task.id === id) as OlympusTask;

describe("Olympus execution maps onto OwlAgents governance", () => {
  test("one task becomes one run and one work order", () => {
    expect(Object.keys(snapshot.runs)).toHaveLength(
      OLYMPUS_READING.tasks.length
    );
    expect(Object.keys(snapshot.workOrders)).toHaveLength(
      OLYMPUS_READING.tasks.length
    );
  });

  test("work orders carry a stable id derived from the task id", () => {
    expect(snapshot.workOrders["WO-OLY-0002"]).toBeDefined();
    expect(snapshot.runs["RUN-OLY-0002"]?.workOrderId).toBe("WO-OLY-0002");
  });

  /**
   * The load-bearing mapping. Olympus's `done` means the agent finished, not
   * that anyone accepted the output — so it may not become `completed` on its
   * own.
   */
  test("a finished task awaits review until an operator approved it", () => {
    // Task 2 has a human_approved event; task 3 does not.
    expect(snapshot.workOrders["WO-OLY-0002"]?.status).toBe("completed");
    expect(snapshot.workOrders["WO-OLY-0003"]?.status).toBe("review_pending");
  });

  const statusCases: [string, string][] = [
    ["pending", "queued"],
    ["assigned", "queued"],
    ["in_progress", "running"],
    ["failed", "blocked"],
    ["blocked", "blocked"],
    ["rejected", "rejected"],
    ["cancelled", "cancelled"],
  ];

  test.each(statusCases)("olympus %p maps to %p", (from, expected) =>
    expect(
      workOrderStatusFor(
        { ...taskById(1), status: from as OlympusTask["status"] },
        new Set()
      )
    ).toBe(expected)
  );

  test("every mapped status is in the OwlAgents vocabulary", () =>
    Object.values(snapshot.workOrders).forEach((workOrder) =>
      expect(WORK_ORDER_STATUSES).toContain(workOrder.status)
    ));

  test("a failed task is blocked and says why", () => {
    const blocked = snapshot.workOrders["WO-OLY-0001"];

    expect(blocked?.status).toBe("blocked");
    expect(blocked?.blockedReason).toContain("worker exited");
  });

  test("cost comes from the task, and absent cost is zero not invented", () => {
    expect(snapshot.workOrders["WO-OLY-0002"]?.actualCost.amount).toBe(0.05);
    expect(snapshot.workOrders["WO-OLY-0001"]?.actualCost.amount).toBe(0);
  });

  test("stages reflect the timestamps and never a percentage", () => {
    const pending = snapshot.workOrders["WO-OLY-0004"];
    const finished = snapshot.workOrders["WO-OLY-0002"];

    expect(pending?.stage.index).toBe(0);
    expect(finished?.stage.index).toBe(3);
    expect(finished?.stage.steps.join(" ")).not.toContain("%");
  });
});

describe("nothing Olympus does not model is invented", () => {
  const empty: [string, number][] = [
    ["artifacts", Object.keys(snapshot.artifacts).length],
    ["evidence", Object.keys(snapshot.evidence).length],
    ["memoryCandidates", Object.keys(snapshot.memoryCandidates).length],
    ["policyRules", Object.keys(snapshot.policyRules).length],
    ["reviews", Object.keys(snapshot.reviews).length],
    ["sources", Object.keys(snapshot.sources).length],
    ["wovensteadRecords", Object.keys(snapshot.wovensteadRecords).length],
  ];

  test.each(empty)("%s is empty, not fabricated", (_name, count) =>
    expect(count).toBe(0)
  );

  test("the demo scenario history is absent", () =>
    expect(snapshot.scenario.history).toStrictEqual([]));
});

describe("the ledger comes from Olympus events", () => {
  test("every event is mapped and attributed to the runtime layer", () => {
    expect(snapshot.ledger).toHaveLength(OLYMPUS_READING.events.length);
    snapshot.ledger.forEach((event) => expect(event.system).toBe("OLY"));
  });

  test("a human event is attributed to the operator", () => {
    const approved = snapshot.ledger.find(
      (event) => event.eventType === "human_approved"
    );

    expect(approved?.actorType).toBe("operator");
    expect(approved?.severity).toBe("success");
    expect(approved?.objectId).toBe("WO-OLY-0002");
  });

  test("every work-order event points at a work order that exists", () =>
    snapshot.ledger
      .filter((event) => event.objectType === "workOrder")
      .forEach((event) =>
        expect(snapshot.workOrders[event.objectId]).toBeDefined()
      ));

  test("an event whose task fell outside the read window is not a dead link", () => {
    const orphan = toLedgerEvent(
      {
        event: "notify",
        id: 9,
        // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
        meta: null,
        msg: "a task older than the limit",
        task_id: 9999,
        ts: SESSION,
      },
      new Map()
    );

    expect(orphan.objectType).toBe("system");
    expect(orphan.objectId).toBe("olympus");
  });

  test("an event with no task belongs to the system, not to a work order", () => {
    const systemEvent = toLedgerEvent({
      event: "notify",
      id: 9,
      // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
      meta: null,
      msg: "health check",
      // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
      task_id: null,
      ts: SESSION,
    });

    expect(systemEvent.objectType).toBe("system");
  });
});

describe("the environment says LOCAL, and says it once", () => {
  test("a reading is local authority, not a fixture", () => {
    expect(snapshot.environment.mode).toBe("LOCAL");
    expect(snapshot.environment.isFixture).toBe(false);
  });

  test("the badge does not promise writes the adapter refuses", () => {
    expect(snapshot.environment.canWrite).toBe(false);
    expect(snapshot.environment.writeBlockedReason).toContain("Read-only");
  });

  test("services report the live queue depth", () => {
    const api = snapshot.services.find(
      (service) => service.id === "SVC-olympus-api"
    );

    expect(api?.state).toBe("connected");
    expect(api?.queueDepth).toBe(1);
  });
});

describe("the adapter refuses to drive the runtime", () => {
  test("an unreachable Olympus shows nothing, not fixtures", async () => {
    const adapter = createLocalAdapter({
      baseUrl: "http://127.0.0.1:1",
      refreshMs: 10 ** 6,
      sessionStartedAt: SESSION,
    });
    let notified = 0;
    const stop = adapter.subscribe(() => {
      notified += 1;
    });

    // Let the first read fail.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    stop();

    // A failed read still emits — the operator has to learn the badge changed.
    expect(notified).toBeGreaterThan(0);

    // Never read successfully this session, so OFFLINE — not DEGRADED, which
    // would imply there was once something real behind the badge.
    expect(adapter.getAuthority().mode).toBe("OFFLINE");
    expect(Object.keys(adapter.readSnapshot().workOrders)).toStrictEqual([]);
  });

  test("every command is refused with a reason and an action", async () => {
    const adapter = createLocalAdapter({
      baseUrl: "http://127.0.0.1:1",
      sessionStartedAt: SESSION,
    });
    const result = await adapter.applyCommand({
      command: { kind: "workOrder.transition" },
      idempotencyKey: "k",
    } as never);

    const error = result.ok ? undefined : result.error;

    expect(result.ok).toBe(false);
    expect(error?.code).toBe("blocked");
    expect(error?.action).toContain("Olympus");
    expect(error?.detail).toBe("workOrder.transition");
  });
});

describe("the existing selectors work unchanged against real data", () => {
  test("Mission Control counts real tasks", () => {
    const byId = Object.fromEntries(
      selectMissionControlStats(snapshot).map((stat) => [stat.id, stat.value])
    );

    expect(byId.blocked).toBe("1");
    expect(byId.pendingReview).toBe("0");
    expect(byId.costToday).toBe("$0.25");
  });

  test("an unreviewed finished task becomes an attention item", () => {
    const items = deriveAttentionItems(snapshot);

    expect(
      items.some(
        (item) => item.objectId === "WO-OLY-0001" && item.kind === "blocked"
      )
    ).toBe(true);
  });

  test("projects are grouped by the Olympus project id", () => {
    expect(snapshot.projects["project:examplestore"]?.name).toBe(
      "examplestore"
    );
    expect(snapshot.projects["project:unassigned"]).toBeDefined();
  });

  test("a project is derived from its tasks, and says what Olympus cannot answer", () => {
    const project = snapshot.projects["project:examplestore"];

    // Tasks 2 and 3, both finished: every task ran and none is still active.
    expect(project?.stage.index).toBe(2);
    expect(project?.costToDate.amount).toBeCloseTo(0.25);
    // The earliest task, not the last activity — Olympus has no project record.
    expect(project?.createdAt).toBe("2026-07-22T02:04:26.935Z");
  });

  test("phase is derived from the task types, not defaulted to Build", () => {
    // examplestore holds a `research` task and a `fulfill` task.
    expect(snapshot.projects["project:examplestore"]?.phase).toBe("Build");
    // unassigned holds `research` and `route` — also past pure research.
    expect(snapshot.projects["project:unassigned"]?.phase).toBe("Build");
  });

  test("a project with a blocked task is at risk and names the blocker", () => {
    const project = snapshot.projects["project:unassigned"];

    expect(project?.health).toBe("at_risk");
    expect(project?.blockers[0]).toContain("WO-OLY-0001");
  });
});
