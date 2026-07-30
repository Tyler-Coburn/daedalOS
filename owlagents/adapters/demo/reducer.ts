import {
  type AdapterCommand,
  type CommandEnvelope,
  type CommandOutcome,
} from "owlagents/adapters/types";
import {
  canPromoteMemory,
  isOperatorOnlyMemoryTransition,
  type MemoryState,
} from "owlagents/domain/memoryLifecycle";
import {
  failResult,
  okResult,
  type ServiceResult,
} from "owlagents/domain/outcome";
import {
  isDecidableReviewState,
  REVIEW_DECISION_RESULT,
  reviewStaleness,
} from "owlagents/domain/reviewDecision";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import {
  type LedgerAppend,
  type LedgerEvent,
  type StageProgress,
} from "owlagents/domain/types";
import {
  canTransition,
  transitionTrigger,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderStatus,
} from "owlagents/domain/workOrderStatus";
import {
  INTAKE_STAGE_LABELS,
  nextIntakeStage,
} from "owlagents/domain/authority";

export type ReducerContext = {
  grantedScopes: ReadonlySet<string>;
  nextEventId: () => string;
  now: () => string;
};

type ReducerResult = {
  result: ServiceResult<CommandOutcome>;
  snapshot: OwlAgentsSnapshot;
};

const appendEvent = (
  snapshot: OwlAgentsSnapshot,
  append: LedgerAppend,
  context: ReducerContext
): { event: LedgerEvent; ledger: readonly LedgerEvent[] } => {
  const event: LedgerEvent = {
    ...append,
    id: context.nextEventId(),
    timestamp: context.now(),
  };

  return { event, ledger: [event, ...snapshot.ledger] };
};

/**
 * Keeps the stage list honest against the status. A work order that reaches
 * review is on its final stage; one that is blocked stopped where it stopped.
 */
const stageForStatus = (
  stage: StageProgress,
  status: WorkOrderStatus
): StageProgress => {
  if (status === "review_pending" || status === "completed") {
    return { ...stage, index: Math.max(0, stage.steps.length - 1) };
  }
  if (status === "running" && stage.index < stage.steps.length - 1) {
    return { ...stage, index: stage.index + 1 };
  }

  return stage;
};

const transitionWorkOrder = (
  snapshot: OwlAgentsSnapshot,
  envelope: CommandEnvelope,
  command: Extract<AdapterCommand, { kind: "workOrder.transition" }>,
  context: ReducerContext
): ReducerResult => {
  const workOrder = snapshot.workOrders[command.id];

  if (!workOrder) {
    return {
      result: failResult(
        "not_found",
        `Work order ${command.id} does not exist.`
      ),
      snapshot,
    };
  }
  if (!context.grantedScopes.has(envelope.permissionScope)) {
    return {
      result: failResult(
        "permission_denied",
        `You do not hold the ${envelope.permissionScope} scope.`,
        {
          action: "Ask an operator with that scope to perform this transition.",
        }
      ),
      snapshot,
    };
  }
  if (workOrder.version !== command.expectedVersion) {
    return {
      result: failResult(
        "stale_version",
        `${command.id} changed since you opened it (expected v${command.expectedVersion}, found v${workOrder.version}).`,
        { action: "Reload the work order and try again." }
      ),
      snapshot,
    };
  }
  if (!canTransition(workOrder.status, command.to)) {
    return {
      result: failResult(
        "stale_state",
        `${WORK_ORDER_STATUS_LABELS[workOrder.status]} cannot move to ${WORK_ORDER_STATUS_LABELS[command.to]}.`,
        { detail: `${workOrder.status} -> ${command.to}` }
      ),
      snapshot,
    };
  }

  const updated = {
    ...workOrder,
    blockedReason:
      command.to === "blocked" ? workOrder.blockedReason : undefined,
    stage: stageForStatus(workOrder.stage, command.to),
    status: command.to,
    updatedAt: context.now(),
    version: workOrder.version + 1,
  };
  const { event, ledger } = appendEvent(
    snapshot,
    {
      actorId: envelope.actorId,
      actorType: "operator",
      eventType: "workOrder.transition",
      idempotencyKey: envelope.idempotencyKey,
      message: `${command.id}: ${transitionTrigger(workOrder.status, command.to) ?? "transition"} — ${WORK_ORDER_STATUS_LABELS[workOrder.status]} to ${WORK_ORDER_STATUS_LABELS[command.to]}`,
      nextState: command.to,
      objectId: command.id,
      objectType: "workOrder",
      previousState: workOrder.status,
      projectId: workOrder.projectId,
      severity: command.to === "rejected" ? "warning" : "success",
      system: "OWL",
    },
    context
  );

  return {
    result: okResult(
      { nextState: command.to, objectId: command.id, objectType: "workOrder" },
      event.id
    ),
    snapshot: {
      ...snapshot,
      ledger,
      version: snapshot.version + 1,
      workOrders: { ...snapshot.workOrders, [command.id]: updated },
    },
  };
};

