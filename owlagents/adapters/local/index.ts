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
 * The intended authority: a local API, SQLite or Postgres owning work-order
 * state, policy decisions, reviews and publication.
 *
 * Not implemented in Phase B2. It reports OFFLINE and refuses every write with
 * a reason rather than failing open — a disconnected authority must never look
 * healthy, and it must never silently fall back to fixtures.
 */
export const createLocalAdapter = (): OwlAgentsAdapter => {
  const snapshot: OwlAgentsSnapshot = {
    ...createDemoSnapshot(),
    environment: describeEnvironment("OFFLINE"),
  };

  return {
    applyCommand: (): Promise<ServiceResult<CommandOutcome>> =>
      Promise.resolve(
        failResult(
          "blocked",
          "The local authority is not configured. Nothing was committed.",
          { action: "Configure the local adapter, or continue in DEMO mode." }
        )
      ),
    getAuthority: () => snapshot.environment,
    id: "local",
    readSnapshot: () => snapshot,
    subscribe: () => unsubscribe,
  };
};
