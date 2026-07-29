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
import { useAuthority } from "components/apps/OwlAgents/hooks/useOwlData";
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
const AppShell: FC<AppShellProps> = ({ children, headerRight, id }) => {
  const { processes } = useProcesses();
  const authority = useAuthority();
  const process = processes[id];
  const [processId = ""] = id.split(PROCESS_DELIMITER);

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
      {children}
    </OwlRoot>
  );
};

export default memo(AppShell);
