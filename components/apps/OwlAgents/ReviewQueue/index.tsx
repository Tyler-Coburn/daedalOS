import { memo, useCallback } from "react";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import { ComparisonViewer } from "components/apps/OwlAgents/components/Comparison";
import ObjectLink from "components/apps/OwlAgents/components/ObjectLink";
import {
  CommandFeedback,
  EmptyState,
  StaleState,
} from "components/apps/OwlAgents/components/States";
import {
  ActionBar,
  ActionButton,
  Card,
  CardGrid,
  ListButton,
  Mono,
  Note,
  OwlBody,
  Pane,
  Scroll,
  SectionLabel,
} from "components/apps/OwlAgents/components/primitives";
import useCommand from "components/apps/OwlAgents/hooks/useCommand";
import {
  useArtifact,
  useCanDecideReview,
  useEvidence,
  useOwlServices,
  useReview,
  useReviewList,
  useReviewStaleness,
} from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import {
  explainStaleness,
  isDecidableReviewState,
  REVIEW_DECISION_LABELS,
  REVIEW_DECISIONS,
  REVIEW_STATE_LABELS,
  type ReviewDecision,
} from "owlagents/domain/reviewDecision";

const EMPTY: readonly string[] = [];

/**
 * The authoritative decision surface.
 *
 * A review pins the artifact version and hash it was requested against. If the
 * artifact moves underneath it, the review goes stale: approval is disabled,
 * the reason is stated, the previous history is preserved, and a new cycle is
 * required. Nothing here reports a decision as committed until the store says
 * it committed.
 */
const ReviewQueue: FC<ComponentProcessProps> = ({ id }) => {
  const { selectedId, setSelectedId } = useOwlWindow(id);
  const reviews = useReviewList("all");
  const selected = useReview(selectedId || (reviews[0]?.id ?? ""));
  const staleness = useReviewStaleness(selected?.id ?? "");
  const canDecide = useCanDecideReview(selected?.id ?? "");
  const artifact = useArtifact(selected?.artifactIds[0] ?? "");
  const evidence = useEvidence(selected?.evidenceIds ?? EMPTY);
  const services = useOwlServices();

  const decide = useCallback(
    (decision: ReviewDecision) =>
      services.reviewService.submitDecision({
        artifactHash: selected?.expectedArtifactHash ?? "",
        decision,
        expectedArtifactVersion: selected?.expectedArtifactVersion ?? 0,
        expectedVersion: selected?.version ?? 0,
        id: selected?.id ?? "",
        reason: `Operator decision: ${decision}`,
      }),
    [selected, services]
  );
  const { error, phase, run } = useCommand(decide);

  return (
    <AppShell id={id}>
      <OwlBody>
        <Pane $width={OWL_TOKENS.size.listPane}>
          <SectionLabel>Reviews ({reviews.length})</SectionLabel>
          <Scroll aria-label="Reviews" tabIndex={0}>
            {reviews.map((review) => (
              <ListButton
                key={review.id}
                $selected={review.id === selected?.id}
                onClick={() => setSelectedId(review.id)}
                type="button"
              >
                <Mono>{review.id}</Mono>
                <div>{review.title}</div>
                <StatusChip
                  label={REVIEW_STATE_LABELS[review.status]}
                  status={review.status}
                />
              </ListButton>
            ))}
          </Scroll>
        </Pane>

        <Pane>
          <Scroll aria-label="Review detail" tabIndex={0}>
            {selected ? (
              <>
                <SectionLabel>
                  {selected.id} · {selected.type}
                </SectionLabel>
                <Note>
                  {selected.title} — requested by {selected.requestedBy}, risk{" "}
                  {selected.risk}.
                </Note>

                {staleness.isStale ? (
                  <StaleState reasons={explainStaleness(staleness)} />
                ) : undefined}

                <CardGrid>
                  <Card>
                    <SectionLabel>What changed</SectionLabel>
                    <Note>{selected.changeSummary}</Note>
                  </Card>
                  <Card>
                    <SectionLabel>Why it was produced</SectionLabel>
                    <Note>{selected.rationale}</Note>
                  </Card>
                </CardGrid>

                <CardGrid>
                  <Card>
                    <SectionLabel>Sources and evidence</SectionLabel>
                    {selected.sourceIds.map((sourceId) => (
                      <div key={sourceId}>
                        <ObjectLink id={sourceId} type="source" />
                      </div>
                    ))}
                    {evidence.map((item) => (
                      <div key={item.id}>
                        <Mono>{item.id}</Mono> {item.description}
                      </div>
                    ))}
                  </Card>
                  <Card>
                    <SectionLabel>Policy result and destination</SectionLabel>
                    <Note>{selected.policyResult}</Note>
                    <Note>Destination: {selected.destination}</Note>
                    <Note>
                      Work order:{" "}
                      <ObjectLink id={selected.workOrderId} type="workOrder" />
                    </Note>
                  </Card>
                </CardGrid>

                {artifact ? (
                  <ComparisonViewer
                    after={artifact.content}
                    afterLabel={`After · ${artifact.id} v${artifact.version}`}
                    before={artifact.previousContent ?? "(no previous version)"}
                    beforeLabel="Before"
                  />
                ) : undefined}

                <CommandFeedback error={error} phase={phase} />

                <ActionBar>
                  {REVIEW_DECISIONS.map((decision) => (
                    <ActionButton
                      key={decision}
                      disabled={!canDecide}
                      onClick={() => run(decision)}
                      title={
                        canDecide
                          ? undefined
                          : "This review cannot be decided in its current state."
                      }
                      type="button"
                    >
                      {REVIEW_DECISION_LABELS[decision]}
                    </ActionButton>
                  ))}
                  {artifact ? (
                    <ObjectLink
                      id={artifact.id}
                      label="Open in Artifact Viewer"
                      type="artifact"
                    />
                  ) : undefined}
                </ActionBar>
                <Note>
                  {isDecidableReviewState(selected.status)
                    ? "The backend validates state, version, artifact hash and permission before a decision commits."
                    : `Already ${REVIEW_STATE_LABELS[selected.status].toLowerCase()}. The decision history is preserved; a new review cycle is required to change it.`}
                </Note>
              </>
            ) : (
              <EmptyState
                description="Choose a review from the list."
                title="No review selected"
              />
            )}
          </Scroll>
        </Pane>
      </OwlBody>
    </AppShell>
  );
};

export default memo(ReviewQueue);
