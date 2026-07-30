import { memo, useCallback } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import {
  StageList,
  StateTimeline,
} from "components/apps/OwlAgents/components/Comparison";
import ObjectLink from "components/apps/OwlAgents/components/ObjectLink";
import {
  CommandFeedback,
  EmptyState,
} from "components/apps/OwlAgents/components/States";
import {
  ActionBar,
  ActionButton,
  Card,
  FieldGrid,
  FieldLabel,
  FieldValue,
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
  useAllowedTransitions,
  useContextPack,
  useEvidence,
  useLedger,
  useOwlServices,
  usePolicyDecision,
  useProject,
  useReviewsForWorkOrder,
  useWorkOrder,
  useWorkOrderCounts,
  useWorkOrderList,
} from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import {
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderStatus,
} from "owlagents/domain/workOrderStatus";
import { type WorkOrderFilter } from "owlagents/selectors/workOrders";

const EMPTY: readonly string[] = [];

const RailButton = styled(ListButton)`
  display: flex;
  justify-content: space-between;
`;

const Title = styled.h3`
  color: ${OWL_TOKENS.color.text};
  font-size: ${OWL_TOKENS.font.titleSize};
  font-weight: 700;
  margin: 0;
  padding: ${OWL_TOKENS.space.md} ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.sm};
`;

const filterLabel = (filter: WorkOrderFilter): string =>
  filter === "all" ? "All" : WORK_ORDER_STATUS_LABELS[filter];

/**
 * Left filter rail, centre list, right detail.
 *
 * The action buttons are generated from the transitions that are legal right
 * now, so an illegal move is not merely rejected — it is never offered. Every
 * button carries the expected version, and the result of the request (including
 * a refusal) is rendered rather than assumed.
 */
