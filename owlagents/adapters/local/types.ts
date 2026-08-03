/**
 * The Olympus API wire shapes, as returned by `127.0.0.1:3001`.
 *
 * These are transcribed from the live service, not invented. They stay in the
 * adapter layer: the domain never sees an Olympus type, and Olympus never sees
 * an OwlAgents one.
 */

/** `pending → assigned → in_progress → done | failed | rejected | cancelled | blocked` */
export type OlympusTaskStatus =
  | "assigned"
  | "blocked"
  | "cancelled"
  | "done"
  | "failed"
  | "in_progress"
  | "pending"
  | "rejected";

export type OlympusTask = {
  agent_instance_id: string | null;
  artifact_refs: string | null;
  assigned_at: string | null;
  assignee: string;
  causation_id: string | null;
  completed_at: string | null;
  correlation_id: string | null;
  cost_actual: number | null;
  cost_estimate: number | null;
  created_at: string;
  created_by: string | null;
  dedupe_key: string | null;
  id: number;
  kill_criteria: string | null;
  notes: string | null;
  parent_id: number | null;
  payload: string;
  priority: number;
  project_id: string | null;
  result: string | null;
  started_at: string | null;
  status: OlympusTaskStatus;
  type: string;
  work_order_id: string | null;
};

export type OlympusEvent = {
  event: string;
  id: number;
  meta: string | null;
  msg: string;
  task_id: number | null;
  ts: string;
};

export type OlympusProject = {
  last_activity: string;
  project_id: string;
  tasks: number;
};

export type OlympusHealth = {
  agents: readonly string[];
  ok: boolean;
  service: string;
};

/**
 * Every member is optional: Olympus owns this table and adds caps to it as it
 * learns what needs capping. A new key must not break the read.
 */
export type OlympusLimits = {
  credits_pause_threshold?: number;
  credits_warn_threshold?: number;
  daily_new_tasks_cap?: number;
  daily_total_spend_cap?: number;
  hephaestus_cooldown_seconds?: number;
  hephaestus_fulfill_per_day_cap?: number;
  same_type_per_day_cap?: number;
  single_task_cost_max?: number;
};

export type OlympusStats = {
  byAgent: readonly { assignee: string; c: number; status: string }[];
  byStatus: readonly { c: number; status: string }[];
  limits: OlympusLimits;
  todaySpendActual: number;
  todaySpendEst: number;
};

/** Everything one refresh reads, so the snapshot is built from one moment. */
export type OlympusReading = {
  events: readonly OlympusEvent[];
  health: OlympusHealth;
  limits: OlympusLimits;
  projects: readonly OlympusProject[];
  stats: OlympusStats;
  tasks: readonly OlympusTask[];
  /**
   * Whether a read came back at its limit, meaning rows exist that this reading
   * does not hold. Which rows differs per endpoint and is not symmetric:
   * `/events` is `ORDER BY id DESC` so the OLDEST are dropped, while `/tasks` is
   * `ORDER BY priority DESC, id ASC` so the LOWEST-PRIORITY are dropped. Say
   * which in the operator-facing message; do not generalise to "older".
   *
   * Absent is treated as "not truncated" so a hand-written fixture does not have
   * to say so.
   */
  truncated?: {
    events: boolean;
    tasks: boolean;
  };
};
