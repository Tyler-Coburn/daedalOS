import { memo } from "react";
import styled from "styled-components";
import {
  AuthorityBadge,
  LaneBadge,
} from "components/apps/OwlAgents/components/Badges";
import {
  OwlHeader,
  OwlRoot,
} from "components/apps/OwlAgents/components/primitives";
import {
  useAuthority,
  useMissingCapabilities,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { useProcesses } from "contexts/process";
import { PROCESS_DELIMITER } from "utils/constants";

const Title = styled.h2`
  color: ${OWL_TOKENS.color.text};
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
`;

/**
 * A refusal, not a blank window. The operator is told which capability is
 * missing and that nothing was read — silence would be indistinguishable from
 * a broken application.
 */
const Refused = styled.div`
  color: ${OWL_TOKENS.color.textMuted};
  padding: ${OWL_TOKENS.space.xl};

  > h3 {
    color: ${OWL_TOKENS.color.text};
    font-size: 13px;
    margin: 0 0 ${OWL_TOKENS.space.sm};
  }

  > p {
    line-height: 1.6;
    margin: 0;
  }
`;

type AppShellProps = {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  id: string;
};

/**
 * The frame every command-center application renders inside.
 *
 * It owns the lane badge and the environment badge so all sixteen headers agree
 * by construction rather than by convention. Window chrome, the title bar, the
 * taskbar button and the icon are *not* re-implemented here — the repository
 * already owns those.
 */
const NO_CAPABILITIES: readonly string[] = [];

const AppShell: FC<AppShellProps> = ({ children, headerRight, id }) => {
  const { processes } = useProcesses();
  const authority = useAuthority();
  const process = processes[id];
  const [processId = ""] = id.split(PROCESS_DELIMITER);
  const missing = useMissingCapabilities(
    process?.requiredCapabilities ?? NO_CAPABILITIES
  );

  return (
    <OwlRoot>
      <OwlHeader>
        <Title>{process?.title ?? processId}</Title>
        {process?.laneBadge ? (
          <LaneBadge badge={process.laneBadge} />
        ) : undefined}
        <Spacer />
        {headerRight}
        <AuthorityBadge authority={authority} />
      </OwlHeader>
      {missing.length > 0 ? (
        <Refused>
          <h3>You do not have access to this application</h3>
          <p>
            It requires {missing.join(", ")}, which this operator does not hold.
            Nothing was loaded and no data was read.
          </p>
        </Refused>
      ) : (
        children
      )}
    </OwlRoot>
  );
};

export default memo(AppShell);
