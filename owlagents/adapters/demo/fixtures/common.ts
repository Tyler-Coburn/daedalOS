import { type ExecutionScope, type Money } from "owlagents/domain/types";

export const money = (amount: number): Money => ({ amount, currency: "USD" });

export const scope = (
  paths: readonly string[],
  permissions: readonly string[],
  denied: readonly string[],
  limit: number
): ExecutionScope => ({
  costLimit: money(limit),
  denied,
  paths,
  permissions,
});

/** Every write scope an operator holds by default in the demo environment. */
export const DEMO_OPERATOR_SCOPES: readonly string[] = [
  "memory.approve",
  "memory.publish",
  "memory.stage",
  "review.decide",
  "scenario.run",
  "source.intake",
  "workorder.transition",
];

/**
 * Read capabilities the operator holds. Applications declare what they need in
 * `owlagents/registry.json`; `__tests__/owlagents/registry.spec.ts` asserts this
 * list covers every declared capability, because adapters may not import the
 * registry.
 */
export const DEMO_OPERATOR_CAPABILITIES: readonly string[] = [
  "agents.read",
  "artifacts.read",
  "integrations.read",
  "ledger.read",
  "memory.read",
  "policy.read",
  "projects.read",
  "reviews.read",
  "runtime.read",
  "sources.read",
  "terminal.run",
  "workorders.read",
];

/** Revoked by `simulateDeniedPermission`, so the gate can be seen working. */
export const REVOKED_ON_DENIED_PERMISSION = "policy.read";

/** Boundary for "since your last session" in the Mission Control briefing. */
export const DEMO_SESSION_STARTED_AT = "2026-07-28T09:00:00.000Z";
