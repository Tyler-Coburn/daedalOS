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
} from "components/apps/OwlAgents/components/primitives";
import { useAgents } from "components/apps/OwlAgents/hooks/useOwlData";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { type Agent } from "owlagents/domain/types";

const COLUMNS: readonly DataColumn<Agent>[] = [
  { header: "Agent", id: "name", render: (row) => row.name, width: "12%" },
  {
    header: "Lane",
    id: "lane",
    render: (row) => <Mono>{row.lane}</Mono>,
    width: "22%",
  },
  { header: "Role", id: "role", render: (row) => row.role, width: "17%" },
  {
    header: "Model",
    id: "model",
    render: (row) => <Mono>{row.model}</Mono>,
    width: "16%",
  },
  {
    header: "Status",
    id: "status",
    render: (row) => <StatusChip label={row.status} status={row.status} />,
    width: "12%",
  },
  {
    header: "Allowed",
    id: "tools",
    render: (row) => <Mono>{row.tools.join(", ")}</Mono>,
  },
  {
    header: "Denied",
    id: "denied",
    render: (row) => <Mono>{row.deniedTools.join(", ")}</Mono>,
    width: "14%",
  },
];

/**
 * Three bounded workers, each present in both systems.
 *
 * The denied column is the point: an agent's capabilities are declared, and
 * what it may not do is as visible as what it may.
 */
const AgentRoster: FC<ComponentProcessProps> = ({ id }) => {
  const agents = useAgents();

  return (
    <AppShell id={id}>
      <Scroll aria-label="Agent roster" tabIndex={0}>
        <Note>
          Agents propose; the operator decides. An agent is an assignee with a
          declared tool list — never the unit of work.
        </Note>
        <DataTable
          caption="Agent roster"
          columns={COLUMNS}
          getRowId={(row) => row.id}
          rows={agents}
        />
      </Scroll>
    </AppShell>
  );
};

export default memo(AgentRoster);
