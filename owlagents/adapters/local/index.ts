import {
  DEFAULT_OLYMPUS_URL,
  describeReadFailure,
  readOlympus,
} from "owlagents/adapters/local/client";
import { LOCAL_CAPABILITIES, toSnapshot } from "owlagents/adapters/local/map";
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

type LocalAdapterOptions = {
  baseUrl?: string;
  /** How often to re-read. Olympus is local, so this is cheap. */
  refreshMs?: number;
  sessionStartedAt?: string;
};

/**
 * The Olympus runtime as the local authority.
 *
 * Olympus already owns execution: a transition table, a ledger, dedupe keys and
 * cost limits over SQLite. This adapter does not duplicate any of that — it maps
 * one Olympus task onto one `ExecutionRun` and derives the governing
 * `WorkOrder` around it. Everything Olympus does not model stays empty rather
 * than being invented.
 *
 * Read-only in this phase. Writes are refused with a reason, because whether
 * daedalOS may fire Olympus tasks is a governance decision the operator has not
 * made yet — the ecosystem rule is currently "the operator is the bridge".
 */
export const createLocalAdapter = (
  options: LocalAdapterOptions = {}
): OwlAgentsAdapter => {
  const baseUrl = options.baseUrl ?? DEFAULT_OLYMPUS_URL;
  const sessionStartedAt = options.sessionStartedAt ?? new Date().toISOString();
  const listeners = new Set<() => void>();

  // Nothing borrowed from the demo fixtures: an unreachable authority shows
  // nothing, so the operator can never mistake fixtures for real work.
  //
  // Capabilities are the exception, and deliberately so. They describe the
  // operator, not the connection — withholding them while Olympus is down would
  // make every application claim the operator lacks permission, which is a
  // different and untrue reason for the same empty screen.
  let snapshot: OwlAgentsSnapshot = {
    ...createEmptySnapshot(describeEnvironment("OFFLINE"), sessionStartedAt),
    capabilities: LOCAL_CAPABILITIES,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hasRead = false;
  // Monotonic across the session, so a reader can always tell "this is newer"
  // apart from "this is the same reading again".
  let version = 1;

  const notify = (): void => {
    listeners.forEach((listener) => listener());
  };

  const refresh = async (): Promise<void> => {
    version += 1;

    try {
      snapshot = {
        ...toSnapshot(await readOlympus(baseUrl), sessionStartedAt),
        version,
      };
      hasRead = true;
    } catch (error) {
      // Keep the last authoritative state, but stop claiming it is current.
      // DEGRADED means "this was real and may now be behind"; OFFLINE means
      // "nothing has ever been read this session", and the two must not blur.
      const mode = hasRead ? "DEGRADED" : "OFFLINE";

      snapshot = {
        ...snapshot,
        environment: {
          ...describeEnvironment(mode),
          // A badge that says only OFFLINE leaves the operator guessing whether
          // Olympus is down, the URL is wrong, or the browser blocked the read.
          detail: describeReadFailure(error, baseUrl),
        },
        version,
      };
    }

    notify();
  };

  /**
   * Polling exists only while something is watching. Nobody subscribed means
   * nobody is looking at the queue, and a command center nobody has open should
   * not keep asking the runtime how it is doing.
   */
  const schedule = (): void => {
    if (listeners.size === 0) return;

    timer = setTimeout(() => {
      refresh().finally(schedule);
    }, options.refreshMs ?? 5000);
  };

  return {
    applyCommand: (envelope): Promise<ServiceResult<CommandOutcome>> =>
      Promise.resolve(
        failResult(
          "blocked",
          "daedalOS is reading the Olympus runtime, not driving it. Nothing was committed.",
          {
            action:
              "Perform this transition in Olympus. Enabling writes from here is a governance decision, not a missing feature.",
            detail: envelope.command.kind,
          }
        )
      ),
    getAuthority: () => snapshot.environment,
    id: "local",
    readSnapshot: () => snapshot,
    subscribe: (listener) => {
      const isFirst = listeners.size === 0;

      listeners.add(listener);

      if (isFirst) refresh().finally(schedule);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0 && timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      };
    },
  };
};
