import { memo, useCallback } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import { ComparisonViewer } from "components/apps/OwlAgents/components/Comparison";
import ObjectLink from "components/apps/OwlAgents/components/ObjectLink";
import {
  CommandFeedback,
  EmptyState,
} from "components/apps/OwlAgents/components/States";
import {
  ActionBar,
  ActionButton,
  Card,
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
  useExistingRecord,
  useMemoryCandidate,
  useMemoryCandidateList,
  useMemoryCounts,
  useOwlServices,
  usePublicationGate,
} from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import {
  MEMORY_STATE_LABELS,
  PUBLICATION_PRECONDITIONS,
} from "owlagents/domain/memoryLifecycle";

const Counts = styled.div`
  display: grid;
  gap: ${OWL_TOKENS.space.sm};
  grid-template-columns: repeat(3, 1fr);
  padding: ${OWL_TOKENS.space.md} ${OWL_TOKENS.space.lg};

  > div {
    background-color: ${OWL_TOKENS.color.surface2};
    border: 1px solid ${OWL_TOKENS.color.border};
    border-radius: ${OWL_TOKENS.radius.card};
    padding: ${OWL_TOKENS.space.sm};
    text-align: center;
  }

  strong {
    color: ${OWL_TOKENS.color.text};
    display: block;
    font-size: 17px;
  }

  span {
    color: ${OWL_TOKENS.color.textDim};
    font-size: ${OWL_TOKENS.font.sectionSize};
    letter-spacing: ${OWL_TOKENS.font.sectionTracking};
    text-transform: uppercase;
  }
`;

const Conflict = styled.div`
  border: 1px solid rgb(232 150 76 / 45%);
  border-left: 3px solid ${OWL_TOKENS.accent.warning};
  color: ${OWL_TOKENS.color.textMuted};
  margin: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
  padding: ${OWL_TOKENS.space.md};
`;

const Gate = styled.ol`
  color: ${OWL_TOKENS.color.textDim};
  font-size: 11px;
  line-height: 1.6;
  margin: 0;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md} 30px;
`;

/**
 * The publication gate, made visible.
 *
 * `candidate -> approved -> staged -> published` is enforced by the service, so
 * this surface only ever offers the next legal step. Publish stays disabled
 * until the candidate is staged, and it says why. Agents never publish.
 */
const WovensteadStaging: FC<ComponentProcessProps> = ({ id }) => {
  const { selectedId, setSelectedId } = useOwlWindow(id);
  const candidates = useMemoryCandidateList("all");
  const counts = useMemoryCounts();
  const selected = useMemoryCandidate(selectedId || (candidates[0]?.id ?? ""));
  const existing = useExistingRecord(selected?.id ?? "");
  const gate = usePublicationGate(selected?.id ?? "");
  const services = useOwlServices();

  const promote = useCallback(
    (step: "approve" | "publish" | "stage") => {
      const request = {
        expectedVersion: selected?.version ?? 0,
        id: selected?.id ?? "",
      };

      if (step === "approve") {
        return services.memoryService.approveCandidate(request);
      }
      if (step === "stage") {
        return services.memoryService.stageCandidate(request);
      }

      return services.memoryService.publishCandidate(request);
    },
    [selected, services]
  );
  const { error, phase, run } = useCommand(promote);

  return (
    <AppShell id={id}>
      <OwlBody>
        <Pane $width={OWL_TOKENS.size.stagingList}>
          <Counts>
            <div>
              <strong>{counts.candidates}</strong>
              <span>Candidates</span>
            </div>
            <div>
              <strong>{counts.approved}</strong>
              <span>Approved</span>
            </div>
            <div>
              <strong>{counts.published}</strong>
              <span>Published</span>
            </div>
          </Counts>
          <Scroll aria-label="Memory candidates" tabIndex={0}>
            {candidates.map((candidate) => (
              <ListButton
                key={candidate.id}
                $selected={candidate.id === selected?.id}
                onClick={() => setSelectedId(candidate.id)}
                type="button"
              >
                <Mono>{candidate.id}</Mono>
                <div>{candidate.title}</div>
                <StatusChip
                  label={MEMORY_STATE_LABELS[candidate.status]}
                  status={candidate.status}
                />
              </ListButton>
            ))}
          </Scroll>
        </Pane>

        <Pane>
          <Scroll aria-label="Candidate comparison" tabIndex={0}>
            {selected ? (
              <>
                <SectionLabel>
                  {selected.id} · {selected.title}
                </SectionLabel>
                <Note>
                  <StatusChip
                    label={MEMORY_STATE_LABELS[selected.status]}
                    status={selected.status}
                  />{" "}
                  version {selected.version} · from{" "}
                  <ObjectLink
                    id={selected.sourceWorkOrderId}
                    type="workOrder"
                  />
                </Note>

                {selected.conflicts.length > 0 ? (
                  <Conflict>
                    {selected.conflicts.map((conflict) => (
                      <div key={conflict}>{conflict}</div>
                    ))}
                  </Conflict>
                ) : undefined}

                <ComparisonViewer
                  after={selected.draftContent}
                  afterLabel={`Candidate · ${MEMORY_STATE_LABELS[selected.status]}`}
                  before={existing?.content ?? selected.comparison}
                  beforeLabel={
                    existing
                      ? `Existing record · ${existing.id}`
                      : "Existing Wovenstead record"
                  }
                />

                <CommandFeedback error={error} phase={phase} />

                <ActionBar>
                  <ActionButton
                    disabled={selected.status !== "candidate"}
                    onClick={() => run("approve")}
                    type="button"
                  >
                    Approve candidate
                  </ActionButton>
                  <ActionButton
                    disabled={selected.status !== "approved"}
                    onClick={() => run("stage")}
                    type="button"
                  >
                    Stage candidate
                  </ActionButton>
                  <ActionButton
                    disabled={!gate.canPublish}
                    onClick={() => run("publish")}
                    title={gate.reason || undefined}
                    type="button"
                  >
                    Publish to Wovenstead
                  </ActionButton>
                </ActionBar>
                {gate.reason ? <Note>{gate.reason}</Note> : undefined}

                <SectionLabel>Publication requires</SectionLabel>
                <Gate>
                  {PUBLICATION_PRECONDITIONS.map((precondition) => (
                    <li key={precondition}>{precondition}</li>
                  ))}
                </Gate>
                <Card>
                  Publishing preserves the previous canonical record and marks
                  it superseded. It is never overwritten and never deleted.
                </Card>
              </>
            ) : (
              <EmptyState
                description="Choose a memory candidate from the list."
                title="No candidate selected"
              />
            )}
          </Scroll>
        </Pane>
      </OwlBody>
    </AppShell>
  );
};

export default memo(WovensteadStaging);
