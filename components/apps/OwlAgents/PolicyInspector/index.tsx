import { memo } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import {
  FieldGrid,
  FieldLabel,
  FieldValue,
  ListButton,
  Mono,
  Note,
  OwlBody,
  Pane,
  Scroll,
  SectionLabel,
} from "components/apps/OwlAgents/components/primitives";
import { usePolicyRules } from "components/apps/OwlAgents/hooks/useOwlData";
import useOwlWindow from "components/apps/OwlAgents/hooks/useOwlWindow";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";

const Rules = styled.ul`
  display: grid;
  gap: ${OWL_TOKENS.space.xs};
  grid-template-columns: 1fr 1fr;
  list-style: none;
  margin: 0;
  padding: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};

  > li {
    color: ${OWL_TOKENS.color.textMuted};
    cursor: text;
    user-select: text;
  }
`;

const Allowed = styled.span`
  color: #8fd0a3;
`;

const Denied = styled.span`
  color: #e08a8a;
`;

/**
 * Read-only in Phase B2.
 *
 * Editing a policy is deferred: a change to a rule is a reviewable act, so it
 * will arrive as a proposal that routes through the Review Queue rather than as
 * an inline edit here.
 */
const PolicyInspector: FC<ComponentProcessProps> = ({ id }) => {
  const rules = usePolicyRules();
  const { selectedId, setSelectedId } = useOwlWindow(id);
  const selected = rules.find((rule) => rule.id === selectedId) ?? rules[0];

  return (
    <AppShell id={id}>
      <OwlBody>
        <Pane $width={OWL_TOKENS.size.policyList}>
          <SectionLabel>Rules</SectionLabel>
          <Scroll aria-label="Policy rules" tabIndex={0}>
            {rules.map((rule) => (
              <ListButton
                key={rule.id}
                $selected={rule.id === selected?.id}
                onClick={() => setSelectedId(rule.id)}
                type="button"
              >
                <Mono>{rule.id}</Mono> {rule.name}
              </ListButton>
            ))}
          </Scroll>
        </Pane>
        <Pane>
          <Scroll aria-label="Policy detail" tabIndex={0}>
            {selected ? (
              <>
                <SectionLabel>
                  {selected.id} · {selected.name}
                </SectionLabel>
                <FieldGrid>
                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <FieldValue>
                      <StatusChip
                        label={selected.status}
                        status={
                          selected.status === "active" ? "connected" : "draft"
                        }
                      />
                    </FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Owner</FieldLabel>
                    <FieldValue>{selected.owner}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Scope</FieldLabel>
                    <FieldValue>{selected.scope}</FieldValue>
                  </div>
                  <div>
                    <FieldLabel>Human gate</FieldLabel>
                    <FieldValue>{selected.gate}</FieldValue>
                  </div>
                </FieldGrid>
                <SectionLabel>Allowed and denied</SectionLabel>
                <Rules>
                  {selected.allow.map((entry) => (
                    <li key={entry}>
                      <Allowed aria-hidden>✓</Allowed> Allowed: {entry}
                    </li>
                  ))}
                  {selected.deny.map((entry) => (
                    <li key={entry}>
                      <Denied aria-hidden>✕</Denied> Denied: {entry}
                    </li>
                  ))}
                </Rules>
                <Note>{selected.note}</Note>
              </>
            ) : undefined}
          </Scroll>
        </Pane>
      </OwlBody>
    </AppShell>
  );
};

export default memo(PolicyInspector);
