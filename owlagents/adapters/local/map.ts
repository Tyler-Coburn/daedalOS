import {
  type OlympusEvent,
  type OlympusReading,
  type OlympusTask,
  type OlympusTaskStatus,
} from "owlagents/adapters/local/types";
import { describeEnvironment } from "owlagents/domain/authority";
import { isId } from "owlagents/domain/ids";
import {
  createEmptySnapshot,
  type OwlAgentsSnapshot,
} from "owlagents/domain/snapshot";
import {
  type Agent,
  type ExecutionRun,
  type LedgerEvent,
  type Money,
  type Project,
  type ServiceHealth,
  type WorkOrder,
} from "owlagents/domain/types";
import { type WorkOrderStatus } from "owlagents/domain/workOrderStatus";

/**
 * LOCAL, but honestly read-only.
 *
 * `describeEnvironment("LOCAL")` says writes are allowed, and for a writable
 * local authority that is right. This adapter refuses every command, so it
 * overrides the two write fields rather than letting the badge promise
 * something the adapter will not do. The mode itself is unchanged: the reads
 * really are local and really are authoritative.
 */
const READ_ONLY_LOCAL = {
  ...describeEnvironment("LOCAL"),
  canWrite: false,
  writeBlockedReason:
    "Read-only — daedalOS reads the Olympus runtime and does not drive it.",
};

/** Olympus leaves `project_id` null; the work still belongs somewhere. */
const UNASSIGNED_PROJECT = "project:unassigned";

const money = (amount: number | null): Money => ({
  amount: amount ?? 0,
  currency: "USD",
});

const pad = (value: number, width: number): string =>
  String(value).padStart(width, "0");

/**
 * Olympus ids are integers; OwlAgents ids are strings that must satisfy
 * `ID_PATTERNS` and stay stable across reads.
 *
 * The pattern conformance is not cosmetic. `resolveDeepLink` validates the id
 * before opening anything, so an id shaped like `WO-OLY-0001` makes every deep
 * link and every `ObjectLink` in the command center a dead end.
 *
 * Stability comes from immutable inputs: the task id and the year it was
 * created. Neither changes, so a link keeps working across sessions.
 */
const workOrderIdFor = (task: OlympusTask): string => {
  // A work_order_id assigned by Olympus wins — but only if it is well formed.
  // Accepting a malformed one would reintroduce the dead link it replaced.
  if (task.work_order_id !== null && isId("workOrder", task.work_order_id)) {
    return task.work_order_id;
  }

  return `WO-${task.created_at.slice(0, 4)}-${pad(task.id, 4)}`;
};

const runIdFor = (task: OlympusTask): string => `RUN-${pad(task.id, 4)}`;

/**
 * `project_id` is a free-text column in Olympus — anything a task author typed.
 * It gets the same guard as `work_order_id`: an id that cannot satisfy
 * `ID_PATTERNS` would key the projects map with something `resolveDeepLink`
 * rejects, which is the dead link this adapter already fixed once.
 */
const projectIdFor = (task: OlympusTask): string =>
  task.project_id !== null && isId("project", task.project_id)
    ? task.project_id
    : UNASSIGNED_PROJECT;

/**
 * Olympus task status is *execution* state. It says what the runtime did, not
 * whether an operator accepted it.
 */
const RUN_STATUS: Record<OlympusTaskStatus, ExecutionRun["status"]> = {
  assigned: "running",
  blocked: "blocked",
  cancelled: "cancelled",
  done: "completed",
  failed: "blocked",
  in_progress: "running",
  pending: "running",
  rejected: "cancelled",
};

/**
 * Governance status, derived from execution state *plus the ledger*.
 *
 * The important line is `done`. Olympus's `done` means the agent finished — it
 * does not mean anyone looked at the output. Mapping it to `completed` would
 * claim a review that never happened, so it maps to `review_pending` until a
 * `human_approved` event exists for that task. That is not an embellishment:
 * Olympus's own `/tasks/:id/approve` route logs exactly that event and leaves
 * the status alone, so the ledger is where the answer lives.
 */
