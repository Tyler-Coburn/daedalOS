import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";

export type Selector<T> = (snapshot: OwlAgentsSnapshot) => T;

/**
 * The memo `useOwlSelector` runs on every read.
 *
 * This lives outside the hook so it can be tested as itself rather than as a
 * copy. It is React-free and holds no hook state: the hook keeps one of these
 * per component in a ref and calls it.
 *
 * Two things have to be true at once, and they pull in opposite directions.
 *
 * `useSyncExternalStore` calls the getSnapshot closure on every render and
 * re-renders whenever the returned reference changes, so a selector that
 * rebuilds a list must be able to hand back the previous array — that is
 * `isEqual`.
 *
 * But the cache must also notice when the *question* changes. Selecting a
 * different work order or clicking a filter produces a new selector against the
 * same snapshot object: nothing about the data changed, only what was asked.
 * Keying on the snapshot alone answers the previous question — a detail pane
 * showing the object that was open before, under a highlight pointing at the
 * new one; a filter rail highlighting "Blocked" over an unfiltered list.
 *
 * So the key is (snapshot, selector), and `isEqual` runs after a miss rather
 * than instead of one.
 */
export const createSelectionCache = <T>(
  isEqual?: (previous: T, next: T) => boolean
): ((selector: Selector<T>, snapshot: OwlAgentsSnapshot) => T) => {
  let cached:
    | { selector: Selector<T>; snapshot: OwlAgentsSnapshot; value: T }
    | undefined;

  return (selector, snapshot) => {
    if (cached?.snapshot === snapshot && cached.selector === selector) {
      return cached.value;
    }

    const next = selector(snapshot);

    // Keep the old reference when the answer is equivalent: that is what stops
    // a rebuilt-but-identical list re-rendering the tree.
    if (cached && isEqual?.(cached.value, next)) {
      cached = { selector, snapshot, value: cached.value };

      return cached.value;
    }

    cached = { selector, snapshot, value: next };

    return next;
  };
};
