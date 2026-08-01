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

const projectIdFor = (task: OlympusTask): string =>
  task.project_id ?? UNASSIGNED_PROJECT;

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
  approvedTaskIds: ReadonlySet<number>
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
    case "done":
      return approvedTaskIds.has(task.id) ? "completed" : "review_pending";
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

/**
 * Stages describe where a task actually got to. There is no percentage,
 * and no stage is claimed that the timestamps do not support.
 */
const stageFor = (
  task: OlympusTask
): { index: number; steps: readonly string[] } => {
  const steps = [
    "Queued",
    "Picked up by runtime",
    "Execution finished",
    "Operator review",
  ];
  const index = task.completed_at
    ? 3
    : task.started_at
      ? 2
      : task.assigned_at
        ? 1
        : 0;

  return { index, steps };
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
  approvedTaskIds: ReadonlySet<number>
): WorkOrder => {
  const status = workOrderStatusFor(task, approvedTaskIds);

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

const SEVERITY: Record<string, LedgerEvent["severity"]> = {
  blocked: "warning",
  error: "error",
  failed: "error",
  human_approved: "success",
  rejected: "warning",
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

  return {
    actorId: isHuman ? "operator" : "runtime",
    actorType: isHuman ? "operator" : "runtime",
    eventType: event.event,
    id: `EVT-${pad(event.id, 6)}`,
    message: event.msg,
    objectId: workOrderId ?? "olympus",
    // An event whose task is outside the read window belongs to the system, not
    // to a work order the operator cannot open.
    objectType: workOrderId === undefined ? "system" : "workOrder",
    severity: SEVERITY[event.event] ?? "info",
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
  lastActivity: string
): Project => {
  const blocked = tasks.filter(
    (task) => task.status === "blocked" || task.status === "failed"
  );
  const active = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "pending"
  );
  const started = tasks.filter((task) => task.started_at !== null);
  // 0 while work is only queued, 1 once something has run, 2 once every task
  // has finished. Never a guess: each step is a fact about the task list.
  const stageIndex = started.length === 0 ? 0 : active.length === 0 ? 2 : 1;

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

      return [
        name,
        {
          currentTaskId: current ? workOrderIdFor(current) : undefined,
          deniedTools: [],
          id: name,
          lane: `OLYMPUS · ${name.toUpperCase()}`,
          model: "olympus-runtime",
          name,
          queuedTaskIds: own
            .filter((task) => task.status === "pending")
            .map((task) => workOrderIdFor(task)),
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

const toServices = (reading: OlympusReading): readonly ServiceHealth[] => [
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
            ?.last_activity ?? sessionStartedAt
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
        toWorkOrder(task, approved),
      ])
    ),
  };
};
