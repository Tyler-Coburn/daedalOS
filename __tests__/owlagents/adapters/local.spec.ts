import { OLYMPUS_READING } from "__tests__/owlagents/adapters/fixtures/olympusContract";
import { createLocalAdapter } from "owlagents/adapters/local";
import { describeReadFailure } from "owlagents/adapters/local/client";
import {
  toLedgerEvent,
  toSnapshot,
  workOrderStatusFor,
} from "owlagents/adapters/local/map";
import { type OlympusTask } from "owlagents/adapters/local/types";
import { buildDeepLink, resolveDeepLink } from "owlagents/deepLinks";
import { type IdKind, isId } from "owlagents/domain/ids";
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
    expect(snapshot.workOrders["WO-2026-0002"]).toBeDefined();
    expect(snapshot.runs["RUN-0002"]?.workOrderId).toBe("WO-2026-0002");
  });

  /**
   * The load-bearing mapping. Olympus's `done` means the agent finished, not
   * that anyone accepted the output — so it may not become `completed` on its
   * own.
   */
  test("a finished task awaits review until an operator approved it", () => {
    // Task 2 has a human_approved event; task 3 does not.
    expect(snapshot.workOrders["WO-2026-0002"]?.status).toBe("completed");
    expect(snapshot.workOrders["WO-2026-0003"]?.status).toBe("review_pending");
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
    const blocked = snapshot.workOrders["WO-2026-0001"];

    expect(blocked?.status).toBe("blocked");
    expect(blocked?.blockedReason).toContain("worker exited");
  });

  test("cost comes from the task, and absent cost is zero not invented", () => {
    expect(snapshot.workOrders["WO-2026-0002"]?.actualCost.amount).toBe(0.05);
    expect(snapshot.workOrders["WO-2026-0001"]?.actualCost.amount).toBe(0);
  });

  test("stages reflect the timestamps and never a percentage", () => {
    const pending = snapshot.workOrders["WO-2026-0004"];
    const finished = snapshot.workOrders["WO-2026-0002"];

    expect(pending?.stage.index).toBe(0);
    expect(finished?.stage.index).toBe(3);
    expect(finished?.stage.steps.join(" ")).not.toContain("%");
  });
});

/**
 * `resolveDeepLink` validates an id before opening anything, so an id that does
 * not satisfy `ID_PATTERNS` is a dead link everywhere in the command center —
 * every route, and every `ObjectLink` in every table. Testing the mapping in
 * isolation missed this entirely; only opening the app showed it.
 */
describe("every generated id is a real id", () => {
  const idCases: [string, string, string][] = [
    ...Object.keys(snapshot.workOrders).map((id): [string, string, string] => [
      "workOrder",
      id,
      "work-orders",
    ]),
    ...Object.keys(snapshot.runs).map((id): [string, string, string] => [
      "run",
      id,
      "",
    ]),
    ...Object.keys(snapshot.projects).map((id): [string, string, string] => [
      "project",
      id,
      "projects",
    ]),
    ...snapshot.ledger.map((event): [string, string, string] => [
      "ledgerEvent",
      event.id,
      "",
    ]),
  ];

  test.each(idCases)("%s id %p matches its pattern", (kind, id) =>
    expect(isId(kind as IdKind, id)).toBe(true)
  );

  test("work-order ids are stable across two reads of the same data", () =>
    expect(
      Object.keys(toSnapshot(OLYMPUS_READING, SESSION).workOrders)
    ).toStrictEqual(Object.keys(snapshot.workOrders)));

  test("a deep link to a real work order resolves", () => {
    const [id = ""] = Object.keys(snapshot.workOrders);

    expect(resolveDeepLink(buildDeepLink("workOrder", id))?.objectId).toBe(id);
  });

  test("a deep link to a real project resolves", () => {
    const target = resolveDeepLink(
      buildDeepLink("project", "project:examplestore")
    );

    expect(target?.appId).toBe("Projects");
    expect(target?.objectId).toBe("project:examplestore");
  });

  test("a work_order_id Olympus assigned is used only when well formed", () => {
    const good = { ...taskById(1), work_order_id: "WO-2026-9999" };
    const bad = { ...taskById(1), work_order_id: "not-an-id" };

    expect(
      Object.keys(
        toSnapshot({ ...OLYMPUS_READING, tasks: [good] }, SESSION).workOrders
      )
    ).toStrictEqual(["WO-2026-9999"]);
    // A malformed one is refused, not passed through into a dead link.
    expect(
      Object.keys(
        toSnapshot({ ...OLYMPUS_READING, tasks: [bad] }, SESSION).workOrders
      )
    ).toStrictEqual(["WO-2026-0001"]);
  });
});

