import { memo, useCallback } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import DataTable, {
  type DataColumn,
} from "components/apps/OwlAgents/components/DataTable";
import ObjectLink from "components/apps/OwlAgents/components/ObjectLink";
import { StateTimeline } from "components/apps/OwlAgents/components/Comparison";
import { CommandFeedback } from "components/apps/OwlAgents/components/States";
import {
  ActionButton,
  Card,
  CardGrid,
  Mono,
  Note,
  Scroll,
  SectionLabel,
  Tab,
  TabBar,
} from "components/apps/OwlAgents/components/primitives";
import {
  useOpenWork,
  useAgents,
  useAttentionItems,
  useAuthority,
  useBriefing,
  useIntegrations,
  useLedger,
  useMissionControlStats,
  useOwlServices,
  useProjectPulse,
  useServices,
} from "components/apps/OwlAgents/hooks/useOwlData";
import useCommand from "components/apps/OwlAgents/hooks/useCommand";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { type DeepLinkObjectType } from "owlagents/deepLinks";
import { INTEGRATION_STATE_LABELS } from "owlagents/domain/authority";
import { SCENARIO_COMMANDS, SCENARIO_LABELS } from "owlagents/domain/snapshot";
import { type AttentionItem } from "owlagents/domain/types";
import {
  type ActiveWorkRow,
  type ProjectPulse,
} from "owlagents/selectors/missionControl";

const Tiles = styled.div`
  display: grid;
  gap: 9px;
  grid-template-columns: repeat(6, 1fr);
  padding: 13px ${OWL_TOKENS.space.lg} 4px;
`;

const Tile = styled.div<{ $tone: string }>`
  background-color: ${OWL_TOKENS.color.surface2};
  border: 1px solid ${OWL_TOKENS.color.border};
  border-radius: ${OWL_TOKENS.radius.card};
  padding: ${OWL_TOKENS.space.md};

  > strong {
    color: ${({ $tone }) => $tone};
    display: block;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.1;
  }

  > span {
    color: ${OWL_TOKENS.color.textDim};
    font-size: ${OWL_TOKENS.font.sectionSize};
    font-weight: 600;
    letter-spacing: ${OWL_TOKENS.font.sectionTracking};
    text-transform: uppercase;
  }
`;

const TONE: Record<string, string> = {
  accent: "#7fd6f2",
  error: "#e08a8a",
  neutral: "#e8eaf0",
  ok: "#8fd0a3",
  warning: "#e8b07c",
};

const AttentionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;

  > li {
    align-items: baseline;
    border-bottom: 1px solid ${OWL_TOKENS.color.divider};
    display: flex;
    gap: ${OWL_TOKENS.space.md};
    padding: ${OWL_TOKENS.space.sm} 0;
  }
`;

const Detail = styled.span`
  color: ${OWL_TOKENS.color.textMuted};
  flex: 1 1 auto;
`;

const Kind = styled.span`
  color: ${OWL_TOKENS.color.textDim};
  font-family: ${OWL_TOKENS.font.mono};
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const BriefingRow = styled.div`
  color: ${OWL_TOKENS.color.textMuted};
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
`;

const ScenarioBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${OWL_TOKENS.space.sm};
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

const TABS = [
  { id: "exec", label: "Executive" },
  { id: "ops", label: "Operations" },
  { id: "projects", label: "Projects" },
  { id: "agents", label: "Agents" },
  { id: "infra", label: "Infrastructure" },
];

const RECENT_EVENTS = { limit: 8 };

/** Attention rows link to the object that caused them, where one is linkable. */
const ATTENTION_TYPE: Partial<
  Record<AttentionItem["objectType"], DeepLinkObjectType>
> = {
  memory: "memory",
  project: "project",
  review: "review",
  workOrder: "workOrder",
};

