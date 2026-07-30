import { createIdempotencyRegistry } from "owlagents/adapters/demo/idempotency";
import {
  applyCommandToSnapshot,
  type ReducerContext,
} from "owlagents/adapters/demo/reducer";
import { DEMO_OPERATOR_SCOPES } from "owlagents/adapters/demo/fixtures/common";
import { runScenario } from "owlagents/adapters/demo/scenarios";
import { createDemoSnapshot } from "owlagents/adapters/demo/snapshot";
import {
  type CommandOutcome,
  type OwlAgentsAdapter,
} from "owlagents/adapters/types";
import {
  failResult,
  okResult,
  type ServiceResult,
} from "owlagents/domain/outcome";

type DemoAdapterOptions = {
  /** Injected so tests are deterministic and snapshots stay comparable. */
  now?: () => string;
};

/**
 * The default operational adapter: typed fixtures, real validation.
 *
 * Writes are simulated but they are not pretended — every command goes through
 * the same reducer a live adapter would, so an illegal transition, a stale
 * version or a missing permission fails here exactly as it would in LOCAL mode.
 * Nothing it returns is authoritative, and `environment.isFixture` says so.
 */
export const createDemoAdapter = (
  options: DemoAdapterOptions = {}
): OwlAgentsAdapter => {
  const listeners = new Set<() => void>();
  const idempotency = createIdempotencyRegistry();
  let snapshot = createDemoSnapshot();
  let scopes: ReadonlySet<string> = new Set(DEMO_OPERATOR_SCOPES);
  let eventCounter = 1000;

  const nextEventId = (): string => {
    eventCounter += 1;

    return `EVT-${String(eventCounter).padStart(6, "0")}`;
  };
  const now = options.now ?? ((): string => new Date().toISOString());
  const makeContext = (): ReducerContext => ({
    grantedScopes: scopes,
    nextEventId,
    now,
  });

  const notify = (): void => {
    listeners.forEach((listener) => listener());
  };

  return {
    applyCommand: (envelope): Promise<ServiceResult<CommandOutcome>> => {
      const replayed = idempotency.replay(envelope.idempotencyKey);

      // A repeated key is reported, never re-applied: no second ledger event.
      if (replayed) {
        return Promise.resolve(
          failResult(
            "duplicate_request",
            "This request already completed. It was not applied a second time.",
            { detail: replayed.eventId }
          )
        );
      }

      if (envelope.command.kind === "scenario.run") {
        const outcome = runScenario(
          snapshot,
          envelope.command.command,
          scopes,
          makeContext()
        );

        snapshot = outcome.snapshot;
        scopes = outcome.scopes;
        notify();

        return Promise.resolve(
          okResult(
            { objectId: envelope.command.command, objectType: "scenario" },
            snapshot.ledger[0]?.id ?? "EVT-000000"
          )
        );
      }

      const { result, snapshot: next } = applyCommandToSnapshot(
        snapshot,
        envelope,
        makeContext()
      );

      snapshot = next;

      if (result.ok) {
        idempotency.record(
          envelope.idempotencyKey,
          result.data,
          result.eventId
        );
      }

      notify();

      return Promise.resolve(result);
    },
    getAuthority: () => snapshot.environment,
    id: "demo",
    readSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