const decideReview = (
  snapshot: OwlAgentsSnapshot,
  envelope: CommandEnvelope,
  command: Extract<AdapterCommand, { kind: "review.decide" }>,
  context: ReducerContext
): ReducerResult => {
  const review = snapshot.reviews[command.id];

  if (!review) {
    return {
      result: failResult("not_found", `Review ${command.id} does not exist.`),
      snapshot,
    };
  }
  if (!context.grantedScopes.has(envelope.permissionScope)) {
    return {
      result: failResult(
        "permission_denied",
        `You do not hold the ${envelope.permissionScope} scope.`
      ),
      snapshot,
    };
  }
  if (!isDecidableReviewState(review.status)) {
    return {
      result: failResult(
        "stale_state",
        `This review is already ${review.status.replace("_", " ")}. Its history is preserved; a new cycle is required.`
      ),
      snapshot,
    };
  }

  const artifact = snapshot.artifacts[review.artifactIds[0] ?? ""];
  const staleness = reviewStaleness(
    {
      expectedArtifactHash: command.artifactHash,
      expectedArtifactVersion: command.expectedArtifactVersion,
      expectedVersion: command.expectedVersion,
    },
    {
      artifactHash: artifact?.hash ?? "",
      artifactVersion: artifact?.version ?? 0,
      version: review.version,
    }
  );

  if (staleness.isStale) {
    const stale = { ...review, status: "stale" as const };
    const staleAppend = appendEvent(
      snapshot,
      {
        actorId: envelope.actorId,
        actorType: "operator",
        eventType: "review.stale",
        idempotencyKey: envelope.idempotencyKey,
        message: `${command.id} is stale — the artifact it reviews changed. A new review cycle is required.`,
        objectId: command.id,
        objectType: "review",
        previousState: review.status,
        projectId: review.projectId,
        severity: "warning",
        system: "OWL",
      },
      context
    );

    return {
      result: failResult(
        "stale_version",
        `${command.id} can no longer be decided.`,
        {
          action: "Open the new artifact version and start a fresh review.",
          detail: staleness.reasons.join(", "),
        }
      ),
      snapshot: {
        ...snapshot,
        ledger: staleAppend.ledger,
        reviews: { ...snapshot.reviews, [command.id]: stale },
        version: snapshot.version + 1,
      },
    };
  }

  const nextStatus = REVIEW_DECISION_RESULT[command.decision];
  const updated = {
    ...review,
    decision: command.decision,
    decisionReason: command.reason,
    reviewedAt: context.now(),
    reviewedBy: envelope.actorId,
    status: nextStatus,
    version: review.version + 1,
  };
  const { event, ledger } = appendEvent(
    snapshot,
    {
      actorId: envelope.actorId,
      actorType: "operator",
      eventType: "review.decision",
      idempotencyKey: envelope.idempotencyKey,
      message: `${command.id}: operator decision ${command.decision.replace("_", " ")}`,
      nextState: nextStatus,
      objectId: command.id,
      objectType: "review",
      previousState: review.status,
      projectId: review.projectId,
      severity: command.decision === "approve" ? "success" : "info",
      system: "OWL",
    },
    context
  );

  return {
    result: okResult(
      { nextState: nextStatus, objectId: command.id, objectType: "review" },
      event.id
    ),
    snapshot: {
      ...snapshot,
      ledger,
      reviews: { ...snapshot.reviews, [command.id]: updated },
      version: snapshot.version + 1,
    },
  };
};

const MEMORY_TARGET: Record<string, MemoryState> = {
  "memory.approve": "approved",
  "memory.publish": "published",
  "memory.stage": "staged",
};

