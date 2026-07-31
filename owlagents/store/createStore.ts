import { createDemoAdapter } from "owlagents/adapters/demo";
import { createLocalAdapter } from "owlagents/adapters/local";
import { createRemoteAdapter } from "owlagents/adapters/remote";
import { createSupabaseAdapter } from "owlagents/adapters/supabase";
import { type OwlAgentsAdapter } from "owlagents/adapters/types";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { createServices } from "owlagents/services";
import { type OwlAgentsServices } from "owlagents/services/types";

/**
 * Which authority the session runs against. `demo` is the default; `local`
 * reads the Olympus runtime; the rest are boundaries that report OFFLINE or
 * DEGRADED until they are implemented. No adapter ever falls back to fixtures —
 * an authority that cannot be reached shows nothing rather than something
 * borrowed.
 */
const ADAPTERS = {
  demo: () => createDemoAdapter(),
  local: () =>
    createLocalAdapter({ baseUrl: process.env.NEXT_PUBLIC_OLYMPUS_URL }),
  remote: () => createRemoteAdapter(),
  supabase: () => createSupabaseAdapter(),
} as const;

type AdapterId = keyof typeof ADAPTERS;

const isAdapterId = (value: string | undefined): value is AdapterId =>
  value !== undefined && value in ADAPTERS;

/**
 * Build-time selection, not runtime discovery.
 *
 * Reading `localStorage` or `/session.json` here would let browser state decide
 * which authority the operator is looking at, and browser state is not
 * authoritative for operational decisions. An unrecognised value falls back to
 * `demo`, which is labelled as fixtures everywhere it appears.
 */
const configuredAdapter = (): AdapterId =>
  isAdapterId(process.env.NEXT_PUBLIC_OWLAGENTS_ADAPTER)
    ? process.env.NEXT_PUBLIC_OWLAGENTS_ADAPTER
    : "demo";

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
  const selected = options.adapter ?? configuredAdapter();
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
