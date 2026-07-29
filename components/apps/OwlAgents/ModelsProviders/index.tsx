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
  useModelProviders,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { INTEGRATION_STATE_LABELS } from "owlagents/domain/authority";
import { type ModelProvider } from "owlagents/domain/types";

const COLUMNS: readonly DataColumn<ModelProvider>[] = [
  {
    header: "Model",
    id: "name",
    render: (row) => <Mono>{row.name}</Mono>,
    width: "24%",
  },
  { header: "Role", id: "role", render: (row) => row.role, width: "14%" },
  {
    header: "Provider",
    id: "provider",
    render: (row) => row.provider,
    width: "18%",
  },
  {
    align: "right",
    header: "Context",
    id: "context",
    render: (row) => <Mono>{`${Math.round(row.contextWindow / 1024)}k`}</Mono>,
    width: "10%",
  },
  {
    align: "right",
    header: "Latency",
    id: "latency",
    render: (row) => <Mono>{row.latencyMs ? `${row.latencyMs}ms` : "—"}</Mono>,
    width: "12%",
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
  },
];

/** Model assignment and runtime state. No model is downloaded from here. */
const ModelsProviders: FC<ComponentProcessProps> = ({ id }) => {
  const models = useModelProviders();
  const authority = useAuthority();

  return (
    <AppShell id={id}>
      <Scroll aria-label="Models and providers" tabIndex={0}>
        <Note>
          {authority.detail} Latency figures are recorded characteristics, not a
          live measurement.
        </Note>
        <DataTable
          caption="Models and providers"
          columns={COLUMNS}
          getRowId={(row) => row.id}
          rows={models}
        />
      </Scroll>
    </AppShell>
  );
};

export default memo(ModelsProviders);