const WORK_COLUMNS: readonly DataColumn<ActiveWorkRow>[] = [
  {
    header: "Work order",
    id: "id",
    render: (row) => <ObjectLink id={row.id} type="workOrder" />,
    width: "14%",
  },
  { header: "Title", id: "title", render: (row) => row.title, width: "26%" },
  {
    header: "Stage",
    id: "stage",
    render: (row) => row.stageLabel,
    width: "22%",
  },
  {
    header: "Agent",
    id: "agent",
    render: (row) => <Mono>{row.agent}</Mono>,
    width: "14%",
  },
  {
    align: "right",
    header: "Cost",
    id: "cost",
    render: (row) => <Mono>{row.cost}</Mono>,
    width: "8%",
  },
  { header: "Status", id: "status", render: (row) => row.status },
];

const PROJECT_COLUMNS: readonly DataColumn<ProjectPulse>[] = [
  {
    header: "Project",
    id: "id",
    render: (row) => <ObjectLink id={row.id} label={row.name} type="project" />,
    width: "22%",
  },
  { header: "Phase", id: "phase", render: (row) => row.phase, width: "12%" },
  {
    header: "Stage",
    id: "stage",
    render: (row) => row.stageLabel,
    width: "10%",
  },
  {
    align: "right",
    header: "Active",
    id: "active",
    render: (row) => row.activeCount,
    width: "8%",
  },
  {
    align: "right",
    header: "Blocked",
    id: "blocked",
    render: (row) => row.blockerCount,
    width: "9%",
  },
  { header: "Next action", id: "next", render: (row) => row.nextAction },
];

/**
 * The default landing surface.
 *
 * Every number and every sentence here is derived from domain state on read.
 * Nothing is stored as a dashboard string, which is why an attention row simply
 * stops being generated the moment its condition is resolved.
 */
