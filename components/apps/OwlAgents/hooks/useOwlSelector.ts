import { useRef, useSyncExternalStore } from "react";
import {
  createSelectionCache,
  type Selector,
} from "components/apps/OwlAgents/hooks/selectionCache";
import { useOwlAgentsContext } from "contexts/owlagents";

/**
 * Subscribes a component to one slice of the snapshot.
 *
 * `getSnapshot` must return a referentially stable value or React loops, so the
 * selection is memoised by `createSelectionCache` — see that file for why the
 * cache key is (snapshot, selector) and not the snapshot alone.
 *
 * The cache is created once per component and lives in a ref, so it survives
 * re-renders. `isEqual` is read from the first render deliberately: callers pass
 * a module-level comparator (`shallowArrayEqual`) or nothing at all, so it never
 * varies, and capturing it keeps the cache identity stable.
 *
 * `getServerSnapshot` returns the frozen initial value: the site is statically
 * exported, and a hydration mismatch would log a React warning, which the e2e
 * console gate turns into a failure.
 */
const useOwlSelector = <T>(
  selector: Selector<T>,
  isEqual?: (previous: T, next: T) => boolean
): T => {
  const { getServerSnapshot, getSnapshot, subscribe } = useOwlAgentsContext();
  const select = useRef<ReturnType<typeof createSelectionCache<T>>>(undefined);

  select.current ??= createSelectionCache<T>(isEqual);

  return useSyncExternalStore(
    subscribe,
    () => select.current?.(selector, getSnapshot()) as T,
    () => select.current?.(selector, getServerSnapshot()) as T
  );
};

/** Shallow array comparison, for selectors that rebuild a list each read. */
export const shallowArrayEqual = <T>(
  previous: readonly T[],
  next: readonly T[]
): boolean =>
  previous.length === next.length &&
  previous.every((item, index) => item === next[index]);

export default useOwlSelector;
