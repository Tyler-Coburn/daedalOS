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
  /**
   * Spend since the session began, not spend across the whole read window.
   *
   * This summed every work order in the snapshot under the label "today". The
   * demo fixtures are one curated day, so it was true there and no test could
   * catch it; the Olympus adapter reads months of history, and the tile
   * confidently reported lifetime spend as today's.
   *
   * `sessionStartedAt` is the only time boundary the domain carries — there is
   * no clock in this layer and there must not be one, because these selectors
   * are pure and are called during a static prerender. So the tile counts what
   * this session has seen finish, and says exactly that.
   */
  const cost = workOrders
    .filter(
      (workOrder) =>
        workOrder.completedAt !== undefined &&
        workOrder.completedAt >= snapshot.sessionStartedAt
    )
    .reduce((total, workOrder) => total + workOrder.actualCost.amount, 0);
  const degraded = snapshot.services.filter(
    (service) => !isHealthyIntegrationState(service.state)
  ).length;
  /**
   * Two things can be waiting on a human, and counting only one of them
   * under-reports the backlog.
   *
   * A `Review` is the rich form: an artifact, a pinned version, a decision. A
   * work order sitting in `review_pending` is the plain form — an authority
   * that has finished the work but records no review object. The Olympus
   * runtime only ever produces the second kind, so counting reviews alone
   * reported an empty queue while real work waited.
   */
  const decidableReviews = reviews.filter((review) =>
    isDecidableReviewState(review.status)
  );
  const reviewedWorkOrderIds = new Set(
    decidableReviews.map((review) => review.workOrderId)
  );
  // One item waiting, one count. A work order in `review_pending` that already
  // has a decidable review attached is the SAME thing asking for the SAME
  // decision — the demo adapter produces exactly that pairing two clicks into
  // its own scenario, and counting both made Mission Control disagree with the
  // Review Queue about how much was outstanding.
  const awaitingHuman =
    decidableReviews.length +
    workOrders.filter(
      (workOrder) =>
        workOrder.status === "review_pending" &&
        !reviewedWorkOrderIds.has(workOrder.id)
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
      value: String(awaitingHuman),
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
      label: "Cost this session",
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
  // Same rule as the "Pending review" tile, so the inbox and the count cannot
  // disagree about how many decisions are outstanding.
  const reviewedWorkOrderIds = new Set(
    Object.values(snapshot.reviews)
      .filter((review) => isDecidableReviewState(review.status))
      .map((review) => review.workOrderId)
  );

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
    /**
     * An authority that produces no Review objects still produces work waiting
     * on a human. Without this branch the Olympus runtime could fill the queue
     * with finished, unreviewed work and "Needs your attention" would stay
     * empty — the inbox silently omitting the only thing it exists to surface.
     *
     * Skipped when a decidable review already covers this work order: the
     * review row below says the same thing, and one decision should occupy one
     * line of the inbox.
     */
    if (
      workOrder.status === "review_pending" &&
      !reviewedWorkOrderIds.has(workOrder.id)
    ) {
      items.push({
        detail: `${workOrder.title} finished and is waiting for you to accept or reject the output.`,
        id: `review-pending-${workOrder.id}`,
        kind: "review",
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

/**
 * Everything not finished, which is deliberately wider than the "Active work"
 * tile — a blocked or unreviewed order is not active, but it is still open and
 * the operator needs to see it in the table.
 *
 * The two used to share the word "Active" and disagree: against the Olympus
 * runtime the tile read 1 while the table below it listed 3. The table is
 * captioned "Open work" now, and the tile keeps "Active work" with the same
 * predicate `selectProjectPulse` and Projects use, so every surface saying
 * "active" counts the same thing.
 */
export const selectOpenWork = (
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
