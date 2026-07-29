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
  useAuthority,
  useIncidents,
  useServices,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import {
  INTEGRATION_STATE_LABELS,
  isHealthyIntegrationState,
} from "owlagents/domain/authority";
import { type Incident, type ServiceHealth } from "owlagents/domain/types";

const SERVICE_COLUMNS: readonly DataColumn<ServiceHealth>[] = [
  { header: "Service", id: "name", render: (row) => row.name, width: "26%" },
  {
    header: "State",
    id: "state",
    render: (row) => (
      <StatusChip
        label={INTEGRATION_STATE_LABELS[row.state]}
        status={row.state}
      />
    ),
    width: "16%",
  },
  { header: "Detail", id: "detail", render: (row) => row.detail },
  {
    align: "right",
    header: "Latency",
    id: "latency",
    render: (row) => <Mono>{row.latencyMs ? `${row.latencyMs}ms` : "—"}</Mono>,
    width: "12%",
  },
  {
    align: "right",
    header: "Queue",
    id: "queue",
    render: (row) => <Mono>{row.queueDepth}</Mono>,
    width: "10%",
  },
];

const INCIDENT_COLUMNS: readonly DataColumn<Incident>[] = [
  {
    header: "Incident",
    id: "id",
    render: (row) => <Mono>{row.id}</Mono>,
    width: "14%",
  },
  { header: "Title", id: "title", render: (row) => row.title, width: "28%" },
  { header: "Detail", id: "detail", render: (row) => row.detail },
  {
    header: "Severity",
    id: "severity",
    render: (row) => row.severity,
    width: "12%",
  },
];

/**
 * Service health, read from the same environment authority Integrations reads.
 * Neither surface can report a system as healthy while the other calls it
 * disconnected, because there is only one value to read.
 */
const SystemHealth: FC<ComponentProcessProps> = ({ id }) => {
  const services = useServices();
  const incidents = useIncidents();
  const authority = useAuthority();
  const degraded = services.filter(
    (service) => !isHealthyIntegrationState(service.state)
  ).length;

  return (
    <AppShell id={id}>
      <Scroll aria-label="System health" tabIndex={0}>
        <Note>
          {authority.detail} {degraded} of {services.length} services are not
          fully connected.
        </Note>
        <SectionLabel>Services</SectionLabel>
        <DataTable
          caption="Service health"
          columns={SERVICE_COLUMNS}
          getRowId={(row) => row.id}
          rows={services}
        />
        <SectionLabel>Open incidents</SectionLabel>
        <DataTable
          caption="Open incidents"
          columns={INCIDENT_COLUMNS}
          emptyMessage="No open incidents."
          getRowId={(row) => row.id}
          rows={incidents}
        />
      </Scroll>
    </AppShell>
  );
};

export default memo(SystemHealth);
