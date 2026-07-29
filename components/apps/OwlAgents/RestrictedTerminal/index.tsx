import { memo, useCallback, useState } from "react";
import styled from "styled-components";
import AppShell from "components/apps/OwlAgents/components/AppShell";
import { Scroll } from "components/apps/OwlAgents/components/primitives";
import {
  useOwlServices,
  useAuthority,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import {
  SCENARIO_COMMANDS,
  SCENARIO_LABELS,
  type ScenarioCommand,
} from "owlagents/domain/snapshot";

const Console = styled.div`
  background-color: #0e1016;
  cursor: text;
  flex: 1 1 auto;
  font-family: ${OWL_TOKENS.font.mono};
  font-size: ${OWL_TOKENS.font.monoSize};
  line-height: 1.6;
  min-height: 0;
  overflow: auto;
  padding: ${OWL_TOKENS.space.md};
  user-select: text;
  white-space: pre-wrap;
`;

const Prompt = styled.form`
  align-items: center;
  background-color: #0e1016;
  border-top: 1px solid ${OWL_TOKENS.color.divider};
  display: flex;
  flex: 0 0 auto;
  gap: ${OWL_TOKENS.space.sm};
  padding: ${OWL_TOKENS.space.sm} ${OWL_TOKENS.space.md};

  > label {
    color: #8fd0a3;
    font-family: ${OWL_TOKENS.font.mono};
    font-size: ${OWL_TOKENS.font.monoSize};
  }

  > input {
    background: none;
    border: none;
    color: ${OWL_TOKENS.color.text};
    flex: 1 1 auto;
    font-family: ${OWL_TOKENS.font.mono};
    font-size: ${OWL_TOKENS.font.monoSize};

    &:focus-visible {
      outline: 1px solid ${OWL_TOKENS.color.focusRing};
      outline-offset: 2px;
    }
  }
`;

const HELP = [
  "Approved commands only. This shell cannot execute repositories or spend.",
  "",
  "  help                     show this list",
  "  authority                print the current environment authority",
  "  scenario <name>          run a demo scenario control",
  "  scenario list            list the scenario controls",
  "  clear                    clear the console",
].join("\n");

const isScenarioCommand = (value: string): value is ScenarioCommand =>
  (SCENARIO_COMMANDS as readonly string[]).includes(value);

/**
 * A restricted shell: an allow-list, not a terminal.
 *
 * The scenario controls live here (and in Mission Control) so the demo advances
 * only when an operator asks it to — there is no hidden timer moving state.
 */
const RestrictedTerminal: FC<ComponentProcessProps> = ({ id }) => {
  const services = useOwlServices();
  const authority = useAuthority();
  const [lines, setLines] = useState<readonly string[]>([
    "daedalOS restricted shell. Type `help`.",
  ]);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const input = event.currentTarget.elements.namedItem(
        "command"
      ) as HTMLInputElement | null;
      const entry = input?.value.trim() ?? "";

      if (input) input.value = "";
      if (!entry) return;

      const [command = "", argument = ""] = entry.split(/\s+/);
      const append = (output: string): void =>
        setLines((previous) => [...previous, `> ${entry}`, output]);

      if (command === "clear") {
        setLines([]);

        return;
      }
      if (command === "authority") {
        append(`${authority.mode} — ${authority.detail}`);

        return;
      }
      if (command === "scenario" && argument === "list") {
        append(
          SCENARIO_COMMANDS.map(
            (name) => `  ${name} — ${SCENARIO_LABELS[name]}`
          ).join("\n")
        );

        return;
      }
      if (command === "scenario" && isScenarioCommand(argument)) {
        const result = await services.scenarioService.run(argument);

        append(
          result.ok
            ? `${SCENARIO_LABELS[argument]} — committed (${result.eventId})`
            : `Refused: ${result.error.message}`
        );

        return;
      }
      if (command === "help") {
        append(HELP);

        return;
      }

      append(`Command not permitted: ${command}`);
    },
    [authority, services]
  );

  return (
    <AppShell id={id}>
      <Scroll aria-label="Terminal output" tabIndex={0}>
        <Console>{lines.join("\n")}</Console>
      </Scroll>
      <Prompt onSubmit={onSubmit}>
        <label htmlFor={`${id}-command`}>$</label>
        <input
          autoComplete="off"
          id={`${id}-command`}
          name="command"
          placeholder="help"
          type="text"
        />
      </Prompt>
    </AppShell>
  );
};

export default memo(RestrictedTerminal);
