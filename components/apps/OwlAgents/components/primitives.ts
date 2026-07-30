import styled, { css } from "styled-components";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";

/** Text inside these apps is selectable — hashes, paths and logs get copied. */
export const selectableText = css`
  cursor: text;
  user-select: text;
`;

const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${OWL_TOKENS.color.focusRing};
    outline-offset: -1px;
  }
`;

export const OwlRoot = styled.div`
  background-color: ${OWL_TOKENS.color.surface1};
  color: ${OWL_TOKENS.color.text};
  display: flex;
  flex-direction: column;
  font-family: ${OWL_TOKENS.font.ui};
  font-size: ${OWL_TOKENS.font.rowSize};
  font-variant-numeric: tabular-nums;
  height: 100%;
  overflow: hidden;
  text-rendering: optimizelegibility;
  width: 100%;
`;

export const OwlHeader = styled.header`
  align-items: center;
  border-bottom: 1px solid ${OWL_TOKENS.color.divider};
  display: flex;
  flex: 0 0 auto;
  gap: ${OWL_TOKENS.space.md};
  min-height: ${OWL_TOKENS.size.toolbar};
  padding: 0 ${OWL_TOKENS.space.lg};
`;

export const OwlBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

export const Scroll = styled.div`
  ${focusRing}

  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  scrollbar-color: rgb(77 77 77) rgb(23 23 23);
  scrollbar-width: thin;
`;

export const Pane = styled.section<{ $width?: string }>`
  border-right: 1px solid ${OWL_TOKENS.color.divider};
  display: flex;
  flex: ${({ $width }) => ($width ? `0 0 ${$width}` : "1 1 auto")};
  flex-direction: column;
  min-height: 0;
  min-width: 0;

  &:last-child {
    border-right: none;
  }
`;

export const SectionLabel = styled.h3`
  color: ${OWL_TOKENS.color.textDim};
  font-size: ${OWL_TOKENS.font.sectionSize};
  font-weight: 600;
  letter-spacing: ${OWL_TOKENS.font.sectionTracking};
  margin: 0;
  padding: ${OWL_TOKENS.space.md} ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.sm};
  text-transform: uppercase;
`;

export const Card = styled.div`
  background-color: ${OWL_TOKENS.color.surface2};
  border: 1px solid ${OWL_TOKENS.color.border};
  border-radius: ${OWL_TOKENS.radius.card};
  padding: ${OWL_TOKENS.space.md} 13px;
`;

export const CardGrid = styled.div<{ $columns?: string }>`
  display: grid;
  gap: ${OWL_TOKENS.space.md};
  grid-template-columns: ${({ $columns }) => $columns ?? "1fr 1fr"};
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

export const Mono = styled.span`
  ${selectableText}

  color: ${OWL_TOKENS.color.textMuted};
  font-family: ${OWL_TOKENS.font.mono};
  font-size: ${OWL_TOKENS.font.monoSize};
`;

export const Pre = styled.pre`
  ${selectableText}

  color: ${OWL_TOKENS.color.text};
  font-family: ${OWL_TOKENS.font.mono};
  font-size: ${OWL_TOKENS.font.monoSize};
  line-height: 1.5;
  margin: 0;
  overflow-wrap: break-word;
  padding: ${OWL_TOKENS.space.md};
  white-space: pre-wrap;
`;

export const FieldGrid = styled.dl`
  display: grid;
  gap: ${OWL_TOKENS.space.sm} ${OWL_TOKENS.space.md};
  grid-template-columns: 1fr 1fr;
  margin: 0;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

export const FieldLabel = styled.dt`
  color: ${OWL_TOKENS.color.textDim};
  font-size: ${OWL_TOKENS.font.sectionSize};
  font-weight: 600;
  letter-spacing: ${OWL_TOKENS.font.sectionTracking};
  text-transform: uppercase;
`;

export const FieldValue = styled.dd`
  ${selectableText}

  color: ${OWL_TOKENS.color.text};
  margin: 0 0 ${OWL_TOKENS.space.sm};
`;

export const ListButton = styled.button<{ $selected?: boolean }>`
  ${focusRing}

  background-color: ${({ $selected }) =>
    $selected ? OWL_TOKENS.color.selected : "transparent"};
  border: none;
  border-bottom: 1px solid ${OWL_TOKENS.color.divider};
  color: ${OWL_TOKENS.color.text};
  display: block;
  font-family: inherit;
  font-size: inherit;
  padding: ${OWL_TOKENS.space.sm} ${OWL_TOKENS.space.lg};
  text-align: left;
  width: 100%;

  &:hover {
    background-color: ${({ $selected }) =>
      $selected ? OWL_TOKENS.color.selected : OWL_TOKENS.color.hover};
  }
`;

export const ActionBar = styled.div`
  border-top: 1px solid ${OWL_TOKENS.color.divider};
  display: flex;
  flex-wrap: wrap;
  gap: ${OWL_TOKENS.space.sm};
  padding: ${OWL_TOKENS.space.md} ${OWL_TOKENS.space.lg};
`;

export const ActionButton = styled.button<{ $tone?: string }>`
  ${focusRing}

  background-color: ${OWL_TOKENS.color.surface3};
  border: 1px solid ${({ $tone }) => $tone ?? OWL_TOKENS.color.borderStrong};
  border-radius: ${OWL_TOKENS.radius.control};
  color: ${({ $tone }) => $tone ?? OWL_TOKENS.color.text};
  font-family: inherit;
  font-size: inherit;
  padding: ${OWL_TOKENS.space.sm} ${OWL_TOKENS.space.md};

  &:disabled {
    color: ${OWL_TOKENS.color.textDim};
    cursor: not-allowed;
    opacity: 60%;
  }

  &:hover:not(:disabled) {
    background-color: ${OWL_TOKENS.color.hover};
  }
`;

export const Note = styled.p`
  color: ${OWL_TOKENS.color.textDim};
  font-size: 11px;
  line-height: 1.5;
  margin: 0;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
`;

export const StatusBar = styled.footer`
  align-items: center;
  background-color: rgb(51 51 51);
  color: ${OWL_TOKENS.color.textMuted};
  display: flex;
  flex: 0 0 ${OWL_TOKENS.size.statusBar};
  font-size: 11px;
  gap: ${OWL_TOKENS.space.lg};
  padding: 0 ${OWL_TOKENS.space.md};
`;

export const TabBar = styled.nav`
  border-bottom: 1px solid ${OWL_TOKENS.color.divider};
  display: flex;
  flex: 0 0 auto;
  gap: ${OWL_TOKENS.space.xs};
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.sm};
`;

export const Tab = styled.button<{ $active?: boolean }>`
  ${focusRing}

  background-color: ${({ $active }) =>
    $active ? "rgba(76 194 232 / 12%)" : "transparent"};
  border: 1px solid
    ${({ $active }) => ($active ? "rgba(76 194 232 / 50%)" : "transparent")};
  border-radius: ${OWL_TOKENS.radius.chip};
  color: ${({ $active }) => ($active ? "#7fd6f2" : OWL_TOKENS.color.textMuted)};
  font-family: inherit;
  font-size: inherit;
  padding: ${OWL_TOKENS.space.xs} ${OWL_TOKENS.space.md};

  &:hover {
    color: ${OWL_TOKENS.color.text};
  }
`;