/**
 * `POST /tasks/:id/approve` writes only an event — no column on the task — and
 * `GET /events` offers no filter and no offset, only `ORDER BY id DESC LIMIT ?`.
 * So a short read window silently erases approvals, and this adapter refuses
 * writes, which means a work order wrongly parked in review is an alarm the
 * operator cannot clear from here.
 */
describe("a truncated event window does not erase approvals", () => {
  // A window holding only events about task 3 onward: everything earlier,
  // including task 2's `human_approved`, has aged out.
  const truncatedReading = {
    ...OLYMPUS_READING,
    events: [
      {
        event: "notify",
        id: 900,
        // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
        meta: null,
        msg: "draft produced",
        task_id: 3,
        ts: "2026-07-23T06:07:39.299Z",
      },
    ],
    truncated: { events: true, tasks: false },
  };
  const truncated = toSnapshot(truncatedReading, SESSION);

  test("a finished task older than the window is not re-opened for review", () =>
    // Task 2 finished before the oldest event we hold, so its missing approval
    // proves nothing. Claiming review_pending would nag forever.
    expect(truncated.workOrders["WO-2026-0002"]?.status).toBe("completed"));

  test("a finished task inside the window still awaits review", () =>
    // Task 3 is within the window: if it had been approved we would hold it.
    expect(truncated.workOrders["WO-2026-0003"]?.status).toBe(
      "review_pending"
    ));

  test("the shortfall is reported, not swallowed", () => {
    const window = truncated.services.find(
      (service) => service.id === "SVC-ledger-window"
    );

    expect(window?.state).toBe("degraded");
    expect(window?.detail).toContain("oldest end");
  });

  /**
   * The two windows drop different rows, so naming the wrong criterion sends
   * the operator looking in the wrong place. `/events` is `ORDER BY id DESC`,
   * so the OLDEST go. `/tasks` is `ORDER BY priority DESC, id ASC`, so the
   * primary key is priority and the LOWEST-PRIORITY go — age only decides
   * within the boundary band.
   */
  test("a saturated task read names priority, not age, as what was dropped", () => {
    const shortfall = toSnapshot(
      { ...OLYMPUS_READING, truncated: { events: false, tasks: true } },
      SESSION
    ).services.find((service) => service.id === "SVC-ledger-window");

    expect(shortfall?.detail).toContain("lowest-priority");
    expect(shortfall?.detail).not.toContain("oldest end");
  });

  test("an untruncated reading claims no shortfall", () =>
    expect(
      snapshot.services.find((service) => service.id === "SVC-ledger-window")
    ).toBeUndefined());
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
      (event) => event.eventType === "review.approved"
    );

    expect(approved?.actorType).toBe("operator");
    expect(approved?.severity).toBe("success");
    expect(approved?.objectId).toBe("WO-2026-0002");
  });

  /**
   * Ledger consumers match `eventType` by prefix — `selectBriefing` counts
   * `workOrder*`, `review*`, `error*` and so on. Passing Olympus's own wire
   * names straight through meant nothing ever matched, so every briefing line
   * read zero forever, including "Errors surfaced: 0" while tasks were failing.
   */
  const vocabulary: [string, string, string][] = [
    ["human_approved", "", "review.approved"],
    ["created", "", "workOrder.created"],
    ["status_change", "in_progress -> done", "workOrder.completed"],
    ["status_change", "in_progress -> failed", "error.execution_failed"],
    ["status_change", "pending -> blocked", "error.blocked"],
    ["status_change", "pending -> rejected", "workOrder.rejected"],
    ["limits_patched", "", "policy.limits_changed"],
    ["publish_attempt", "", "artifact.publish_attempt"],
  ];

  test.each(vocabulary)(
    "olympus %p (%p) becomes the domain event %p",
    (name, msg, expected) =>
      expect(
        toLedgerEvent({
          event: name,
          id: 1,
          // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
          meta: null,
          msg,
          // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
          task_id: null,
          ts: SESSION,
        }).eventType
      ).toBe(expected)
  );

  test("a failure carries error severity even when Olympus calls it a status change", () =>
    expect(
      toLedgerEvent({
        event: "status_change",
        id: 1,
        // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
        meta: null,
        msg: "in_progress -> failed",
        // eslint-disable-next-line unicorn/no-null -- the wire format uses null.
        task_id: null,
        ts: SESSION,
      }).severity
    ).toBe("error"));

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
    // And it names the address it could not read, not just "offline".
    expect(adapter.getAuthority().detail).toContain("127.0.0.1:1");
  });

  /**
   * An unreachable runtime must not read as a revoked permission. The
   * capability gate refuses an application outright, with "you do not have
   * access to this application" — true when a scope was revoked, false and
   * misleading when the server is simply down.
   */
  test("an unreachable Olympus does not look like a revoked permission", () => {
    const adapter = createLocalAdapter({
      baseUrl: "http://127.0.0.1:1",
      sessionStartedAt: SESSION,
    });

    expect(adapter.readSnapshot().capabilities).toContain("workorders.read");
  });

  test("no capability grants a write, connected or not", () =>
    expect(
      snapshot.capabilities.filter(
        (capability) =>
          !capability.endsWith(".read") && capability !== "terminal.run"
      )
    ).toStrictEqual([]));

  const failures: [string, unknown, string][] = [
    [
      "a blocked cross-origin read names CORS",
      new TypeError("Failed to fetch"),
      "Access-Control-Allow-Origin",
    ],
    [
      "webkit's wording for the same failure is recognised too",
      new TypeError("Load failed"),
      "Access-Control-Allow-Origin",
    ],
    [
      "a timeout says so rather than blaming CORS",
      Object.assign(new Error("timed out"), { name: "TimeoutError" }),
      "did not answer within",
    ],
    [
      "anything else is reported verbatim",
      new Error("/tasks responded 500"),
      "/tasks responded 500",
    ],
  ];

  test.each(failures)("%s", (_name, error, expected) =>
    expect(describeReadFailure(error, "http://127.0.0.1:3001")).toContain(
      expected
    )
  );

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
    // Task 3 finished and nobody approved it. Olympus produces no Review
    // object, so counting reviews alone reported an empty queue while real
    // work waited on a human.
    expect(byId.pendingReview).toBe("1");
    // Every fixture task finished before this session began, so nothing is
    // attributed to it — the tile counts the session, not all of history.
    expect(byId.costToday).toBe("$0.00");
  });

  test("an unreviewed finished work order reaches the operator inbox", () => {
    const items = deriveAttentionItems(snapshot);

    expect(
      items.some(
        (item) => item.objectId === "WO-2026-0003" && item.kind === "review"
      )
    ).toBe(true);
  });

  test("an unreviewed finished task becomes an attention item", () => {
    const items = deriveAttentionItems(snapshot);

    expect(
      items.some(
        (item) => item.objectId === "WO-2026-0001" && item.kind === "blocked"
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

    expect(project?.costToDate.amount).toBeCloseTo(0.25);
    // The earliest task, not the last activity — Olympus has no project record.
    expect(project?.createdAt).toBe("2026-07-22T02:04:26.935Z");
  });

  /**
   * The last project step is named "Reviewed", and this adapter is emphatic
   * that Olympus's `done` does not mean reviewed. Both statements have to hold
   * at once, or one surface calls a project finished while another lists its
   * work as awaiting a decision.
   */
  test("a project is Reviewed only when every work order it holds is", () => {
    // examplestore holds task 2 (approved -> completed) and task 3 (done but
    // unapproved -> review_pending), so the project has NOT been reviewed.
    expect(snapshot.workOrders["WO-2026-0003"]?.status).toBe("review_pending");
    expect(snapshot.projects["project:examplestore"]?.stage.index).toBe(1);
  });

  test("a project whose every task is approved does reach Reviewed", () => {
    const approvedOnly = toSnapshot(
      {
        ...OLYMPUS_READING,
        tasks: OLYMPUS_READING.tasks.filter((task) => task.id === 2),
      },
      SESSION
    );

    expect(approvedOnly.projects["project:examplestore"]?.stage.index).toBe(2);
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
    expect(project?.blockers[0]).toContain("WO-2026-0001");
  });
});
