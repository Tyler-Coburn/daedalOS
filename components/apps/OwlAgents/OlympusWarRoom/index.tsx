import { memo } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import {
  Card,
  Mono,
  Note,
  Scroll,
  SectionLabel,
} from "components/apps/OwlAgents/components/primitives";
import {
  useAgents,
  useIncidents,
  useWorkOrderList,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";

const Lanes = styled.div`
  display: grid;
  gap: ${OWL_TOKENS.space.md};
  grid-template-columns: repeat(3, 1fr);
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

const LaneHead = styled.div`
  align-items: center;
  display: flex;
  gap: ${OWL_TOKENS.space.sm};
  margin-bottom: ${OWL_TOKENS.space.sm};

  > strong {
    color: ${OWL_TOKENS.color.text};
  }

  > small {
    color: ${OWL_TOKENS.color.textDim};
  }
`;

const Log = styled.ol`
  border-top: 1px solid ${OWL_TOKENS.color.divider};
  list-style: none;
  margin: ${OWL_TOKENS.space.sm} 0 0;
  padding: ${OWL_TOKENS.space.sm} 0 0;

  > li {
    color: ${OWL_TOKENS.color.textDim};
    cursor: text;
    font-family: ${OWL_TOKENS.font.mono};
    font-size: ${OWL_TOKENS.font.monoSize};
    padding: 2px 0;
    user-select: text;
  }
`;

const Current = styled.p`
  color: ${OWL_TOKENS.color.textMuted};
  line-height: 1.5;
  margin: 0 0 ${OWL_TOKENS.space.sm};
`;

/**
 * Three runtime lanes: what each agent is doing now, what is waiting behind it,
 * and its recent log. A rate limit is shown as a blocked lane, never retried
 * quietly in the background.
 */
const OlympusWarRoom: FC<ComponentProcessProps> = ({ id }) => {
  const agents = useAgents();
  const incidents = useIncidents();
  const running = useWorkOrderList("running");
  const olympusAgents = agents.filter((agent) => agent.system === "OLY");

  return (
    <AppShell id={id}>
      <Scroll aria-label="Olympus war room" tabIndex={0}>
        <Note>
          {running.length} work orders running · {incidents.length} open
          incidents · a 429 is surfaced here and never retried automatically.
        </Note>
        <SectionLabel>Runtime lanes</SectionLabel>
        <Lanes>
          {olympusAgents.map((agent) => (
            <Card key={agent.id}>
              <LaneHead>
                <strong>{agent.name}</strong>
                <StatusChip label={agent.status} status={agent.status} />
              </LaneHead>
              <LaneHead>
                <small>{agent.role}</small>
              </LaneHead>
              <Current>
                {agent.currentTaskId
                  ? `Current: ${agent.currentTaskId}`
                  : "Idle — nothing assigned."}
              </Current>
              <Mono>{agent.model}</Mono>
              <SectionLabel>Waiting</SectionLabel>
              <Current>
                {agent.queuedTaskIds.length > 0
                  ? agent.queuedTaskIds.join(", ")
                  : "Queue empty."}
              </Current>
              <Log>
                {agent.recentLog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </Log>
            </Card>
          ))}
        </Lanes>
      </Scroll>
    </AppShell>
  );
};

export default memo(OlympusWarRoom);
