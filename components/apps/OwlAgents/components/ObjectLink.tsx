import { memo, useCallback } from "react";
import styled from "styled-components";
import useDeepLinkNavigation from "components/apps/OwlAgents/hooks/useDeepLinkNavigation";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type DeepLinkObjectType } from "owlagents/deepLinks";

const LinkButton = styled.button`
  background: none;
  border: none;
  color: #7fd6f2;
  font-family: ${OWL_TOKENS.font.mono};
  font-size: ${OWL_TOKENS.font.monoSize};
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:focus-visible {
    outline: 1px solid ${OWL_TOKENS.color.focusRing};
    outline-offset: 1px;
  }

  &:hover {
    color: ${OWL_TOKENS.color.text};
  }
`;

type ObjectLinkProps = {
  id: string;
  label?: string;
  type: DeepLinkObjectType;
};

/**
 * A button, never an anchor.
 *
 * An `<a href>` click is a full navigation, which would remount the page and
 * close every open window. This pushes history and re-targets the process
 * instead, so the desktop is untouched.
 */
const ObjectLinkBase: FC<ObjectLinkProps> = ({ id, label, type }) => {
  const { navigateTo } = useDeepLinkNavigation();
  const onClick = useCallback(
    () => navigateTo(type, id),
    [id, navigateTo, type]
  );

  return (
    <LinkButton onClick={onClick} type="button">
      {label ?? id}
    </LinkButton>
  );
};

export default memo(ObjectLinkBase);
