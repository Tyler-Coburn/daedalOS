import {
  type Incident,
  type ModelProvider,
  type ServiceHealth,
} from "owlagents/domain/types";

/**
 * DEMO FIXTURE — service health.
 *
 * These states are the same values the Integrations registry reports, because
 * both surfaces read one environment authority. A service that is not connected
 * is never rendered as healthy.
 */
export const DEMO_SERVICES: readonly ServiceHealth[] = [
  {
    detail: "127.0.0.1:8090",
    id: "SVC-olympus-api",
    latencyMs: 38,
    name: "Olympus API",
    queueDepth: 0,
    state: "demo",
  },
  {
    detail: "127.0.0.1:3001 · POST /tasks",
    id: "SVC-task-service",
    latencyMs: 22,
    name: "Task Service",
    queueDepth: 4,
    state: "demo",
  },
  {
    detail: "control plane",
    id: "SVC-owlagents",
    latencyMs: 31,
    name: "OwlAgents Services",
    queueDepth: 2,
    state: "demo",
  },
  {
    detail: "127.0.0.1:8765 · token is local and never exposed",
    id: "SVC-memory-bridge",
    latencyMs: 12,
    name: "Memory Bridge",
    queueDepth: 0,
    state: "demo",
  },
  {
    detail: "No runtime detected on 127.0.0.1:11434",
    id: "SVC-ollama",
    name: "Ollama",
    queueDepth: 1,
    state: "disconnected",
  },
  {
    detail: "remote adapter · 429 LIMIT_HIT",
    id: "SVC-provider-gateway",
    name: "Provider Gateway",
    queueDepth: 3,
    state: "degraded",
  },
  {
    detail: "reconnect patch in review (REV-2026-0184)",
    id: "SVC-event-stream",
    latencyMs: 88,
    name: "Event Stream",
    queueDepth: 0,
    state: "degraded",
  },
  {
    detail: "work orders · audit",
    id: "SVC-postgres",
    latencyMs: 4,
    name: "Postgres",
    queueDepth: 0,
    state: "demo",
  },
  {
    detail: "~/Documents/Wovenstead (read-only)",
    id: "SVC-wovenstead-mount",
    latencyMs: 2,
    name: "Wovenstead Mount",
    queueDepth: 0,
    state: "demo",
  },
  {
    detail: "PixelAgents-Launch-Workspace (rw)",
    id: "SVC-local-workspace",
    latencyMs: 1,
    name: "Local Workspace",
    queueDepth: 0,
    state: "demo",
  },
];

export const DEMO_INCIDENTS: readonly Incident[] = [
  {
    detail:
      "Provider gateway returned 429 LIMIT_HIT. WO-2026-0050 is blocked, not retried.",
    id: "INC-0012",
    openedAt: "2026-07-28T14:32:09.000Z",
    severity: "major",
    system: "OLY",
    title: "Provider gateway rate limited",
  },
  {
    detail:
      "Argus event stream drops events during a transient 5xx. Patch is in review.",
    id: "INC-0011",
    openedAt: "2026-07-24T09:15:00.000Z",
    severity: "minor",
    system: "OLY",
    title: "Event stream drops events on transient 5xx",
  },
];

export const DEMO_MODEL_PROVIDERS: readonly ModelProvider[] = [
  {
    contextWindow: 32_768,
    id: "MDL-qwen25-14b",
    latencyMs: 210,
    name: "qwen2.5:14b",
    provider: "Ollama · local",
    role: "Routing",
    state: "disconnected",
  },
  {
    contextWindow: 131_072,
    id: "MDL-llama33-70b",
    latencyMs: 980,
    name: "llama3.3:70b",
    provider: "Ollama · local",
    role: "Research",
    state: "disconnected",
  },
  {
    contextWindow: 32_768,
    id: "MDL-qwen25-coder-32b",
    latencyMs: 640,
    name: "qwen2.5-coder:32b",
    provider: "Ollama · local",
    role: "Coding",
    state: "disconnected",
  },
  {
    contextWindow: 8192,
    id: "MDL-nomic-embed-text",
    latencyMs: 18,
    name: "nomic-embed-text",
    provider: "Ollama · local",
    role: "Embeddings",
    state: "disconnected",
  },
  {
    contextWindow: 204_800,
    id: "MDL-remote-reviewer-lg",
    name: "remote-reviewer-lg",
    provider: "Remote · gateway",
    role: "Review",
    state: "degraded",
  },
  {
    contextWindow: 8192,
    id: "MDL-llava-13b",
    latencyMs: 720,
    name: "llava:13b",
    provider: "Ollama · local",
    role: "Vision",
    state: "disconnected",
  },
];
