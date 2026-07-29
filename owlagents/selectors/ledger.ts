import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { type LedgerEvent, type SystemLayer } from "owlagents/domain/types";

export type LedgerQuery = {
  limit?: number;
  objectId?: string;
  since?: string;
  systems?: readonly SystemLayer[];
};

export const selectLedger =
  (query: LedgerQuery = {}) =>
  (snapshot: OwlAgentsSnapshot): readonly LedgerEvent[] => {
    const { limit, objectId, since, systems } = query;

    return snapshot.ledger
      .filter((event) => {
        if (since && event.timestamp <= since) return false;
        if (systems && !systems.includes(event.system)) return false;
        if (objectId && event.objectId !== objectId) return false;

        return true;
      })
      .slice(0, limit ?? snapshot.ledger.length);
  };

/** Everything that has happened since the operator last looked. */
export const selectEventsSinceLastSession = (
  snapshot: OwlAgentsSnapshot
): readonly LedgerEvent[] =>
  selectLedger({ since: snapshot.sessionStartedAt })(snapshot);

export const selectEventsForObject =
  (objectId: string, limit = 8) =>
  (snapshot: OwlAgentsSnapshot): readonly LedgerEvent[] =>
    selectLedger({ limit, objectId })(snapshot);

export const LEDGER_SYSTEMS: readonly SystemLayer[] = [
  "OWL",
  "OLY",
  "WOV",
  "SYS",
];
