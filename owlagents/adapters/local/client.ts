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
 * Reads everything one refresh needs, in parallel, from one moment.
 *
 * A partial read is not returned: if any call fails the whole reading fails and
 * the adapter degrades. Half a snapshot would show some work as missing rather
 * than as unknown, which is worse than showing nothing.
 */
export const readOlympus = async (
  baseUrl: string,
  limit = 200
): Promise<OlympusReading> => {
  const [health, tasks, events, projects, stats, limits] = await Promise.all([
    getJson<OlympusHealth>(baseUrl, "/health"),
    getJson<{ tasks: OlympusTask[] }>(baseUrl, `/tasks?limit=${limit}`),
    getJson<{ events: OlympusEvent[] }>(baseUrl, `/events?limit=${limit}`),
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
  };
};
