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
import {
  useAuthority,
  useIntegrations,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { INTEGRATION_STATE_LABELS } from "owlagents/domain/authority";
import { type Integration } from "owlagents/domain/types";

const scopes = (list: readonly string[]): string =>
  list.length > 0 ? list.join(", ") : "none";

const COLUMNS: readonly DataColumn<Integration>[] = [
  {
    header: "Integration",
    id: "name",
    render: (row) => row.name,
    width: "16%",
  },
  { header: "Type", id: "type", render: (row) => row.type, width: "12%" },
  {
    header: "Read authority",
    id: "read",
    render: (row) => scopes(row.readScopes),
    width: "15%",
  },
  {
    header: "Write authority",
    id: "write",
    render: (row) => scopes(row.writeScopes),
    width: "17%",
  },
  {
    align: "right",
    header: "Latency",
    id: "latency",
    render: (row) => <Mono>{row.latencyMs ? `${row.latencyMs}ms` : "—"}</Mono>,
    width: "9%",
  },
  {
    header: "State",
    id: "state",
    render: (row) => (
      <StatusChip
        label={INTEGRATION_STATE_LABELS[row.state]}
        status={row.state}
      />
    ),
    width: "13%",
  },
  {
    header: "Reason",
    id: "reason",
    render: (row) => row.error ?? row.credentialStatus,
  },
];

/**
 * The registry of every system the command center intends to speak to.
 *
 * A row that is not connected says why, and never claims a successful sync.
 * Credentials are never rendered — only their configuration state.
 */
const Integrations: FC<ComponentProcessProps> = ({ id }) => {
  const integrations = useIntegrations();
  const authority = useAuthority();

  return (
    <AppShell id={id}>
      <Scroll aria-label="Integration registry" tabIndex={0}>
        <Note>
          {authority.detail} Every row below is a local fixture. Connecting an
          integration is an operator action that grants exactly the scopes on
          its row and produces a ledger event.
        </Note>
        <DataTable
          caption="Integration registry"
          columns={COLUMNS}
          getRowId={(row) => row.id}
          rows={integrations}
        />
      </Scroll>
    </AppShell>
  );
};

export default memo(Integrations);
