import { memo } from "react";
import styled from "styled-components";
import { Pre } from "components/apps/OwlAgents/components/primitives";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";

const Grid = styled.div`
  display: grid;
  gap: ${OWL_TOKENS.space.md};
  grid-template-columns: 1fr 1fr;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

const Side = styled.div<{ $tone: string }>`
  border: 1px solid ${OWL_TOKENS.color.border};
  border-radius: ${OWL_TOKENS.radius.card};
  overflow: hidden;

  > h4 {
    background-color: ${({ $tone }) => $tone};
    color: ${OWL_TOKENS.color.text};
    font-size: ${OWL_TOKENS.font.sectionSize};
    font-weight: 600;
    letter-spacing: ${OWL_TOKENS.font.sectionTracking};
    margin: 0;
    padding: ${OWL_TOKENS.space.sm} ${OWL_TOKENS.space.md};
    text-transform: uppercase;
  }
`;

type ComparisonViewerProps = {
  after: string;
  afterLabel: string;
  before: string;
  beforeLabel: string;
};

/** Before and after, side by side. Red on the left, green on the right. */
const ComparisonViewerBase: FC<ComparisonViewerProps> = ({
  after,
  afterLabel,
  before,
  beforeLabel,
}) => (
  <Grid>
    <Side $tone="rgba(224 92 92 / 8%)">
      <h4>{beforeLabel}</h4>
      <Pre>{before}</Pre>
    </Side>
    <Side $tone="rgba(87 185 106 / 8%)">
      <h4>{afterLabel}</h4>
      <Pre>{after}</Pre>
    </Side>
  </Grid>
);

export const ComparisonViewer = memo(ComparisonViewerBase);

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

const Step = styled.li<{ $state: "current" | "done" | "todo" }>`
  color: ${({ $state }) =>
    $state === "todo" ? OWL_TOKENS.color.textDim : OWL_TOKENS.color.text};
  display: flex;
  gap: ${OWL_TOKENS.space.sm};
  padding: 3px 0;

  > span:first-child {
    color: ${({ $state }) => {
      if ($state === "done") return OWL_TOKENS.accent.ok;

      return $state === "current"
        ? OWL_TOKENS.accent.owlagents
        : OWL_TOKENS.color.textDim;
    }};
    width: 12px;
  }
`;

type StageListProps = {
  index: number;
  steps: readonly string[];
};

/**
 * Stage steps, never a percentage. Open-ended AI work has no honest
 * denominator, so the current step is named instead of being estimated.
 */
const StageListBase: FC<StageListProps> = ({ index, steps }) => (
  <Steps>
    {steps.map((step, position) => {
      const state =
        position < index ? "done" : position === index ? "current" : "todo";

      return (
        <Step key={step} $state={state}>
          <span aria-hidden>
            {state === "done" ? "✓" : state === "current" ? "▶" : "·"}
          </span>
          <span>
            {step}
            {state === "current" ? " (current stage)" : ""}
          </span>
        </Step>
      );
    })}
  </Steps>
);

export const StageList = memo(StageListBase);

const Events = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

const EventRow = styled.li`
  color: ${OWL_TOKENS.color.textMuted};
  cursor: text;
  display: flex;
  font-family: ${OWL_TOKENS.font.mono};
  font-size: ${OWL_TOKENS.font.monoSize};
  gap: ${OWL_TOKENS.space.md};
  padding: 2px 0;
  user-select: text;

  > time {
    color: ${OWL_TOKENS.color.textDim};
    flex: 0 0 62px;
  }
`;

type StateTimelineProps = {
  events: readonly { id: string; message: string; timestamp: string }[];
};

const StateTimelineBase: FC<StateTimelineProps> = ({ events }) => (
  <Events>
    {events.map((event) => (
      <EventRow key={event.id}>
        <time dateTime={event.timestamp}>{event.timestamp.slice(11, 19)}</time>
        <span>{event.message}</span>
      </EventRow>
    ))}
  </Events>
);

export const StateTimeline = memo(StateTimelineBase);