export const workOrderStatusFor = (
  task: OlympusTask,
  approvedTaskIds: ReadonlySet<number>,
  /**
   * The id of the oldest event this reading holds, when the event window came
   * back full. Below it, absence of an approval is not evidence of absence: the
   * approval may simply be older than what `GET /events` returned.
   *
   * `review_pending` is the dangerous guess here, not `completed`. This adapter
   * refuses writes, so a work order wrongly parked in review is an alarm the
   * operator cannot clear from the command center — it would just accumulate.
   * A task that finished before the window is therefore reported as it stands
   * in Olympus, and the saturation itself is surfaced as a degraded service.
   */
  approvalHorizon?: number
): WorkOrderStatus => {
  switch (task.status) {
    case "assigned":
    case "pending":
      return "queued";
    case "blocked":
    case "failed":
      return "blocked";
    case "cancelled":
      return "cancelled";
    case "done": {
      if (approvedTaskIds.has(task.id)) return "completed";

      const isBeyondHorizon =
        approvalHorizon !== undefined && task.id < approvalHorizon;

      return isBeyondHorizon ? "completed" : "review_pending";
    }
    case "rejected":
      return "rejected";
    default:
      return "running";
  }
};

/** A brief, taken from the payload without pretending to understand it. */
const titleFor = (task: OlympusTask): string => {
  try {
    const payload = JSON.parse(task.payload) as Record<string, unknown>;
    const brief = payload.brief ?? payload.title ?? payload.summary;

    if (typeof brief === "string" && brief.length > 0) {
      return brief.length > 96 ? `${brief.slice(0, 95)}…` : brief;
    }
  } catch {
    // A payload that is not JSON is still a task; fall through to the type.
  }

  return `${task.type} task ${task.id}`;
};

const RUN_STEPS = [
  "Queued",
  "Picked up by runtime",
  "Execution finished",
  "Operator review",
];

/**
 * Stages describe where a task actually got to.
 *
 * `completed_at` cannot be the signal. Olympus stamps it on every terminal
 * transition — `done`, `failed`, `rejected` and `cancelled` all set it — so
 * keying on it marched a task that was rejected without ever running straight
 * to "Operator review", and `StageList` paints every step below the index as
 * done. The rail then told the operator a human had reviewed work that no agent
 * had even started.
 *
 * So each step is claimed only from evidence that the step happened, and
 * `StageList` marks the current index and everything below it as reached:
 *
 *   3 "Operator review"     — `done`: execution really finished
 *   2 "Execution finished"  — nothing else reaches this; a task that started
 *                             and then failed did NOT finish executing
 *   1 "Picked up by runtime"— it started, or Olympus assigned it
 *   0 "Queued"              — it never left the queue
 *
 * A failed task therefore sits at "Picked up by runtime", which is exactly
 * where it stopped, instead of announcing "Execution finished" one line above
 * its own failure message.
 */
const stageFor = (
  task: OlympusTask
): { index: number; steps: readonly string[] } => {
  if (task.status === "done") return { index: 3, steps: RUN_STEPS };

  const reachedRuntime = task.started_at !== null || task.assigned_at !== null;

  return { index: reachedRuntime ? 1 : 0, steps: RUN_STEPS };
};

const toExecutionRun = (task: OlympusTask): ExecutionRun => ({
  attempt: 1,
  cost: money(task.cost_actual ?? task.cost_estimate),
  endedAt: task.completed_at ?? undefined,
  error:
    task.status === "failed" ? (task.result ?? "Execution failed") : undefined,
  id: runIdFor(task),
  model: "olympus-runtime",
  outputArtifactIds: [],
  provider: "Olympus",
  runtime: "Olympus",
  startedAt: task.started_at ?? task.created_at,
  status: RUN_STATUS[task.status],
  tokenUsage: 0,
  workOrderId: workOrderIdFor(task),
});

const toWorkOrder = (
  task: OlympusTask,
  approvedTaskIds: ReadonlySet<number>,
  approvalHorizon?: number
): WorkOrder => {
  const status = workOrderStatusFor(task, approvedTaskIds, approvalHorizon);

  return {
    actualCost: money(task.cost_actual),
    agentId: task.assignee,
    artifactIds: [],
    blockedReason:
      status === "blocked" ? (task.result ?? "Execution failed") : undefined,
    completedAt: task.completed_at ?? undefined,
    createdAt: task.created_at,
    description: task.notes ?? titleFor(task),
    estimatedCost: money(task.cost_estimate),
    evidenceIds: [],
    id: workOrderIdFor(task),
    lane: `Olympus · ${task.assignee}`,
    priority:
      task.priority >= 80 ? "high" : task.priority <= 20 ? "low" : "normal",
    projectId: projectIdFor(task),
    requestedBy: task.created_by ?? "unknown",
    requestedScope: {
      costLimit: money(task.cost_estimate),
      denied: [],
      paths: [],
      permissions: [task.type],
    },
    reviewIds: [],
    risk: "low",
    runIds: [runIdFor(task)],
    sourceIds: [],
    stage: stageFor(task),
    status,
    title: titleFor(task),
    updatedAt: task.completed_at ?? task.started_at ?? task.created_at,
    version: 1,
  };
};