const promoteMemory = (
  snapshot: OwlAgentsSnapshot,
  envelope: CommandEnvelope,
  command: Extract<
    AdapterCommand,
    { kind: "memory.approve" | "memory.publish" | "memory.stage" }
  >,
  context: ReducerContext
): ReducerResult => {
  const candidate = snapshot.memoryCandidates[command.id];
  const target = MEMORY_TARGET[command.kind];

  if (!candidate || !target) {
    return {
      result: failResult(
        "not_found",
        `Candidate ${command.id} does not exist.`
      ),
      snapshot,
    };
  }
  if (!context.grantedScopes.has(envelope.permissionScope)) {
    return {
      result: failResult(
        "permission_denied",
        `Publication and staging are operator-only. You do not hold ${envelope.permissionScope}.`,
        { action: "An operator with that scope must perform this step." }
      ),
      snapshot,
    };
  }
  if (candidate.version !== command.expectedVersion) {
    return {
      result: failResult(
        "stale_version",
        `${command.id} changed since you opened it (expected v${command.expectedVersion}, found v${candidate.version}).`
      ),
      snapshot,
    };
  }
  if (!canPromoteMemory(candidate.status, target)) {
    return {
      result: failResult(
        "stale_state",
        `A ${candidate.status} candidate cannot become ${target}. The order is candidate, approved, staged, published.`,
        { detail: `${candidate.status} -> ${target}` }
      ),
      snapshot,
    };
  }
  if (
    isOperatorOnlyMemoryTransition(candidate.status, target) &&
    envelope.actorId !== "operator"
  ) {
    return {
      result: failResult(
        "permission_denied",
        "Agents may propose a candidate. Only an operator approves, stages or publishes it."
      ),
      snapshot,
    };
  }

  const now = context.now();
  const updated = {
    ...candidate,
    approvedAt: target === "approved" ? now : candidate.approvedAt,
    publishedAt: target === "published" ? now : candidate.publishedAt,
    publishedBy:
      target === "published" ? envelope.actorId : candidate.publishedBy,
    stagedAt: target === "staged" ? now : candidate.stagedAt,
    status: target,
    version: candidate.version + 1,
  };

  let { wovensteadRecords } = snapshot;

  if (target === "published") {
    const previous = candidate.existingRecordId
      ? snapshot.wovensteadRecords[candidate.existingRecordId]
      : undefined;
    const recordId = `WSR-${String(
      Object.keys(snapshot.wovensteadRecords).length + 1
    ).padStart(4, "0")}`;

    wovensteadRecords = {
      ...snapshot.wovensteadRecords,
      [recordId]: {
        authority: "canonical",
        content: candidate.draftContent,
        hash: `${candidate.id.toLowerCase().replace("-", "")}${String(updated.version).padStart(2, "0")}`,
        id: recordId,
        projectId: candidate.projectId,
        provenance: {
          artifactId: candidate.sourceArtifactIds[0],
          candidateId: candidate.id,
          evidenceIds: [],
          sourceIds: [],
          workOrderId: candidate.sourceWorkOrderId,
        },
        publishedAt: now,
        publishedBy: envelope.actorId,
        title: candidate.title,
        version: 1,
      },
    };

    // The previous canonical record is preserved, never deleted.
    if (previous) {
      wovensteadRecords = {
        ...wovensteadRecords,
        [previous.id]: {
          ...previous,
          authority: "superseded",
          supersededAt: now,
          supersededByRecordId: recordId,
        },
      };
    }
  }

  const { event, ledger } = appendEvent(
    snapshot,
    {
      actorId: envelope.actorId,
      actorType: "operator",
      eventType: `memory.${target}`,
      idempotencyKey: envelope.idempotencyKey,
      message:
        target === "published"
          ? `${command.id} published to Wovenstead by operator click. The previous record is preserved and marked superseded.`
          : `${command.id} moved from ${candidate.status} to ${target}.`,
      nextState: target,
      objectId: command.id,
      objectType: "memoryCandidate",
      previousState: candidate.status,
      projectId: candidate.projectId,
      severity: "success",
      system: "WOV",
    },
    context
  );

  return {
    result: okResult(
      {
        nextState: target,
        objectId: command.id,
        objectType: "memoryCandidate",
      },
      event.id
    ),
    snapshot: {
      ...snapshot,
      ledger,
      memoryCandidates: { ...snapshot.memoryCandidates, [command.id]: updated },
      version: snapshot.version + 1,
      wovensteadRecords,
    },
  };
};

/** SRC-#### is stable and sequential, so a new source never reuses an id. */
const nextSourceId = (snapshot: OwlAgentsSnapshot): string => {
  const highest = Object.keys(snapshot.sources).reduce((max, id) => {
    const value = Number.parseInt(id.replace("SRC-", ""), 10);

    return Number.isNaN(value) || value <= max ? max : value;
  }, 0);

  return `SRC-${String(highest + 1).padStart(4, "0")}`;
};

const typeFromName = (name: string): string => {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const known: Record<string, string> = {
    csv: "spreadsheet",
    eml: "email",
    json: "batch",
    log: "log",
    md: "document",
    pdf: "document",
    txt: "document",
    xlsx: "spreadsheet",
  };

  return known[extension] ?? "file";
};

/**
 * A dropped file enters at `received` and is not authoritative.
 *
 * It becomes so only by walking the intake stages, each one a separate
 * committed transition with its own ledger event. Nothing here claims the file
 * has been classified or policy-checked simply because it exists.
 */
