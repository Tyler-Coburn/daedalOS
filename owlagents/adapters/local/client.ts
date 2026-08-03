import {
  type OlympusEvent,
  type OlympusHealth,
  type OlympusLimits,
  type OlympusProject,
  type OlympusReading,
  type OlympusStats,
  type OlympusTask,
} from "owlagents/adapters/local/types";

export const DEFAULT_OLYMPUS_URL = "http://127.0.0.1:3001";

const TIMEOUT_MS = 4000;

/**
 * Turns a failed read into a sentence an operator can act on.
 *
 * A browser reports a blocked cross-origin request and an unreachable host
 * identically — `TypeError: Failed to fetch`, no status, no detail. Those two
 * need different fixes, so the message names both rather than guessing, and
 * says so only when the process is actually running in a browser.
 */
export const describeReadFailure = (
  error: unknown,
  baseUrl: string
): string => {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof Error && error.name === "TimeoutError") {
    return `${baseUrl} did not answer within ${TIMEOUT_MS / 1000}s.`;
  }

  if (message === "Failed to fetch" || message === "Load failed") {
    return `${baseUrl} is unreachable, or it answered without CORS headers and the browser discarded the response. Olympus must send Access-Control-Allow-Origin for this page's origin.`;
  }

  return `${baseUrl} could not be read: ${message}`;
};

const getJson = async <T>(baseUrl: string, route: string): Promise<T> => {
  const response = await fetch(`${baseUrl}${route}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${route} responded ${response.status}`);
  }

  return response.json() as Promise<T>;
};

/**
 * How far back to read.
 *
 * This is not a display limit, it is a correctness one. `POST /tasks/:id/approve`
 * writes *only* an event — no column on the task — so the event log is the sole
 * record that an operator accepted an output. `GET /events` offers no filter and
 * no offset, just `ORDER BY id DESC LIMIT ?`, so the only way to know a task was
 * approved is to still be holding its approval event.
 *
 * Read too few and the oldest approvals fall out of the window, and work the
 * operator already signed off silently reverts to "awaiting review" — an alarm
 * they cannot clear, because this adapter refuses writes. The ledger is a
 * single-operator local runtime measured in hundreds of rows, so the window is
 * set far past any plausible need, and `readOlympus` reports when it is
 * saturated instead of letting the shortfall pass unnoticed.
 */
const EVENT_LIMIT = 5000;
const TASK_LIMIT = 2000;

/**
 * Reads everything one refresh needs, in parallel, from one moment.
 *
 * A partial read is not returned: if any call fails the whole reading fails and
 * the adapter degrades. Half a snapshot would show some work as missing rather
 * than as unknown, which is worse than showing nothing.
 */
export const readOlympus = async (baseUrl: string): Promise<OlympusReading> => {
  const [health, tasks, events, projects, stats, limits] = await Promise.all([
    getJson<OlympusHealth>(baseUrl, "/health"),
    getJson<{ tasks: OlympusTask[] }>(baseUrl, `/tasks?limit=${TASK_LIMIT}`),
    getJson<{ events: OlympusEvent[] }>(
      baseUrl,
      `/events?limit=${EVENT_LIMIT}`
    ),
    getJson<{ projects: OlympusProject[] }>(baseUrl, "/projects"),
    getJson<OlympusStats>(baseUrl, "/tasks/stats"),
    getJson<OlympusLimits>(baseUrl, "/tasks/limits"),
  ]);

  return {
    events: events.events,
    health,
    limits,
    projects: projects.projects,
    stats,
    tasks: tasks.tasks,
    // Exactly the limit back means there is probably more we did not see. The
    // snapshot says so rather than quietly reporting a partial history as whole.
    truncated: {
      events: events.events.length >= EVENT_LIMIT,
      tasks: tasks.tasks.length >= TASK_LIMIT,
    },
  };
};
