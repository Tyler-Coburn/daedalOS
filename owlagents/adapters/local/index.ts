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
  /**
   * One read in flight, and one polling chain, no matter how the subscriber
   * count moves.
   *
   * React StrictMode mounts, unmounts and remounts in development, and the
   * operator can close and reopen a window at any time. Each of those can bring
   * the subscriber count back to one while the previous read is still awaiting
   * the network — and the old chain's `.finally(schedule)` would re-arm
   * alongside the new one, doubling the poll rate every cycle.
   */
  let inFlight: Promise<void> | undefined;
  let generation = 0;

  const notify = (): void => {
    listeners.forEach((listener) => listener());
  };

  const readOnce = async (): Promise<void> => {
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
        // Carry the retained rows over as DEGRADED, never as they last stood.
        // They were captured while the read was working, so leaving them alone
        // left System Health showing "Olympus API — Connected" in green beside
        // a tray badge reading DEGRADED. One authority value, two surfaces
        // disagreeing, is exactly what the environment model forbids.
        services: snapshot.services.map((service) => ({
          ...service,
          state: "degraded" as const,
        })),
        version,
      };
    }

    notify();
  };

  /** Joins the read already in flight rather than starting a second one. */
  const refresh = (): Promise<void> => {
    inFlight ??= readOnce().finally(() => {
      inFlight = undefined;
    });

    return inFlight;
  };

  /**
   * Polling exists only while something is watching. Nobody subscribed means
   * nobody is looking at the queue, and a command center nobody has open should
   * not keep asking the runtime how it is doing.
   *
   * The generation check retires a chain whose subscribers have all gone: a
   * read that settles after the last unsubscribe belongs to a dead generation
   * and must not re-arm the timer.
   */
  const schedule = (era: number): void => {
    if (listeners.size === 0 || era !== generation) return;

    timer = setTimeout(() => {
      refresh().finally(() => schedule(era));
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

      if (isFirst) {
        generation += 1;

        const era = generation;

        refresh().finally(() => schedule(era));
      }

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
