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
 * The cache is keyed on the selector as well as the snapshot, and that is not
 * an optimisation detail. Selecting a different object or filter changes the
 * selector's identity while the snapshot stays the same object — nothing about
 * the data changed, only what the operator asked for. Keying on the snapshot
 * alone returns the previous selector's answer, so a detail pane keeps showing
 * the object that was open before and a filtered list stays unfiltered under a
 * highlighted filter. `cache` is a ref that outlives the `useCallback` below,
 * so the selector has to be part of the key rather than merely a dependency.
 *
 * Every caller memoises its selector (see `useOwlData`), so a fresh identity
 * genuinely means a different question, never a render-loop.
 *
 * `getServerSnapshot` returns the frozen initial value: the site is statically
 * exported, and a hydration mismatch would log a React warning, which the e2e
 * console gate turns into a failure.
 */
type Selector<T> = (snapshot: OwlAgentsSnapshot) => T;

const useOwlSelector = <T>(
  selector: Selector<T>,
  isEqual?: (previous: T, next: T) => boolean
): T => {
  const { getServerSnapshot, getSnapshot, subscribe } = useOwlAgentsContext();
  const cache = useRef<
    | {
        selector: Selector<T>;
        snapshot: OwlAgentsSnapshot;
        value: T;
      }
    | undefined
  >(undefined);

  const select = useCallback(
    (snapshot: OwlAgentsSnapshot): T => {
      const cached = cache.current;

      if (cached?.snapshot === snapshot && cached.selector === selector) {
        return cached.value;
      }

      const next = selector(snapshot);

      // Still worth keeping the old reference when the answer is equivalent:
      // that is what stops a rebuilt-but-identical list re-rendering the tree.
      if (cached && isEqual?.(cached.value, next)) {
        cache.current = { selector, snapshot, value: cached.value };

        return cached.value;
      }

      cache.current = { selector, snapshot, value: next };

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
