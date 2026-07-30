import { memo } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import { ComparisonViewer } from "components/apps/OwlAgents/components/Comparison";
import { EmptyState } from "components/apps/OwlAgents/components/States";
import {
  Mono,
  Note,
  Pre,
  Scroll,
  SectionLabel,
  StatusBar,
} from "components/apps/OwlAgents/components/primitives";
import { useArtifact } from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { AUTHORITY_LABELS } from "owlagents/domain/authority";

const Chrome = styled.div`
  background-color: rgb(37 37 37);
  border-bottom: 1px solid ${OWL_TOKENS.color.divider};
  color: ${OWL_TOKENS.color.textMuted};
  flex: 0 0 26px;
  font-size: 11px;
  line-height: 26px;
  padding: 0 ${OWL_TOKENS.space.md};
`;

/**
 * Read-only by design.
 *
 * Non-singleton, so a deep link to `/artifacts/ART-0031` opens its own window
 * and the artifact you were already reading stays where it was.
 */
const ArtifactViewer: FC<ComponentProcessProps> = ({ id }) => {
  const { selectedId } = useOwlWindow(id);
  const artifact = useArtifact(selectedId);

  if (!artifact) {
    return (
      <AppShell id={id}>
        <EmptyState
          description="Open an artifact from Work Orders or the Review Queue, or use a /artifacts/:id link."
          title="No artifact selected"
        />
      </AppShell>
    );
  }

  return (
    <AppShell id={id}>
      <Chrome>{artifact.name}</Chrome>
      <Scroll aria-label={`Artifact ${artifact.id}`} tabIndex={0}>
        <Note>
          <Mono>{artifact.id}</Mono> · version {artifact.version} ·{" "}
          <StatusChip
            label={AUTHORITY_LABELS[artifact.authority]}
            status={artifact.authority}
          />
        </Note>
        <Note>
          sha256 <Mono>{artifact.hash}</Mono>
        </Note>
        {artifact.previousContent ? (
          <ComparisonViewer
            after={artifact.content}
            afterLabel={`After · v${artifact.version}`}
            before={artifact.previousContent}
            beforeLabel={`Before · v${artifact.version - 1}`}
          />
        ) : (
          <>
            <SectionLabel>Content</SectionLabel>
            <Pre>{artifact.content}</Pre>
          </>
        )}
      </Scroll>
      <StatusBar>
        <span>{artifact.language}</span>
        <span>{artifact.content.split("\n").length} lines</span>
        <span>Read-only</span>
      </StatusBar>
    </AppShell>
  );
};

export default memo(ArtifactViewer);
