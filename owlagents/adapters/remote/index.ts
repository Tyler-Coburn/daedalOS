import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import {
  type CommandOutcome,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";
import { describeEnvironment } from "owlagents/domain/authority";
import { failResult, type ServiceResult } from "owlagents/domain/outcome";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";

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
  const snapshot: OwlAgentsSnapshot = {
    ...createDemoSnapshot(),
    environment: describeEnvironment("OFFLINE"),
  };

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
