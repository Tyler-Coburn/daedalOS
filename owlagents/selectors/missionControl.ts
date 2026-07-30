import { isHealthyIntegrationState } from "owlagents/domain/authority";
import { isDecidableReviewState } from "owlagents/domain/reviewDecision";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { type AttentionItem } from "owlagents/domain/types";
import { WORK_ORDER_STATUS_LABELS } from "owlagents/domain/workOrderStatus";
import { selectEventsSinceLastSession } from "owlagents/selectors/ledger";
import { selectReviewStaleness } from "owlagents/selectors/reviews";

export type MissionControlStat = {
  id: string;
  label: string;
  tone: "accent" | "error" | "neutral" | "ok" | "warning";
  value: string;
};

/**
 * The six header tiles. Every value is counted from domain state on read — none
 * of these numbers is stored anywhere, so none of them can go stale.
 */
export const selectMissionControlStats = (
  snapshot: OwlAgentsSnapshot
): readonly MissionControlStat[] => {
  const workOrders = Object.values(snapshot.workOrders);
  const reviews = Object.values(snapshot.reviews);
  const agents = Object.values(snapshot.agents);
  const cost = workOrders.reduce(
    (total, workOrder) => total + workOrder.actualCost.amount,
    0
  );
  const degraded = snapshot.services.filter(
    (service) => !isHealthyIntegrationState(service.state)
  ).length;

  return [
    {
      id: "activeWork",
      label: "Active work",
      tone: "accent",
      value: String(
        workOrders.filter((workOrder) =>
          ["artifact_ready", "queued", "running"].includes(workOrder.status)
        ).length
      ),
    },
    {
      id: "pendingReview",
      label: "Pending review",
      tone: "accent",
      value: String(
        reviews.filter((review) => isDecidableReviewState(review.status)).length
      ),
    },
    {
      id: "blocked",
      label: "Blocked",
      tone: "error",
      value: String(
        workOrders.filter((workOrder) => workOrder.status === "blocked").length
      ),
    },
    {
      id: "agentsWorking",
      label: "Agents working",
      tone: "ok",
      value: String(
        agents.filter((agent) => agent.status === "working").length
      ),
    },
    {
      id: "costToday",
      label: "Cost today",
      tone: "neutral",
      value: `$${cost.toFixed(2)}`,
    },
    {
      id: "degradedServices",
      label: "Degraded services",
      tone: degraded > 0 ? "warning" : "ok",
      value: String(degraded),
    },
  ];
};

/**
 * The operator inbox, derived on every read.
 *
 * An attention item exists only while the condition that produced it is still
 * true. Resolve the work order, decide the review, publish the candidate, and
 * the row is simply not generated again — there is nothing to dismiss and
 * nothing to clean up.
 */
export const deriveAttentionItems = (
  snapshot: OwlAgentsSnapshot
): readonly AttentionItem[] => {
  const items: AttentionItem[] = [];

  Object.values(snapshot.workOrders).forEach((workOrder) => {
    if (workOrder.status === "approval_required") {
      items.push({
        detail: `${workOrder.title} is waiting for you to approve bounded execution.`,
        id: `approval-${workOrder.id}`,
        kind: "approval",
        objectId: workOrder.id,
        objectType: "workOrder",
        projectId: workOrder.projectId,
        risk: workOrder.risk,
        title: workOrder.id,
      });
    }
    if (workOrder.status === "blocked") {
      items.push({
        detail:
          workOrder.blockedReason ??
          `${workOrder.title} is blocked and will not retry on its own.`,
        id: `blocked-${workOrder.id}`,
        kind: "blocked",
        objectId: workOrder.id,
        objectType: "workOrder",
        projectId: workOrder.projectId,
        risk: "high",
        title: workOrder.id,
      });
    }
  });

  Object.values(snapshot.reviews).forEach((review) => {
    if (!isDecidableReviewState(review.status)) return;

    const { isStale } = selectReviewStaleness(review.id)(snapshot);
    const isCost = review.type === "Cost exception";

    items.push({
      detail: isStale
        ? `${review.title} — the artifact changed, so a new review cycle is required.`
        : review.title,
      id: `review-${review.id}`,
      kind: isCost ? "cost" : "review",
      objectId: review.id,
      objectType: "review",
      projectId: review.projectId,
      risk: isStale ? "high" : review.risk,
      title: review.id,
    });
  });

  Object.values(snapshot.memoryCandidates).forEach((candidate) => {
    if (candidate.conflicts.length > 0 && candidate.status !== "published") {
      items.push({
        detail:
          candidate.conflicts[0] ?? "This candidate conflicts with canon.",
        id: `memory-conflict-${candidate.id}`,
        kind: "memory",
        objectId: candidate.id,
        objectType: "memory",
        projectId: candidate.projectId,
        risk: "medium",
        title: candidate.id,
      });
    }
    if (candidate.status === "staged") {
      items.push({
        detail: `${candidate.title} is staged and waiting for your publication click.`,
        id: `memory-staged-${candidate.id}`,
        kind: "memory",
        objectId: candidate.id,
        objectType: "memory",
        projectId: candidate.projectId,
        risk: "medium",
        title: candidate.id,
      });
    }
  });

  const riskOrder = { high: 0, low: 2, medium: 1 };

  return items.sort(
    (a, b) => riskOrder[a.risk] - riskOrder[b.risk] || a.id.localeCompare(b.id)
  );
};

