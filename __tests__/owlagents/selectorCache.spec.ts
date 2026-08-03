import { createDemoAdapter } from "owlagents/adapters/demo";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import {
  selectWorkOrder,
  selectWorkOrderList,
} from "owlagents/selectors/workOrders";

/**
 * The caching rule `useOwlSelector` depends on, tested without React.
 *
 * `useOwlSelector` memoises a selection so `useSyncExternalStore` gets a stable
 * reference. It used to key that cache on the snapshot alone, which is wrong
 * for a reason no data-driven test could reach: selecting a different object or
 * filter changes the *selector*, not the snapshot. The hook returned the
 * previous selector's answer, so a detail pane kept showing the object that was
 * open before and a filtered list stayed unfiltered beneath a highlighted
 * filter — across five of the sixteen applications.
 *
 * This pins the two facts the fix rests on: the snapshot really is the same
 * object across selections, so it cannot be the whole key; and different
 * selectors really do produce different answers from it.
 */
const adapter = createDemoAdapter();

type AnySelector = (from: OwlAgentsSnapshot) => unknown;

const cacheOn = (
  key: "snapshot" | "snapshotAndSelector"
): (<T>(
  selector: (from: OwlAgentsSnapshot) => T,
  state: OwlAgentsSnapshot
) => T) => {
  let cached:
    | { selector: AnySelector; snapshot: OwlAgentsSnapshot; value: unknown }
    | undefined;

  return <T>(
    selector: (from: OwlAgentsSnapshot) => T,
    state: OwlAgentsSnapshot
  ): T => {
    const hit =
      cached?.snapshot === state &&
      (key === "snapshot" || cached.selector === selector);

    if (hit && cached) return cached.value as T;

    const value = selector(state);

    cached = { selector, snapshot: state, value };

    return value;
  };
};

describe("the snapshot alone cannot identify a selection", () => {
  test("reading twice returns the very same snapshot object", () =>
    // This is what makes snapshot-only caching a trap: nothing about the data
    // changes when the operator clicks a different row.
    expect(adapter.readSnapshot()).toBe(adapter.readSnapshot()));

  test("two ids select two different work orders from that one snapshot", () => {
    const snapshot = adapter.readSnapshot();
    const [first = "", second = ""] = Object.keys(snapshot.workOrders);

    expect(second).not.toBe(first);
    expect(selectWorkOrder(first)(snapshot)).not.toBe(
      selectWorkOrder(second)(snapshot)
    );
  });
});

describe("keying the cache on the snapshot alone returns a stale answer", () => {
  const snapshot = adapter.readSnapshot();
  const [first = "", second = ""] = Object.keys(snapshot.workOrders);

  test("the old key serves the previous selector's object", () => {
    const select = cacheOn("snapshot");

    select(selectWorkOrder(first), snapshot);

    expect(select(selectWorkOrder(second), snapshot)?.id).toBe(first);
  });

  test("keying on the selector too returns the object that was asked for", () => {
    const select = cacheOn("snapshotAndSelector");

    select(selectWorkOrder(first), snapshot);

    expect(select(selectWorkOrder(second), snapshot)?.id).toBe(second);
  });

  test("the same failure hits filtered lists", () => {
    const stale = cacheOn("snapshot");
    const fixed = cacheOn("snapshotAndSelector");
    const all = selectWorkOrderList("all")(snapshot).length;
    const blocked = selectWorkOrderList("blocked")(snapshot).length;

    expect(blocked).toBeLessThan(all);

    stale(selectWorkOrderList("all"), snapshot);
    fixed(selectWorkOrderList("all"), snapshot);

    // The rail highlights "Blocked" while the list still shows everything.
    expect(stale(selectWorkOrderList("blocked"), snapshot)).toHaveLength(all);
    expect(fixed(selectWorkOrderList("blocked"), snapshot)).toHaveLength(
      blocked
    );
  });
});
