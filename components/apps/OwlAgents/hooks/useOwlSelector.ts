import { useCallback, useRef, useSyncExternalStore } from "react";
import { useOwlAgentsContext } from "contexts/owlagents";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";

/**
 * Subscribes a component to one slice of the snapshot.
 *
 * `getSnapshot` must return a referentially stable value or React loops, so the
 * selection is cached against the snapshot it was derived from. `isEqual` lets
 * a selector that builds a fresh array each call still avoid a re-render.
 *
 * `getServerSnapshot` returns the frozen initial value: the site is statically
 * exported, and a hydration mismatch would log a React warning, which the e2e
 * console gate turns into a failure.
 */
const useOwlSelector = <T>(
  selector: (snapshot: OwlAgentsSnapshot) => T,
  isEqual?: (previous: T, next: T) => boolean
): T => {
  const { getServerSnapshot, getSnapshot, subscribe } = useOwlAgentsContext();
  const cache = useRef<{ snapshot: OwlAgentsSnapshot; value: T } | undefined>(
    undefined
  );

  const select = useCallback(
    (snapshot: OwlAgentsSnapshot): T => {
      const cached = cache.current;

      if (cached?.snapshot === snapshot) return cached.value;

      const next = selector(snapshot);

      if (cached && isEqual?.(cached.value, next)) {
        cache.current = { snapshot, value: cached.value };

        return cached.value;
      }

      cache.current = { snapshot, value: next };

      return next;
    },
    [isEqual, selector]
  );

  return useSyncExternalStore(
    subscribe,
    () => select(getSnapshot()),
    () => select(getServerSnapshot())
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