const ingestSource = (
  snapshot: OwlAgentsSnapshot,
  envelope: CommandEnvelope,
  command: Extract<AdapterCommand, { kind: "source.ingest" }>,
  context: ReducerContext
): ReducerResult => {
  if (!context.grantedScopes.has(envelope.permissionScope)) {
    return {
      result: failResult(
        "permission_denied",
        `You do not hold the ${envelope.permissionScope} scope.`
      ),
      snapshot,
    };
  }
  if (!snapshot.projects[command.projectId]) {
    return {
      result: failResult(
        "not_found",
        `Project ${command.projectId} does not exist, so the source has nothing to belong to.`
      ),
      snapshot,
    };
  }

  const id = nextSourceId(snapshot);
  const now = context.now();
  const { event, ledger } = appendEvent(
    snapshot,
    {
      actorId: envelope.actorId,
      actorType: "operator",
      eventType: "source.received",
      idempotencyKey: envelope.idempotencyKey,
      message: `${id} received: ${command.name} · sha256 ${command.hash.slice(0, 12)}… — preserved, not yet authoritative`,
      nextState: "received",
      objectId: id,
      objectType: "source",
      projectId: command.projectId,
      severity: "info",
      system: "OWL",
    },
    context
  );

  return {
    result: okResult(
      { nextState: "received", objectId: id, objectType: "source" },
      event.id
    ),
    snapshot: {
      ...snapshot,
      ledger,
      sources: {
        ...snapshot.sources,
        [id]: {
          authority: "raw",
          hash: command.hash,
          hashAlgorithm: "sha256",
          id,
          ingestedAt: now,
          ingestedBy: envelope.actorId,
          intakeStage: "received",
          mount: "STAGING · RW",
          name: command.name,
          originalLocation: `dropped by operator: ${command.name}`,
          path: command.path,
          preservedLocation: command.path.slice(
            0,
            command.path.lastIndexOf("/")
          ),
          projectId: command.projectId,
          referencedByWorkOrderIds: [],
          size: command.size,
          type: typeFromName(command.name),
        },
      },
      version: snapshot.version + 1,
    },
  };
};

/** What each stage actually did, so the ledger line is worth reading. */
const INTAKE_NOTE: Partial<Record<string, string>> = {
  assigned: " to its project",
  classifying: " by extension and content type",
  policy_checked: " against POL-002 (read-only ingestion, whitelisted origins)",
  preserved: " to the sources mount",
  ready: " — now referenceable by a work order",
};

const advanceIntake = (
  snapshot: OwlAgentsSnapshot,
  envelope: CommandEnvelope,
  command: Extract<AdapterCommand, { kind: "source.advanceIntake" }>,
  context: ReducerContext
): ReducerResult => {
  const source = snapshot.sources[command.id];

  if (!source) {
    return {
      result: failResult("not_found", `Source ${command.id} does not exist.`),
      snapshot,
    };
  }

  const next = nextIntakeStage(source.intakeStage);

  if (!next) {
    return {
      result: failResult(
        "stale_state",
        `${command.id} has finished intake (${source.intakeStage}).`
      ),
      snapshot,
    };
  }

  const { event, ledger } = appendEvent(
    snapshot,
    {
      actorId: envelope.actorId,
      actorType: "runtime",
      eventType: "source.intake",
      idempotencyKey: envelope.idempotencyKey,
      message: `${command.id} ${INTAKE_STAGE_LABELS[next].toLowerCase()}${INTAKE_NOTE[next] ?? ""}`,
      nextState: next,
      objectId: command.id,
      objectType: "source",
      previousState: source.intakeStage,
      projectId: source.projectId,
      severity: "info",
      system: "OWL",
    },
    context
  );

  return {
    result: okResult(
      { nextState: next, objectId: command.id, objectType: "source" },
      event.id
    ),
    snapshot: {
      ...snapshot,
      ledger,
      sources: {
        ...snapshot.sources,
        [command.id]: { ...source, intakeStage: next },
      },
      version: snapshot.version + 1,
    },
  };
};

export const applyCommandToSnapshot = (
  snapshot: OwlAgentsSnapshot,
  envelope: CommandEnvelope,
  context: ReducerContext
): ReducerResult => {
  const { command } = envelope;

  switch (command.kind) {
    case "memory.approve":
    case "memory.publish":
    case "memory.stage":
      return promoteMemory(snapshot, envelope, command, context);
    case "review.decide":
      return decideReview(snapshot, envelope, command, context);
    case "source.advanceIntake":
      return advanceIntake(snapshot, envelope, command, context);
    case "source.ingest":
      return ingestSource(snapshot, envelope, command, context);
    case "workOrder.transition":
      return transitionWorkOrder(snapshot, envelope, command, context);
    default:
      return {
        result: failResult("failed", "Unsupported command."),
        snapshot,
      };
  }
};
