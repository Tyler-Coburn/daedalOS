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
