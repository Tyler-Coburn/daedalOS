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
 * Optional Supabase companion. Disabled by default and incomplete by design.
 *
 * MAY own, later: remote companion reads, operator authentication for remote
 * sessions, cross-device sync of *shell* preferences, ledger backup, read-only
 * reporting.
 *
 * MAY NEVER own: local execution state, policy decisions, review approval
 * authority, filesystem permissions, Olympus runtime state, Wovenstead
 * publication, agent scopes, or canonical project truth.
 *
 * The Lovable UI-shaped schema (`kpi_snapshots`, `attention_item_text`,
 * `display_events`, `since_last_strings`) is obsolete and must not be adopted;
 * those values are derived from the domain instead.
 *
 * When configuration is missing it reports DEGRADED rather than failing open,
 * and local mode never requires cloud authentication.
 */
export const createSupabaseAdapter = (): OwlAgentsAdapter => {
  // Unconfigured means empty, not borrowed. Demo fixtures under a DEGRADED
  // badge would read as real work the operator cannot currently act on.
  const snapshot: OwlAgentsSnapshot = createEmptySnapshot(
    describeEnvironment("DEGRADED"),
    new Date().toISOString()
  );

  return {
    applyCommand: (): Promise<ServiceResult<CommandOutcome>> =>
      Promise.resolve(
        failResult(
          "blocked",
          "Supabase is not configured, so nothing was committed.",
          {
            action:
              "Operational authority stays local. Configure Supabase only for remote reads and backup.",
          }
        )
      ),
    getAuthority: () => snapshot.environment,
    id: "supabase",
    readSnapshot: () => snapshot,
    subscribe: () => unsubscribe,
  };
};