export type BriefingLine = {
  count: number;
  id: string;
  label: string;
};

/**
 * "Since your last session" — counted from the ledger, not stored as a
 * sentence. The prose is assembled at render time from these counts.
 */
export const selectBriefing = (
  snapshot: OwlAgentsSnapshot
): readonly BriefingLine[] => {
  const events = selectEventsSinceLastSession(snapshot);
  const countOf = (prefix: string): number =>
    events.filter((event) => event.eventType.startsWith(prefix)).length;

  return [
    {
      count: countOf("workOrder"),
      id: "workOrders",
      label: "Work-order events",
    },
    { count: countOf("review"), id: "reviews", label: "Review events" },
    { count: countOf("memory"), id: "memory", label: "Memory events" },
    { count: countOf("policy"), id: "policy", label: "Policy decisions" },
    {
      count: countOf("artifact"),
      id: "artifacts",
      label: "Artifacts produced",
    },
    { count: countOf("error"), id: "errors", label: "Errors surfaced" },
  ];
};

export type ProjectPulse = {
  activeCount: number;
  blockerCount: number;
  health: string;
  id: string;
  name: string;
  nextAction: string;
  phase: string;
  stageLabel: string;
};

export const selectProjectPulse = (
  snapshot: OwlAgentsSnapshot
): readonly ProjectPulse[] =>
  Object.values(snapshot.projects).map((project) => {
    const workOrders = Object.values(snapshot.workOrders).filter(
      (workOrder) => workOrder.projectId === project.id
    );

    return {
      activeCount: workOrders.filter((workOrder) =>
        ["artifact_ready", "queued", "running"].includes(workOrder.status)
      ).length,
      blockerCount: workOrders.filter(
        (workOrder) => workOrder.status === "blocked"
      ).length,
      health: project.health,
      id: project.id,
      name: project.name,
      nextAction: project.nextActions[0] ?? "No next action recorded",
      phase: project.phase,
      stageLabel: `${project.stage.index + 1} of ${project.stage.steps.length}`,
    };
  });

export type ActiveWorkRow = {
  agent: string;
  cost: string;
  id: string;
  lastEvent: string;
  stageLabel: string;
  status: string;
  title: string;
};

export const selectActiveWork = (
  snapshot: OwlAgentsSnapshot
): readonly ActiveWorkRow[] =>
  Object.values(snapshot.workOrders)
    .filter(
      (workOrder) =>
        !["cancelled", "completed", "rejected"].includes(workOrder.status)
    )
    .map((workOrder) => ({
      agent: workOrder.agentId ?? "unassigned",
      cost: `$${workOrder.actualCost.amount.toFixed(2)}`,
      id: workOrder.id,
      lastEvent:
        snapshot.ledger.find((event) => event.objectId === workOrder.id)
          ?.message ?? "No events yet",
      stageLabel:
        workOrder.stage.steps[workOrder.stage.index] ?? "No stage recorded",
      status: WORK_ORDER_STATUS_LABELS[workOrder.status],
      title: workOrder.title,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
