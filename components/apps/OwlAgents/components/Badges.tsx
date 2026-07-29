import { memo } from "react";
import styled from "styled-components";
import {
  AUTHORITY_TONE,
  OWL_TOKENS,
  toneOf,
} from "components/apps/OwlAgents/theme";
import { type EnvironmentAuthority } from "owlagents/domain/authority";

const Chip = styled.span<{ $fill: string; $text: string }>`
  align-items: center;
  background-color: ${({ $fill }) => `${$fill}1f`};
  border: 1px solid ${({ $fill }) => `${$fill}73`};
  border-radius: ${OWL_TOKENS.radius.chip};
  color: ${({ $text }) => $text};
  display: inline-flex;
  font-size: 10.5px;
  gap: 5px;
  line-height: 1;
  padding: 3px 8px;
  white-space: nowrap;
`;

const Dot = styled.span<{ $fill: string }>`
  background-color: ${({ $fill }) => $fill};
  border-radius: 50%;
  flex: 0 0 auto;
  height: 6px;
  width: 6px;
`;

type StatusChipProps = {
  label: string;
  status: string;
};

/**
 * Colour plus label, never colour alone — the label is what carries the meaning
 * for anyone who cannot distinguish the accents.
 */
const StatusChipBase: FC<StatusChipProps> = ({ label, status }) => {
  const tone = toneOf(status);

  return (
    <Chip $fill={tone.fill} $text={tone.text}>
      <Dot $fill={tone.fill} />
      {label}
    </Chip>
  );
};

export const StatusChip = memo(StatusChipBase);

type AuthorityBadgeProps = {
  authority: EnvironmentAuthority;
  showDetail?: boolean;
};

const Detail = styled.span`
  color: ${OWL_TOKENS.color.textDim};
  font-size: 11px;
`;

/**
 * The environment badge. Every application header renders this from the one
 * authority value, so the tray, System Health, Integrations and each app can
 * never claim different things about what is connected.
 */
const AuthorityBadgeBase: FC<AuthorityBadgeProps> = ({
  authority,
  showDetail,
}) => {
  const tone = AUTHORITY_TONE[authority.mode] ?? AUTHORITY_TONE.OFFLINE;

  return (
    <>
      <Chip
        $fill={tone?.fill ?? OWL_TOKENS.accent.dim}
        $text={tone?.text ?? OWL_TOKENS.color.textMuted}
        title={authority.detail}
      >
        <Dot $fill={tone?.fill ?? OWL_TOKENS.accent.dim} />
        {authority.mode}
      </Chip>
      {showDetail ? <Detail>{authority.detail}</Detail> : undefined}
    </>
  );
};

export const AuthorityBadge = memo(AuthorityBadgeBase);

const LaneChip = styled.span`
  border: 1px solid rgb(107 114 128 / 60%);
  color: ${OWL_TOKENS.color.textDim};
  font-family: ${OWL_TOKENS.font.mono};
  font-size: 9px;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  white-space: nowrap;
`;

const LaneBadgeBase: FC<{ badge: string }> = ({ badge }) => (
  <LaneChip>{badge}</LaneChip>
);

export const LaneBadge = memo(LaneBadgeBase);
