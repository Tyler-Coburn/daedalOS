import { type CommandOutcome } from "owlagents/adapters/types";

export type IdempotencyRegistry = {
  record: (key: string, outcome: CommandOutcome, eventId: string) => void;
  replay: (
    key: string
  ) => { eventId: string; outcome: CommandOutcome } | undefined;
};

/**
 * Remembers what each idempotency key already committed.
 *
 * A repeated key is answered with `duplicate_request` and must NOT append a
 * second ledger event — double-clicking Approve cannot approve twice.
 */
export const createIdempotencyRegistry = (): IdempotencyRegistry => {
  const seen = new Map<string, { eventId: string; outcome: CommandOutcome }>();

  return {
    record: (key, outcome, eventId) => {
      seen.set(key, { eventId, outcome });
    },
    replay: (key) => seen.get(key),
  };
};
