import { memo } from "react";
import styled from "styled-components";
import { selectableText } from "components/apps/OwlAgents/components/primitives";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";

const Table = styled.table`
  border-collapse: collapse;
  font-size: ${OWL_TOKENS.font.rowSize};
  table-layout: fixed;
  width: 100%;
`;

const Caption = styled.caption`
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const HeaderCell = styled.th<{ $align?: string; $width?: string }>`
  background-color: ${OWL_TOKENS.color.surface0};
  border-bottom: 1px solid ${OWL_TOKENS.color.border};
  color: ${OWL_TOKENS.color.textDim};
  font-size: ${OWL_TOKENS.font.sectionSize};
  font-weight: 600;
  height: ${OWL_TOKENS.size.columnHeader};
  letter-spacing: ${OWL_TOKENS.font.sectionTracking};
  padding: 0 ${OWL_TOKENS.space.md};
  position: sticky;
  text-align: ${({ $align }) => $align ?? "left"};
  text-transform: uppercase;
  top: 0;
  width: ${({ $width }) => $width ?? "auto"};
`;

const Row = styled.tr<{ $selected?: boolean }>`
  background-color: ${({ $selected }) =>
    $selected ? OWL_TOKENS.color.selected : "transparent"};

  &:hover {
    background-color: ${({ $selected }) =>
      $selected ? OWL_TOKENS.color.selected : OWL_TOKENS.color.hover};
  }
`;

const Cell = styled.td<{ $align?: string }>`
  ${selectableText}

  border-bottom: 1px solid ${OWL_TOKENS.color.divider};
  height: ${OWL_TOKENS.size.row};
  overflow: hidden;
  padding: 0 ${OWL_TOKENS.space.md};
  text-align: ${({ $align }) => $align ?? "left"};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SelectButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  padding: 0;
  text-align: left;
  width: 100%;

  &:focus-visible {
    outline: 1px solid ${OWL_TOKENS.color.focusRing};
    outline-offset: -1px;
  }
`;

const Empty = styled.p`
  color: ${OWL_TOKENS.color.textDim};
  margin: 0;
  padding: ${OWL_TOKENS.space.lg};
`;

export type DataColumn<T> = {
  align?: "left" | "right";
  header: string;
  id: string;
  render: (row: T) => React.ReactNode;
  width?: string;
};

type DataTableProps<T> = {
  caption: string;
  columns: readonly DataColumn<T>[];
  emptyMessage?: string;
  getRowId: (row: T) => string;
  onSelect?: (id: string) => void;
  rows: readonly T[];
  selectedId?: string;
};

/**
 * A real `<table>` with a caption and column scopes, not a div grid.
 *
 * Selection lives on a button inside the first cell rather than on the row: a
 * clickable `<tr>` is not keyboard reachable, and wrapping the whole row in a
 * button would nest the interactive elements the later cells contain.
 */
const DataTable = <T,>({
  caption,
  columns,
  emptyMessage = "Nothing to show.",
  getRowId,
  onSelect,
  rows,
  selectedId,
}: DataTableProps<T>): React.ReactElement => {
  if (rows.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <Table>
      <Caption>{caption}</Caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <HeaderCell
              key={column.id}
              $align={column.align}
              $width={column.width}
              scope="col"
            >
              {column.header}
            </HeaderCell>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const rowId = getRowId(row);

          return (
            <Row key={rowId} $selected={rowId === selectedId}>
              {columns.map((column, index) => (
                <Cell key={column.id} $align={column.align}>
                  {index === 0 && onSelect ? (
                    <SelectButton onClick={() => onSelect(rowId)} type="button">
                      {column.render(row)}
                    </SelectButton>
                  ) : (
                    column.render(row)
                  )}
                </Cell>
              ))}
            </Row>
          );
        })}
      </tbody>
    </Table>
  );
};

export default memo(DataTable) as typeof DataTable;
