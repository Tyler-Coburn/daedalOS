import { dirname } from "path";
import { memo, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import Navigation from "components/apps/FileExplorer/Navigation";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import DataTable, {
  type DataColumn,
} from "components/apps/OwlAgents/components/DataTable";
import ObjectLink from "components/apps/OwlAgents/components/ObjectLink";
import {
  Card,
  FieldGrid,
  FieldLabel,
  FieldValue,
  Mono,
  Note,
  OwlBody,
  Pane,
  Scroll,
  SectionLabel,
} from "components/apps/OwlAgents/components/primitives";
import {
  useAuthority,
  useProjects,
  useSource,
  useSources,
} from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import IntakeZone from "components/apps/OwlAgents/SourcesFiles/IntakeZone";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import FileManager from "components/system/Files/FileManager";
import { useProcesses } from "contexts/process";
import {
  AUTHORITY_LABELS,
  INTAKE_STAGE_LABELS,
} from "owlagents/domain/authority";
import { type Source } from "owlagents/domain/types";

export const SOURCES_ROOT = "/OwlAgents/Sources";

const Explorer = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
`;

const COLUMNS: readonly DataColumn<Source>[] = [
  {
    header: "Source",
    id: "id",
    render: (row) => <Mono>{row.id}</Mono>,
    width: "13%",
  },
  { header: "Name", id: "name", render: (row) => row.name, width: "26%" },
  {
    header: "Authority",
    id: "authority",
    render: (row) => (
      <StatusChip
        label={AUTHORITY_LABELS[row.authority]}
        status={row.authority}
      />
    ),
    width: "15%",
  },
  {
    header: "Intake stage",
    id: "intake",
    render: (row) => INTAKE_STAGE_LABELS[row.intakeStage],
    width: "14%",
  },
  {
    header: "sha256",
    id: "hash",
    render: (row) => <Mono>{row.hash.slice(0, 12)}…</Mono>,
    width: "16%",
  },
  {
    align: "right",
    header: "Size",
    id: "size",
    render: (row) => <Mono>{Math.round(row.size / 1024)} KB</Mono>,
  },
];

/**
 * The repository's File Explorer, composed rather than forked.
 *
 * `Navigation` and `FileManager` are used unmodified — history, address bar,
 * icon and details views, sortable and resizable columns, drag-and-drop intake,
 * multi-select and the keyboard shortcuts all come from the OS. Source
 * authority, the intake stage and the hash live in an owned panel beside it,
 * because `FileManager` derives its columns from file stats and has no
 * knowledge of domain objects.
 */
const SourcesFiles: FC<ComponentProcessProps> = ({ id }) => {
  const { selectedId, setSelectedId } = useOwlWindow(id, {
    mirrorSelectionToUrl: false,
  });
  const { processes, url: setProcessUrl } = useProcesses();
  const sources = useSources();
  const projects = useProjects();
  const selected = useSource(selectedId || (sources[0]?.id ?? ""));
  const authority = useAuthority();
  const addressBarRef = useRef<HTMLInputElement | null>(null);
  const searchBarRef = useRef<HTMLInputElement | null>(null);
  const url = processes[id]?.url ?? "";

  // The window opens on the sources mount; a deep link may target a subfolder.
  useEffect(() => {
    if (!url) setProcessUrl(id, SOURCES_ROOT);
  }, [id, setProcessUrl, url]);

  const folder = useMemo(
    () => (selected?.path ? dirname(selected.path) : SOURCES_ROOT),
    [selected]
  );

  return (
    <AppShell id={id}>
      <OwlBody>
        <Pane>
          <Explorer>
            {url ? (
              <>
                <Navigation
                  addressBarRef={addressBarRef}
                  hideSearch={false}
                  id={id}
                  searchBarRef={searchBarRef}
                />
                <FileManager id={id} url={url} showStatusBar />
              </>
            ) : undefined}
          </Explorer>
        </Pane>

        <Pane $width="46%">
          <SectionLabel>Preserved sources ({sources.length})</SectionLabel>
          <Scroll aria-label="Preserved sources" tabIndex={0}>
            <Note>
              {authority.detail} A dropped file is preserved and hashed before
              it is authoritative — the intake stage says where each one has got
              to.
            </Note>
            {/*
              The fallback is a project that exists in this snapshot, never a
              literal. It used to default to the demo fixture id `PRJ-001`,
              which under a real authority names no project at all — the
              dropdown would show one project while the intake targeted another.
            */}
            <IntakeZone
              projectId={selected?.projectId ?? projects[0]?.id ?? ""}
            />
            <DataTable
              caption="Preserved sources"
              columns={COLUMNS}
              getRowId={(row) => row.id}
              onSelect={setSelectedId}
              rows={sources}
              selectedId={selected?.id}
            />
            {selected ? (
              <>
                <SectionLabel>Provenance</SectionLabel>
                <FieldGrid>
                  <div>
                    <FieldLabel>Preserved at</FieldLabel>
                    <FieldValue>
                      <Mono>{selected.preservedLocation}</Mono>
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Mount</FieldLabel>
                    <FieldValue>{selected.mount}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Original location</FieldLabel>
                    <FieldValue>
                      <Mono>{selected.originalLocation}</Mono>
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Ingested</FieldLabel>
                    <FieldValue>
                      {selected.ingestedAt.slice(0, 10)} by{" "}
                      {selected.ingestedBy}
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>sha256</FieldLabel>
                    <FieldValue>
                      <Mono>{selected.hash}</Mono>
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Folder</FieldLabel>
                    <FieldValue>
                      <Mono>{folder}</Mono>
                    </FieldValue>
                  </div>
                </FieldGrid>
                <SectionLabel>Referenced by</SectionLabel>
                <Card>
                  {selected.referencedByWorkOrderIds.length > 0
                    ? selected.referencedByWorkOrderIds.map((workOrderId) => (
                        <div key={workOrderId}>
                          <ObjectLink id={workOrderId} type="workOrder" />
                        </div>
                      ))
                    : "Not referenced by any work order yet."}
                </Card>
              </>
            ) : undefined}
          </Scroll>
        </Pane>
      </OwlBody>
    </AppShell>
  );
};

export default memo(SourcesFiles);
