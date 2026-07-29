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

/** The wall-clock moment the demo fixtures describe. */
export const DEMO_NOW = "2026-07-28T14:32:09.000Z";

/** Boundary for "since your last session" in the Mission Control briefing. */
export const DEMO_SESSION_STARTED_AT = "2026-07-28T09:00:00.000Z";
