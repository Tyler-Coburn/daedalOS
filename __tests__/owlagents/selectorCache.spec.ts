import { createSelectionCache } from "components/apps/OwlAgents/hooks/selectionCache";
import { shallowArrayEqual } from "components/apps/OwlAgents/hooks/useOwlSelector";
import { createDemoAdapter } from "owlagents/adapters/demo";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { type WorkOrder } from "owlagents/domain/types";
import {
  selectWorkOrder,
  selectWorkOrderList,
} from "owlagents/selectors/workOrders";

/**
 * The memo `useOwlSelector` actually runs, tested as itself.
 *
 * An earlier version of this file reimplemented the cache inside the spec and
 * asserted against the copy — which meant it passed against the broken hook. A
 * test of the test. `createSelectionCache` exists so the real code is reachable
 * without a React renderer.
 *
 * The defect it pins: keying the cache on the snapshot alone answered the
 * PREVIOUS question, because selecting a different object or filter changes the
 * selector while the snapshot stays the same object. A detail pane kept showing
 * the object that was open before, and a filter rail highlighted "Blocked" over
 * an unfiltered list — across five of the sixteen applications.
 */
const snapshot = createDemoAdapter().readSnapshot();
const ids = Object.keys(snapshot.workOrders);
const [first = "", second = ""] = ids;

/** Two distinct selectors that build equal arrays, for the identity test. */
const listOne = (from: OwlAgentsSnapshot): readonly string[] =>
  Object.keys(from.workOrders);
const listTwo = (from: OwlAgentsSnapshot): readonly string[] =>
  Object.keys(from.workOrders).map((id) => id);

describe("the cache answers the question that was asked", () => {
  test("a new selector against the same snapshot is not a cache hit", () => {
    const select = createSelectionCache<WorkOrder | undefined>();

    expect(select(selectWorkOrder(first), snapshot)?.id).toBe(first);
    // Same snapshot object; only the question changed. This is the defect — it
    // used to return the first work order a second time.
    expect(select(selectWorkOrder(second), snapshot)?.id).toBe(second);
  });

  test("a filter change is visible immediately", () => {
    const select = createSelectionCache(shallowArrayEqual);
    const all = select(selectWorkOrderList("all"), snapshot);
    const blocked = select(selectWorkOrderList("blocked"), snapshot);

    expect(blocked.length).toBeLessThan(all.length);
    expect(blocked.every((order) => order.status === "blocked")).toBe(true);
  });

  test("the same selector and snapshot is a hit, not a recompute", () => {
    let calls = 0;
    const counted = (from: OwlAgentsSnapshot): number => {
      calls += 1;

      return Object.keys(from.workOrders).length;
    };
    const select = createSelectionCache<number>();

    select(counted, snapshot);
    select(counted, snapshot);

    expect(calls).toBe(1);
  });

  test("an equivalent list keeps its reference so nothing re-renders", () => {
    const select = createSelectionCache(shallowArrayEqual);
    const before = select(listOne, snapshot);

    // A different selector building an equal array: recomputed, but the old
    // reference is handed back, so `useSyncExternalStore` sees no change.
    expect(select(listTwo, snapshot)).toBe(before);
  });

  test("a genuinely different answer replaces the reference", () => {
    const select = createSelectionCache(shallowArrayEqual);
    const before = select(selectWorkOrderList("all"), snapshot);

    expect(select(selectWorkOrderList("blocked"), snapshot)).not.toBe(before);
  });
});

describe("the facts the cache rests on", () => {
  test("the demo adapter returns the same snapshot object across reads", () => {
    const adapter = createDemoAdapter();

    expect(adapter.readSnapshot()).toBe(adapter.readSnapshot());
  });

  test("there are at least two work orders to tell apart", () =>
    expect(ids.length).toBeGreaterThan(1));
});
