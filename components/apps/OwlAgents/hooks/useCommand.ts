import { useCallback, useState } from "react";
import { useOwlAgentsContext } from "contexts/owlagents";
import { type CommandOutcome } from "owlagents/adapters/types";
import {
  type ServiceFailure,
  type ServiceResult,
} from "owlagents/domain/outcome";

export type CommandPhase =
  | "accepted"
  | "committed"
  | "failed"
  | "idle"
  | "processing"
  | "requested";

/**
 * The gate that stops the UI reporting success before anything committed.
 *
 * `run` reaches `committed` only after the store's ledger actually contains the
 * event the service returned. Every failure — stale version, wrong state,
 * denied permission, duplicate request — lands in `failed` with the reason and,
 * where there is one, the action to take. Components render success chrome from
 * `phase === "committed"` and nothing else.
 */
const useCommand = <A>(
  call: (args: A) => Promise<ServiceResult<CommandOutcome>>
): {
  error: ServiceFailure["error"] | undefined;
  phase: CommandPhase;
  reset: () => void;
  run: (args: A) => Promise<void>;
} => {
  const { getSnapshot } = useOwlAgentsContext();
  const [state, setState] = useState<{
    error: ServiceFailure["error"] | undefined;
    phase: CommandPhase;
  }>({ error: undefined, phase: "idle" });

  const run = useCallback(
    async (args: A): Promise<void> => {
      setState({ error: undefined, phase: "requested" });

      const result = await call(args);

      if (!result.ok) {
        setState({ error: result.error, phase: "failed" });

        return;
      }

      const committed = getSnapshot().ledger.some(
        (event) => event.id === result.eventId
      );

      setState({
        error: undefined,
        phase: committed ? "committed" : "processing",
      });
    },
    [call, getSnapshot]
  );

  const reset = useCallback(
    () => setState({ error: undefined, phase: "idle" }),
    []
  );

  return { error: state.error, phase: state.phase, reset, run };
};

export default useCommand;
