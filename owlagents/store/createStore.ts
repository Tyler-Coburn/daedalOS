import { createDemoAdapter } from "owlagents/adapters/demo";
import { createLocalAdapter } from "owlagents/adapters/local";
import { createRemoteAdapter } from "owlagents/adapters/remote";
import { createSupabaseAdapter } from "owlagents/adapters/supabase";
import { type OwlAgentsAdapter } from "owlagents/adapters/types";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { createServices } from "owlagents/services";
import { type OwlAgentsServices } from "owlagents/services/types";

/**
 * Which authority the session runs against. `demo` is the default; the others
 * are boundaries that report OFFLINE or DEGRADED until they are implemented,
 * so selecting one can never silently fall back to fixtures.
 */
const ADAPTERS = {
  demo: createDemoAdapter,
  local: createLocalAdapter,
  remote: createRemoteAdapter,
  supabase: createSupabaseAdapter,
} as const;

type AdapterId = keyof typeof ADAPTERS;

type OwlAgentsStore = {
  /**
   * Static export prerenders the page, so hydration must see the same value the
   * server rendered. Returning the initial snapshot guarantees that — a
   * mismatch would log a React warning, and the e2e console gate throws on any
   * console output.
   */
  getServerSnapshot: () => OwlAgentsSnapshot;
  getSnapshot: () => OwlAgentsSnapshot;
  services: OwlAgentsServices;
  subscribe: (onChange: () => void) => () => void;
};

type CreateStoreOptions = {
  adapter?: AdapterId | OwlAgentsAdapter;
};

/**
 * One store, created once per session.
 *
 * Reactivity is subscription-based rather than context-value-based: the
 * context value never changes identity, so no component re-renders because of
 * the provider. Components subscribe to the slices they actually read, which is
 * what makes `memo()` load-bearing across sixteen dense applications.
 */
export const createOwlAgentsStore = (
  options: CreateStoreOptions = {}
): OwlAgentsStore => {
  const selected = options.adapter ?? "demo";
  const adapter =
    typeof selected === "string" ? ADAPTERS[selected]() : selected;
  const initialSnapshot = adapter.readSnapshot();

  return {
    getServerSnapshot: () => initialSnapshot,
    getSnapshot: () => adapter.readSnapshot(),
    services: createServices(adapter),
    subscribe: (onChange) => adapter.subscribe(onChange),
  };
};
