import { memo, useMemo } from "react";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import {
  Mono,
  Scroll,
  Tab,
  TabBar,
} from "components/apps/OwlAgents/components/primitives";
import DataTable, {
  type DataColumn,
} from "components/apps/OwlAgents/components/DataTable";
import { useLedger } from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { type LedgerEvent, type SystemLayer } from "owlagents/domain/types";
import { LEDGER_SYSTEMS } from "owlagents/selectors/ledger";

const COLUMNS: readonly DataColumn<LedgerEvent>[] = [
  {
    header: "Time",
    id: "time",
    render: (row) => <Mono>{row.timestamp.slice(11, 19)}</Mono>,
    width: "9%",
  },
  {
    header: "System",
    id: "system",
    render: (row) => <Mono>{row.system}</Mono>,
    width: "7%",
  },
  {
    header: "Type",
    id: "type",
    render: (row) => <Mono>{row.eventType}</Mono>,
    width: "14%",
  },
  {
    header: "Object",
    id: "object",
    render: (row) => <Mono>{row.objectId}</Mono>,
    width: "15%",
  },
  { header: "Message", id: "message", render: (row) => row.message },
];

/**
 * The append-only ledger. Mission Control's briefing and every attention item
 * are derived from these rows, so this is where "what actually happened" lives.
 */
const EventTimeline: FC<ComponentProcessProps> = ({ id }) => {
  const { filter, setFilter } = useOwlWindow(id);
  const query = useMemo(
    () =>
      filter && filter !== "all" ? { systems: [filter as SystemLayer] } : {},
    [filter]
  );
  const events = useLedger(query);

  return (
    <AppShell id={id}>
      <TabBar aria-label="Filter by system">
        <Tab
          $active={!filter || filter === "all"}
          onClick={() => setFilter("all")}
          type="button"
        >
          All systems
        </Tab>
        {LEDGER_SYSTEMS.map((system) => (
          <Tab
            key={system}
            $active={filter === system}
            onClick={() => setFilter(system)}
            type="button"
          >
            {system}
          </Tab>
        ))}
      </TabBar>
      <Scroll aria-label="Ledger events" tabIndex={0}>
        <DataTable
          caption="Append-only ledger events"
          columns={COLUMNS}
          emptyMessage="No events for this system."
          getRowId={(row) => row.id}
          rows={events}
        />
      </Scroll>
    </AppShell>
  );
};

export default memo(EventTimeline);