const WorkOrders: FC<ComponentProcessProps> = ({ id }) => {
  const { filter, selectedId, setFilter, setSelectedId } = useOwlWindow(id);
  const activeFilter = (filter || "all") as WorkOrderFilter;
  const counts = useWorkOrderCounts();
  const orders = useWorkOrderList(activeFilter);
  const selected = useWorkOrder(selectedId || (orders[0]?.id ?? ""));
  const transitions = useAllowedTransitions(selected?.id ?? "");
  const policy = usePolicyDecision(selected?.policyDecisionId);
  const pack = useContextPack(selected?.contextPackId);
  const project = useProject(selected?.projectId ?? "");
  const evidence = useEvidence(selected?.evidenceIds ?? EMPTY);
  const reviews = useReviewsForWorkOrder(selected?.id ?? "");
  const events = useLedger(
    selected ? { limit: 6, objectId: selected.id } : { limit: 0 }
  );
  const services = useOwlServices();

  const transition = useCallback(
    (to: WorkOrderStatus) =>
      services.workOrderService.requestTransition({
        expectedVersion: selected?.version ?? 0,
        id: selected?.id ?? "",
        reason: `Operator requested ${to}`,
        to,
      }),
    [selected, services]
  );
  const { error, phase, run } = useCommand(transition);

  return (
    <AppShell id={id}>
      <OwlBody>
        <Pane $width={OWL_TOKENS.size.filterRail}>
          <SectionLabel>Filter</SectionLabel>
          <Scroll aria-label="Status filters" tabIndex={0}>
            {counts.map((entry) => (
              <RailButton
                key={entry.filter}
                $selected={entry.filter === activeFilter}
                onClick={() => setFilter(entry.filter)}
                type="button"
              >
                <span>{filterLabel(entry.filter)}</span>
                <Mono>{entry.count}</Mono>
              </RailButton>
            ))}
          </Scroll>
        </Pane>

        <Pane>
          <SectionLabel>Work orders ({orders.length})</SectionLabel>
          <Scroll aria-label="Work orders" tabIndex={0}>
            {orders.map((order) => (
              <ListButton
                key={order.id}
                $selected={order.id === selected?.id}
                onClick={() => setSelectedId(order.id)}
                type="button"
              >
                <Mono>{order.id}</Mono>
                <div>{order.title}</div>
                <StatusChip
                  label={WORK_ORDER_STATUS_LABELS[order.status]}
                  status={order.status}
                />
              </ListButton>
            ))}
          </Scroll>
        </Pane>

        <Pane $width={OWL_TOKENS.size.detailPane}>
          <Scroll aria-label="Work order detail" tabIndex={0}>
            {selected ? (
              <>
                <Note>
                  <Mono>{selected.id}</Mono> · version {selected.version}
                </Note>
                <Title>{selected.title}</Title>
                <Note>
                  <StatusChip
                    label={WORK_ORDER_STATUS_LABELS[selected.status]}
                    status={selected.status}
                  />
                </Note>

                <FieldGrid>
                  <div>
                    <FieldLabel>Project</FieldLabel>
                    <FieldValue>
                      <ObjectLink
                        id={selected.projectId}
                        label={project?.name ?? selected.projectId}
                        type="project"
                      />
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Lane</FieldLabel>
                    <FieldValue>{selected.lane}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Agent</FieldLabel>
                    <FieldValue>{selected.agentId ?? "unassigned"}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Requested by</FieldLabel>
                    <FieldValue>{selected.requestedBy}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Priority</FieldLabel>
                    <FieldValue>{selected.priority}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Risk</FieldLabel>
                    <FieldValue>{selected.risk}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Estimated cost</FieldLabel>
                    <FieldValue>
                      ${selected.estimatedCost.amount.toFixed(2)}
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Actual cost</FieldLabel>
                    <FieldValue>
                      ${selected.actualCost.amount.toFixed(2)}
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Context pack</FieldLabel>
                    <FieldValue>{pack?.title ?? "none"}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Sources</FieldLabel>
                    <FieldValue>
                      {selected.sourceIds.length > 0
                        ? selected.sourceIds.map((sourceId) => (
                            <ObjectLink
                              key={sourceId}
                              id={sourceId}
                              type="source"
                            />
                          ))
                        : "none"}
                    </FieldValue>
                  </div>
                </FieldGrid>

                <SectionLabel>Stages</SectionLabel>
                <StageList
                  index={selected.stage.index}
                  steps={selected.stage.steps}
                />
                {selected.blockedReason ? (
                  <Note>{selected.blockedReason}</Note>
                ) : undefined}

                <SectionLabel>Policy decision</SectionLabel>
                {policy ? (
                  <Note>
                    {policy.result} — {policy.reasons.join(" ")} Allowed scope:{" "}
                    <Mono>{policy.allowedScope.paths.join(", ")}</Mono>. Denied:{" "}
                    <Mono>
                      {policy.allowedScope.denied.join(", ") || "none"}
                    </Mono>
                    .
                  </Note>
                ) : (
                  <Note>No policy decision yet. Submit to request one.</Note>
                )}

                <SectionLabel>Artifacts and evidence</SectionLabel>
                <Card>
                  {selected.artifactIds.map((artifactId) => (
                    <div key={artifactId}>
                      <ObjectLink id={artifactId} type="artifact" />
                    </div>
                  ))}
                  {evidence.map((item) => (
                    <div key={item.id}>
                      <Mono>{item.id}</Mono> {item.description}
                    </div>
                  ))}
                </Card>

                <SectionLabel>Reviews</SectionLabel>
                <Card>
                  {reviews.length > 0
                    ? reviews.map((review) => (
                        <div key={review.id}>
                          <ObjectLink id={review.id} type="review" />{" "}
                          {review.title}
                        </div>
                      ))
                    : "No reviews yet."}
                </Card>

                <SectionLabel>Event history</SectionLabel>
                <StateTimeline events={events} />

                <CommandFeedback error={error} phase={phase} />

                <ActionBar>
                  {transitions.length > 0 ? (
                    transitions.map((edge) => (
                      <ActionButton
                        key={edge.to}
                        onClick={() => run(edge.to)}
                        type="button"
                      >
                        {edge.trigger}
                      </ActionButton>
                    ))
                  ) : (
                    <Note>
                      No operator action is legal from{" "}
                      {WORK_ORDER_STATUS_LABELS[selected.status]}.
                    </Note>
                  )}
                </ActionBar>
                <Note>
                  The authoritative store validates state, version, permission
                  and whether an identical request already completed before any
                  transition commits.
                </Note>
              </>
            ) : (
              <EmptyState
                description="Choose a work order from the list."
                title="No work order selected"
              />
            )}
          </Scroll>
        </Pane>
      </OwlBody>
    </AppShell>
  );
};

export default memo(WorkOrders);
