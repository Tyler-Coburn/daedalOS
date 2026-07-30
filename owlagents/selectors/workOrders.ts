import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { type WorkOrder } from "owlagents/domain/types";
import {
  allowedTransitions,
  WORK_ORDER_FILTER_ORDER,
  type WorkOrderStatus,
  type WorkOrderTransition,
} from "owlagents/domain/workOrderStatus";

export type WorkOrderFilter = WorkOrderStatus | "all";

const byUpdatedDescending = (a: WorkOrder, b: WorkOrder): number =>
  b.updatedAt.localeCompare(a.updatedAt);

export const selectWorkOrder =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): WorkOrder | undefined =>
    snapshot.workOrders[id];

export const selectWorkOrderList =
  (filter: WorkOrderFilter) =>
  (snapshot: OwlAgentsSnapshot): readonly WorkOrder[] =>
    Object.values(snapshot.workOrders)
      .filter((workOrder) => filter === "all" || workOrder.status === filter)
      .sort(byUpdatedDescending);

/**
 * Counts for the filter rail. Every status is present even at zero, so the rail
 * does not reflow as work moves through it.
 */
export const selectWorkOrderCounts = (
  snapshot: OwlAgentsSnapshot
): readonly { count: number; filter: WorkOrderFilter }[] => {
  const workOrders = Object.values(snapshot.workOrders);

  return [
    { count: workOrders.length, filter: "all" as const },
    ...WORK_ORDER_FILTER_ORDER.map((status) => ({
      count: workOrders.filter((workOrder) => workOrder.status === status)
        .length,
      filter: status,
    })),
  ];
};

/**
 * Only the moves that are legal right now. The detail panel renders buttons
 * from this, so an illegal action is not merely rejected — it is never offered.
 */
export const selectAllowedTransitions =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): readonly WorkOrderTransition[] => {
    const workOrder = snapshot.workOrders[id];

    if (!workOrder) return [];

    return allowedTransitions(workOrder.status).filter(
      (transition) => transition.actor === "operator"
    );
  };
