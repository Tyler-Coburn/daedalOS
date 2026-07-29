import { memo } from "react";
import styled from "styled-components";
import { type CommandPhase } from "components/apps/OwlAgents/hooks/useCommand";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { FAILURE_LABELS, type ServiceFailure } from "owlagents/domain/outcome";

const Block = styled.div<{ $tone: string }>`
  border: 1px solid ${({ $tone }) => `${$tone}59`};
  border-left: 3px solid ${({ $tone }) => $tone};
  color: ${OWL_TOKENS.color.textMuted};
  font-size: 11.5px;
  line-height: 1.5;
  margin: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
  padding: ${OWL_TOKENS.space.md};
`;

const Heading = styled.strong`
  color: ${OWL_TOKENS.color.text};
  display: block;
  margin-bottom: 4px;
`;

const Placeholder = styled.p`
  color: ${OWL_TOKENS.color.textDim};
  line-height: 1.6;
  margin: 0;
  padding: ${OWL_TOKENS.space.xl};
  text-align: center;
`;

const EmptyStateBase: FC<{ description?: string; title: string }> = ({
  description,
  title,
}) => (
  <Placeholder>
    <Heading>{title}</Heading>
    {description}
  </Placeholder>
);

export const EmptyState = memo(EmptyStateBase);

const StaleStateBase: FC<{ reasons: readonly string[] }> = ({ reasons }) => (
  <Block $tone={OWL_TOKENS.accent.error}>
    <Heading>This review is stale</Heading>
    {reasons.map((reason) => (
      <div key={reason}>{reason}</div>
    ))}
    <div>
      Approval is disabled. The previous decision history is preserved; a new
      review cycle is required.
    </div>
  </Block>
);

export const StaleState = memo(StaleStateBase);

const TONE_FOR_PHASE: Record<CommandPhase, string> = {
  accepted: OWL_TOKENS.accent.owlagents,
  committed: OWL_TOKENS.accent.ok,
  failed: OWL_TOKENS.accent.error,
  idle: OWL_TOKENS.accent.dim,
  processing: OWL_TOKENS.accent.owlagents,
  requested: OWL_TOKENS.accent.owlagents,
};

const PHASE_LABEL: Record<CommandPhase, string> = {
  accepted: "Accepted",
  committed: "Committed",
  failed: "Failed",
  idle: "",
  processing: "Processing",
  requested: "Requested",
};

/**
 * Renders the outcome of a transition, including the refusals.
 *
 * "Committed" only ever appears when the store has actually committed and
 * appended a ledger event — the phase is computed from that, not from the call
 * returning.
 */
const CommandFeedbackBase: FC<{
  error: ServiceFailure["error"] | undefined;
  phase: CommandPhase;
}> = ({ error, phase }) => {
  // eslint-disable-next-line unicorn/no-null
  if (phase === "idle") return null;

  return (
    <Block $tone={TONE_FOR_PHASE[phase]}>
      <Heading>
        {error ? FAILURE_LABELS[error.code] : PHASE_LABEL[phase]}
      </Heading>
      {error?.message}
      {error?.action ? <div>{error.action}</div> : undefined}
      {error?.detail ? <div>{error.detail}</div> : undefined}
    </Block>
  );
};

export const CommandFeedback = memo(CommandFeedbackBase);