/**
 * Severity follows the translated type, not the wire name.
 *
 * Keying it on Olympus's own names looked reasonable and was dead code:
 * Olympus emits `created`, `status_change`, `human_approved`, `notify`,
 * `publish_attempt` and `limits_patched` — never `failed`, `error`, `blocked`
 * or `rejected`. Every entry matched nothing, so everything rendered as `info`,
 * including task failures.
 */
const severityFor = (eventType: string): LedgerEvent["severity"] => {
  if (eventType === "error.warning") return "warning";
  if (eventType.startsWith("error.")) return "error";
  if (eventType === "review.approved" || eventType === "workOrder.completed") {
    return "success";
  }
  if (
    eventType === "workOrder.rejected" ||
    eventType === "workOrder.cancelled"
  ) {
    return "warning";
  }

  return "info";
};

/**
 * Olympus's event names translated into the domain vocabulary.
 *
 * The ledger consumers read `eventType` by prefix — `selectBriefing` counts
 * `workOrder*`, `review*`, `memory*`, `policy*`, `artifact*`, `error*`. Passing
 * Olympus's own names straight through meant nothing ever matched, so every
 * briefing line read zero forever, including "Errors surfaced: 0" while tasks
 * were failing. A raw wire string is not a domain event; translating it is the
 * adapter's job, which is exactly what this layer is for.
 */
const eventTypeFor = (event: OlympusEvent): string => {
  const message = event.msg.toLowerCase();

  switch (event.event) {
    case "human_approved":
      return "review.approved";
    case "limits_patched":
      return "policy.limits_changed";
    case "publish_attempt":
      return "artifact.publish_attempt";
    case "created":
      return "workOrder.created";
    // The destination status is the interesting part, and Olympus puts it in
    // the message as "<from> -> <to>".
    case "status_change":
      if (message.includes("-> failed")) return "error.execution_failed";
      if (message.includes("-> blocked")) return "error.blocked";
      if (message.includes("-> rejected")) return "workOrder.rejected";
      if (message.includes("-> cancelled")) return "workOrder.cancelled";
      if (message.includes("-> done")) return "workOrder.completed";

      return "workOrder.transition";
    // The dispatcher's own alerts. `notify` carries its level inside the text
    // — server.js writes `[${level}] ${title}: ${message}` — and the ones that
    // matter have task_id NULL, so no status_change exists to carry them. An
    // ecosystem-health failure reported as routine is the "Errors surfaced: 0
    // while things are burning" case all over again.
    case "notify":
      return message.startsWith("[error]")
        ? "error.runtime"
        : message.startsWith("[warn]")
          ? "error.warning"
          : "runtime.notice";
    default:
      return `runtime.${event.event}`;
  }
};

/**
 * `workOrderIds` maps an Olympus task id to the work-order id the snapshot
 * actually keyed that task under. It is passed in rather than recomputed
 * because a task may carry its own `work_order_id`: rebuilding `WO-OLY-####`
 * here would point the ledger at an object that is not in the snapshot, and
 * `ObjectLink` would open nothing.
 */
export const toLedgerEvent = (
  event: OlympusEvent,
  workOrderIds: ReadonlyMap<number, string> = new Map()
): LedgerEvent => {
  const isHuman = event.event.startsWith("human");
  const workOrderId =
    event.task_id === null ? undefined : workOrderIds.get(event.task_id);
  const eventType = eventTypeFor(event);

  return {
    actorId: isHuman ? "operator" : "runtime",
    actorType: isHuman ? "operator" : "runtime",
    eventType,
    id: `EVT-${pad(event.id, 6)}`,
    message: event.msg,
    objectId: workOrderId ?? "olympus",
    // An event whose task is outside the read window belongs to the system, not
    // to a work order the operator cannot open.
    objectType: workOrderId === undefined ? "system" : "workOrder",
    severity: severityFor(eventType),
    system: "OLY",
    timestamp: event.ts,
  };
};

const PROJECT_STEPS = ["Tasks queued", "Executed", "Reviewed"];

/** ISO-8601 sorts chronologically as text, so no Date is constructed. */
const earliestOf = (timestamps: readonly string[]): string =>
  timestamps.toSorted((a, b) => a.localeCompare(b))[0] ?? "";

