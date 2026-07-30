import { memo } from "react";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import DataTable, {
  type DataColumn,
} from "components/apps/OwlAgents/components/DataTable";
import {
  Mono,
  Note,
  Scroll,
  SectionLabel,
} from "components/apps/OwlAgents/components/primitives";
import {
  useActiveWork,
  useAgents,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { type Agent } from "owlagents/domain/types";
import { type ActiveWorkRow } from "owlagents/selectors/missionControl";

const WORK_COLUMNS: readonly DataColumn<ActiveWorkRow>[] = [
  {
    header: "Work order",
    id: "id",
    render: (row) => <Mono>{row.id}</Mono>,
    width: "14%",
  },
  { header: "Title", id: "title", render: (row) => row.title, width: "26%" },
  {
    header: "Agent",
    id: "agent",
    render: (row) => <Mono>{row.agent}</Mono>,
    width: "16%",
  },
  {
    header: "Stage",
    id: "stage",
    render: (row) => row.stageLabel,
    width: "24%",
  },
  {
    align: "right",
    header: "Cost",
    id: "cost",
    render: (row) => <Mono>{row.cost}</Mono>,
    width: "9%",
  },
  { header: "Status", id: "status", render: (row) => row.status },
];

const AGENT_COLUMNS: readonly DataColumn<Agent>[] = [
  { header: "Agent", id: "name", render: (row) => row.name, width: "16%" },
  {
    header: "Lane",
    id: "lane",
    render: (row) => <Mono>{row.lane}</Mono>,
    width: "28%",
  },
  {
    header: "Current task",
    id: "task",
    render: (row) => <Mono>{row.currentTaskId ?? "—"}</Mono>,
    width: "20%",
  },
  {
    header: "Status",
    id: "status",
    render: (row) => <StatusChip label={row.status} status={row.status} />,
  },
];

/**
 * Agents and work orders as processes.
 *
 * The Stage column shows the named stage or an em dash — never a percentage,
 * because open-ended work has no honest denominator.
 */
const TaskManager: FC<ComponentProcessProps> = ({ id }) => {
  const work = useActiveWork();
  const agents = useAgents();

  return (
    <AppShell id={id}>
      <Scroll aria-label="Task manager" tabIndex={0}>
        <Note>
          {work.length} work orders are not yet finished. Ending a task is a
          state transition and is performed from Work Orders, where the policy
          and scope are visible.
        </Note>
        <SectionLabel>Work orders</SectionLabel>
        <DataTable
          caption="Work orders in flight"
          columns={WORK_COLUMNS}
          emptyMessage="Nothing is running."
          getRowId={(row) => row.id}
          rows={work}
        />
        <SectionLabel>Agents</SectionLabel>
        <DataTable
          caption="Agent processes"
          columns={AGENT_COLUMNS}
          getRowId={(row) => row.id}
          rows={agents}
        />
      </Scroll>
    </AppShell>
  );
};

export default memo(TaskManager);
