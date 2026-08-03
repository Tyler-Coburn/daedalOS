import {
  type CommandOutcome,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";
import { describeEnvironment } from "owlagents/domain/authority";
import { failResult, type ServiceResult } from "owlagents/domain/outcome";
import {
  createEmptySnapshot,
  type OwlAgentsSnapshot,
} from "owlagents/domain/snapshot";

/** Nothing to unsubscribe from — this adapter never emits. */
const unsubscribe = (): void => undefined;

/**
 * Remote companion access — read-mostly, for looking at the command center from
 * another device. Not implemented in Phase B2.
 *
 * It may never own local execution state, policy decisions, review approval,
 * runtime state or Wovenstead publication.
 */
export const createRemoteAdapter = (): OwlAgentsAdapter => {
  // An unconfigured adapter shows nothing. Borrowing the demo fixtures here
  // would put fabricated work orders in front of an operator under an OFFLINE
  // badge — exactly the confusion the badge exists to prevent.
  const snapshot: OwlAgentsSnapshot = createEmptySnapshot(
    describeEnvironment("OFFLINE"),
    new Date().toISOString()
  );

  return {
    applyCommand: (): Promise<ServiceResult<CommandOutcome>> =>
      Promise.resolve(
        failResult(
          "blocked",
          "The remote companion is read-only and is not configured.",
          { action: "Perform this action on the local machine." }
        )
      ),
    getAuthority: () => snapshot.environment,
    id: "remote",
    readSnapshot: () => snapshot,
    subscribe: () => unsubscribe,
  };
};