/**
 * Olympus reports work per project; the rest is unknown and stays unknown.
 *
 * There is no project record in Olympus — a project is just a `project_id`
 * appearing on tasks. So everything here is derived from those tasks, and the
 * fields Olympus cannot answer say so rather than guessing a plausible value.
 */
const toProject = (
  projectId: string,
  tasks: readonly OlympusTask[],
  lastActivity: string,
  approvedTaskIds: ReadonlySet<number>,
  approvalHorizon?: number
): Project => {
  const blocked = tasks.filter(
    (task) => task.status === "blocked" || task.status === "failed"
  );
  const active = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "pending"
  );
  const started = tasks.filter((task) => task.started_at !== null);
  /**
   * The last step is named "Reviewed", so reaching it has to mean review
   * happened — and this file is emphatic elsewhere that Olympus's `done` does
   * not mean that. `workOrderStatusFor` sends an unapproved `done` task to
   * `review_pending` precisely because nobody looked at it yet.
   *
   * So the project rail asks the same question the work orders ask, rather than
   * a weaker one: the project is Reviewed only when every task it holds became
   * a `completed` work order. Anything else — failed, blocked, or finished but
   * unreviewed — leaves it at Executed, which is where it actually is.
   */
  const stageIndex =
    started.length === 0
      ? 0
      : tasks.every(
            (task) =>
              workOrderStatusFor(task, approvedTaskIds, approvalHorizon) ===
              "completed"
          )
        ? 2
        : 1;

  return {
    activeWorkOrderIds: active.map((task) => workOrderIdFor(task)),
    blockers: blocked.map(
      (task) => `${workOrderIdFor(task)} — ${task.result ?? "failed"}`
    ),
    costToDate: money(
      tasks.reduce((total, task) => total + (task.cost_actual ?? 0), 0)
    ),
    // The oldest task is the earliest evidence this project existed. Olympus
    // has no project record, so there is nothing more truthful to use.
    // ISO-8601 sorts chronologically, which is why these are strings.
    createdAt: earliestOf([
      lastActivity,
      ...tasks.map((task) => task.created_at),
    ]),
    health: blocked.length > 0 ? "at_risk" : "healthy",
    id: projectId,
    lockedDecisions: [],
    name: projectId.replace(/^project:/, ""),
    nextActions: [],
    // `phase` is a closed vocabulary, so it cannot say "unknown". Derive it
    // from what the tasks actually are rather than defaulting to a flattering
    // one: a queue that is still all research has not reached Build.
    phase: tasks.every((task) => task.type === "research")
      ? "Research"
      : "Build",
    purpose: "Reported by the Olympus runtime.",
    sourceOfTruth: "Olympus queue",
    stage: { index: stageIndex, steps: PROJECT_STEPS },
    updatedAt: lastActivity,
  };
};

const toAgents = (
  names: readonly string[],
  tasks: readonly OlympusTask[]
): Readonly<Record<string, Agent>> =>
  Object.fromEntries(
    names.map((name) => {
      const own = tasks.filter((task) => task.assignee === name);
      const current = own.find((task) => task.status === "in_progress");
      // `assigned` means Olympus has handed the task to this agent but it has
      // not started. Counting only `pending` dropped those tasks from both
      // sides, so the War Room printed "Idle — nothing assigned." and "Queue
      // empty." for an agent that had just been given work.
      const waiting = own.filter(
        (task) => task.status === "pending" || task.status === "assigned"
      );

      return [
        name,
        {
          currentTaskId: current ? workOrderIdFor(current) : undefined,
          deniedTools: [],
          id: name,
          lane: `OLYMPUS · ${name.toUpperCase()}`,
          model: "olympus-runtime",
          name,
          queuedTaskIds: waiting.map((task) => workOrderIdFor(task)),
          recentLog: [],
          role: "Olympus agent",
          status: current ? "working" : "idle",
          system: "OLY",
          tools: [],
        } satisfies Agent,
      ];
    })
  );

/**
 * What this operator may do, connected or not.
 *
 * Capabilities describe the operator; reachability describes the connection,
 * and the environment badge already says that. Returning an empty set when
 * Olympus is down would make every application announce "you do not have access
 * to this application" — a statement about permission that is simply false. The
 * honest offline screen is the app, open, empty, with a badge explaining why.
 *
 * Read-only throughout: no `.write`, no `.approve`, no `.publish`.
 */
