import { createDemoAdapter } from "owlagents/adapters/demo";
import { type OwlAgentsAdapter } from "owlagents/adapters/types";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { createServices } from "owlagents/services";
import { type OwlAgentsServices } from "owlagents/services/types";

export type OwlAgentsStore = {
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

export type CreateStoreOptions = {
  adapter?: OwlAgentsAdapter;
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
  const adapter = options.adapter ?? createDemoAdapter();
  const initialSnapshot = adapter.readSnapshot();

  return {
    getServerSnapshot: () => initialSnapshot,
    getSnapshot: () => adapter.readSnapshot(),
    services: createServices(adapter),
    subscribe: (onChange) => adapter.subscribe(onChange),
  };
};