const MissionControl: FC<ComponentProcessProps> = ({ id }) => {
  const { deepLinkError, setTab, tab } = useOwlWindow(id, "exec");
  const stats = useMissionControlStats();
  const attention = useAttentionItems();
  const briefing = useBriefing();
  const projects = useProjectPulse();
  const work = useOpenWork();
  const agents = useAgents();
  const services = useServices();
  const integrations = useIntegrations();
  const authority = useAuthority();
  const events = useLedger(RECENT_EVENTS);
  const owlServices = useOwlServices();

  /**
   * Routed through `useCommand` like every other write surface. It used to call
   * the service directly and drop the `ServiceResult`, so a refusal produced no
   * visible effect at all — the one control in the command center that could
   * fail silently.
   */
  const scenario = useCommand(
    useCallback(
      (command: (typeof SCENARIO_COMMANDS)[number]) =>
        owlServices.scenarioService.run(command),
      [owlServices]
    )
  );
  const { run: runScenario } = scenario;

  return (
    <AppShell id={id}>
      <Tiles>
        {stats.map((stat) => (
          <Tile key={stat.id} $tone={TONE[stat.tone] ?? OWL_TOKENS.color.text}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </Tile>
        ))}
      </Tiles>
      <TabBar aria-label="Mission Control views">
        {TABS.map((entry) => (
          <Tab
            key={entry.id}
            $active={tab === entry.id}
            onClick={() => setTab(entry.id)}
            type="button"
          >
            {entry.label}
          </Tab>
        ))}
      </TabBar>
      <Scroll aria-label="Mission Control" tabIndex={0}>
        {deepLinkError ? (
          <Note>
            Link not recognised: <Mono>{deepLinkError}</Mono>. The desktop and
            every open window were left as they were.
          </Note>
        ) : undefined}

        {tab === "exec" ? (
          <>
            {/*
              "Since your last session" promised something the domain cannot
              deliver: nothing persists a previous session, so the boundary is
              this session's start. Naming it accurately costs nothing and stops
              the panel implying it caught the operator up on time away.
            */}
            <SectionLabel>Since you opened this session</SectionLabel>
            <Note>
              {authority.detail} Counted from the ledger, not stored as a
              sentence.
            </Note>
            <CardGrid $columns="1fr 1fr">
              <Card>
                {/*
                  Six zero rows read as a report that nothing happened. On a
                  freshly opened session nothing has happened *yet*, which is a
                  different statement and the honest one.
                */}
                {briefing.every((line) => line.count === 0) ? (
                  <Note>
                    Nothing has been recorded yet in this session. Activity
                    appears here as the ledger receives it.
                  </Note>
                ) : (
                  briefing.map((line) => (
                    <BriefingRow key={line.id}>
                      <span>{line.label}</span>
                      <Mono>{line.count}</Mono>
                    </BriefingRow>
                  ))
                )}
              </Card>
              {/*
                Only where the data is fixtures. These controls advance a demo
                script; against a real authority every one of them is refused,
                and offering an enabled button that cannot work — beside a LOCAL
                badge and real work orders — invites the operator to believe
                they are driving something.
              */}
              {authority.isFixture && (
                <Card>
                  <SectionLabel>Demo scenario</SectionLabel>
                  <ScenarioBar>
                    {SCENARIO_COMMANDS.map((command) => (
                      <ActionButton
                        key={command}
                        onClick={() => runScenario(command)}
                        type="button"
                      >
                        {SCENARIO_LABELS[command]}
                      </ActionButton>
                    ))}
                  </ScenarioBar>
                  <CommandFeedback
                    error={scenario.error}
                    phase={scenario.phase}
                  />
                </Card>
              )}
            </CardGrid>
            <SectionLabel>
              Needs your attention ({attention.length})
            </SectionLabel>
            <CardGrid $columns="1.15fr 1fr">
              <Card>
                <AttentionList>
                  {attention.map((item) => {
                    const linkType = ATTENTION_TYPE[item.objectType];

                    return (
                      <li key={item.id}>
                        {linkType ? (
                          <ObjectLink id={item.objectId} type={linkType} />
                        ) : (
                          <Mono>{item.objectId}</Mono>
                        )}
                        <Detail>{item.detail}</Detail>
                        <Kind>{item.kind}</Kind>
                      </li>
                    );
                  })}
                </AttentionList>
              </Card>
              <Card>
                <SectionLabel>Recent events</SectionLabel>
                <StateTimeline events={events} />
              </Card>
            </CardGrid>
          </>
        ) : undefined}

        {tab === "ops" ? (
          <>
            <SectionLabel>Open work</SectionLabel>
            <DataTable
              caption="Open work"
              columns={WORK_COLUMNS}
              emptyMessage="Nothing is in flight."
              getRowId={(row) => row.id}
              rows={work}
            />
          </>
        ) : undefined}

        {tab === "projects" ? (
          <>
            <SectionLabel>Project pulse</SectionLabel>
            <DataTable
              caption="Project pulse"
              columns={PROJECT_COLUMNS}
              getRowId={(row) => row.id}
              rows={projects}
            />
          </>
        ) : undefined}

        {tab === "agents" ? (
          <>
            <SectionLabel>Agents</SectionLabel>
            <AttentionList>
              {agents.map((agent) => (
                <li key={agent.id}>
                  <Mono>{agent.name}</Mono>
                  <Detail>
                    {agent.lane} — {agent.role}
                  </Detail>
                  <StatusChip label={agent.status} status={agent.status} />
                </li>
              ))}
            </AttentionList>
          </>
        ) : undefined}

        {tab === "infra" ? (
          <>
            <SectionLabel>Services</SectionLabel>
            <AttentionList>
              {services.map((service) => (
                <li key={service.id}>
                  <Mono>{service.name}</Mono>
                  <Detail>{service.detail}</Detail>
                  <StatusChip
                    label={INTEGRATION_STATE_LABELS[service.state]}
                    status={service.state}
                  />
                </li>
              ))}
            </AttentionList>
            <SectionLabel>Integrations</SectionLabel>
            <AttentionList>
              {integrations.map((integration) => (
                <li key={integration.id}>
                  <Mono>{integration.name}</Mono>
                  <Detail>{integration.error ?? integration.type}</Detail>
                  <StatusChip
                    label={INTEGRATION_STATE_LABELS[integration.state]}
                    status={integration.state}
                  />
                </li>
              ))}
            </AttentionList>
          </>
        ) : undefined}
      </Scroll>
    </AppShell>
  );
};

export default memo(MissionControl);