export const LOCAL_CAPABILITIES: readonly string[] = [
  "agents.read",
  "artifacts.read",
  "integrations.read",
  "ledger.read",
  "memory.read",
  "policy.read",
  "projects.read",
  "reviews.read",
  "runtime.read",
  "sources.read",
  "terminal.run",
  "workorders.read",
];

const toServices = (reading: OlympusReading): readonly ServiceHealth[] => {
  const { truncated } = reading;
  const services: ServiceHealth[] = [
    {
      detail: `127.0.0.1 · ${reading.health.service}`,
      id: "SVC-olympus-api",
      name: "Olympus API",
      queueDepth: reading.tasks.filter((task) => task.status === "pending")
        .length,
      state: reading.health.ok ? "connected" : "degraded",
    },
    {
      detail: `${reading.tasks.length} tasks · today $${reading.stats.todaySpendActual.toFixed(2)} of $${reading.stats.limits.daily_total_spend_cap ?? 0} cap`,
      id: "SVC-task-queue",
      name: "Task queue",
      queueDepth: reading.tasks.filter((task) => task.status === "in_progress")
        .length,
      state: reading.health.ok ? "connected" : "degraded",
    },
  ];

  // A saturated read is a correctness problem, not a display one: review state
  // is derived from the event window, so a short window means the command
  // center is reasoning about a partial history. Say so where the operator
  // looks for service health, rather than letting it degrade silently.
  //
  // The two windows drop different ends, and naming the wrong one would send
  // the operator looking in the wrong place. `/events` is `ORDER BY id DESC`,
  // so it keeps the newest and drops the OLDEST. `/tasks` is `ORDER BY priority
  // DESC, id ASC`, so the primary key is priority: the LOWEST-PRIORITY rows go
  // first, and only within the boundary priority band does age decide.
  const shortfalls = [
    truncated?.events === true &&
      "the event history is cut off at its oldest end, so approvals older than the window are taken from Olympus as-is",
    truncated?.tasks === true &&
      "the task read hit its limit, and Olympus returns tasks highest-priority first, so the lowest-priority work orders are the ones missing",
  ].filter((line): line is string => typeof line === "string");

  if (shortfalls.length > 0) {
    services.push({
      detail: `This session is reading a partial history: ${shortfalls.join("; ")}.`,
      id: "SVC-ledger-window",
      name: "Read window",
      queueDepth: 0,
      state: "degraded",
    });
  }

  return services;
};

/**
 * One reading becomes one snapshot.
 *
 * Anything Olympus does not model — sources, artifacts, evidence, reviews,
 * memory candidates, policy — stays empty rather than being invented. An empty
 * Review Queue is the truth: Olympus has no reviews.
 */
export const toSnapshot = (
  reading: OlympusReading,
  sessionStartedAt: string
): OwlAgentsSnapshot => {
  const approved = new Set(
    reading.events
      .filter(
        (event) => event.event === "human_approved" && event.task_id !== null
      )
      .map((event) => event.task_id as number)
  );
  const byProject = new Map<string, OlympusTask[]>();
  const workOrderIds = new Map(
    reading.tasks.map((task) => [task.id, workOrderIdFor(task)])
  );
  // Only meaningful when the window is full. The oldest task id the events we
  // hold refer to is the point below which "no approval event" stops meaning
  // "not approved".
  const approvalHorizon =
    reading.truncated?.events === true
      ? Math.min(
          ...reading.events
            .map((event) => event.task_id)
            .filter((id): id is number => id !== null)
        )
      : undefined;

  reading.tasks.forEach((task) => {
    const id = projectIdFor(task);

    byProject.set(id, [...(byProject.get(id) ?? []), task]);
  });

  return {
    ...createEmptySnapshot(READ_ONLY_LOCAL, sessionStartedAt),
    agents: toAgents(reading.health.agents, reading.tasks),
    capabilities: LOCAL_CAPABILITIES,
    ledger: reading.events.map((event) => toLedgerEvent(event, workOrderIds)),
    projects: Object.fromEntries(
      [...byProject.entries()].map(([id, tasks]) => [
        id,
        toProject(
          id,
          tasks,
          reading.projects.find((project) => project.project_id === id)
            ?.last_activity ?? sessionStartedAt,
          approved,
          approvalHorizon
        ),
      ])
    ),
    runs: Object.fromEntries(
      reading.tasks.map((task) => [runIdFor(task), toExecutionRun(task)])
    ),
    services: toServices(reading),
    workOrders: Object.fromEntries(
      reading.tasks.map((task) => [
        workOrderIdFor(task),
        toWorkOrder(task, approved, approvalHorizon),
      ])
    ),
  };
};
