import { memo } from "react";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import { StageList } from "components/apps/OwlAgents/components/Comparison";
import ObjectLink from "components/apps/OwlAgents/components/ObjectLink";
import { EmptyState } from "components/apps/OwlAgents/components/States";
import {
  Card,
  CardGrid,
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
import {
  useProject,
  useProjects,
  useWorkOrderList,
} from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";

const HEALTH_STATUS: Record<string, string> = {
  at_risk: "degraded",
  blocked: "blocked",
  healthy: "connected",
};

/** The portfolio: purpose, locked decisions, blockers and the next action. */
const Projects: FC<ComponentProcessProps> = ({ id }) => {
  const { selectedId, setSelectedId } = useOwlWindow(id);
  const projects = useProjects();
  const selected = useProject(selectedId || (projects[0]?.id ?? ""));
  const allOrders = useWorkOrderList("all");
  const orders = allOrders.filter((order) => order.projectId === selected?.id);

  return (
    <AppShell id={id}>
      <OwlBody>
        <Pane $width={OWL_TOKENS.size.policyList}>
          <SectionLabel>Projects ({projects.length})</SectionLabel>
          <Scroll aria-label="Projects" tabIndex={0}>
            {projects.map((project) => (
              <ListButton
                key={project.id}
                $selected={project.id === selected?.id}
                onClick={() => setSelectedId(project.id)}
                type="button"
              >
                <Mono>{project.id}</Mono>
                <div>{project.name}</div>
                <StatusChip
                  label={project.health.replace("_", " ")}
                  status={HEALTH_STATUS[project.health] ?? "draft"}
                />
              </ListButton>
            ))}
          </Scroll>
        </Pane>

        <Pane>
          <Scroll aria-label="Project detail" tabIndex={0}>
            {selected ? (
              <>
                <SectionLabel>
                  {selected.id} · {selected.name}
                </SectionLabel>
                <Note>{selected.purpose}</Note>

                <FieldGrid>
                  <div>
                    <FieldLabel>Phase</FieldLabel>
                    <FieldValue>{selected.phase}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Cost to date</FieldLabel>
                    <FieldValue>
                      ${selected.costToDate.amount.toFixed(2)}
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Source of truth</FieldLabel>
                    <FieldValue>
                      <Mono>{selected.sourceOfTruth}</Mono>
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Active work orders</FieldLabel>
                    <FieldValue>{orders.length}</FieldValue>
                  </div>
                </FieldGrid>

                <SectionLabel>Stages</SectionLabel>
                <StageList
                  index={selected.stage.index}
                  steps={selected.stage.steps}
                />

                <CardGrid>
                  <Card>
                    <SectionLabel>Locked decisions</SectionLabel>
                    {selected.lockedDecisions.map((decision) => (
                      <div key={decision}>{decision}</div>
                    ))}
                  </Card>
                  <Card>
                    <SectionLabel>Next actions</SectionLabel>
                    {selected.nextActions.map((action) => (
                      <div key={action}>{action}</div>
                    ))}
                    {selected.blockers.map((blocker) => (
                      <div key={blocker}>Blocked: {blocker}</div>
                    ))}
                  </Card>
                </CardGrid>

                <SectionLabel>Work orders</SectionLabel>
                <Card>
                  {orders.length > 0
                    ? orders.map((order) => (
                        <div key={order.id}>
                          <ObjectLink id={order.id} type="workOrder" />{" "}
                          {order.title}
                        </div>
                      ))
                    : "No work orders on this project."}
                </Card>
              </>
            ) : (
              <EmptyState
                description="Choose a project from the list."
                title="No project selected"
              />
            )}
          </Scroll>
        </Pane>
      </OwlBody>
    </AppShell>
  );
};

export default memo(Projects);
