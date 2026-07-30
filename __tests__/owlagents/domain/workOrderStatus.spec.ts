import {
  canTransition,
  isTerminalStatus,
  WORK_ORDER_FILTER_ORDER,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TRANSITIONS,
  type WorkOrderStatus,
} from "owlagents/domain/workOrderStatus";

const byName = (a: string, b: string): number => a.localeCompare(b);

describe("work order state machine", () => {
  const legalCases: [WorkOrderStatus, WorkOrderStatus][] = [
    ["draft", "policy_pending"],
    ["policy_pending", "approved"],
    ["policy_pending", "queued"],
    ["policy_pending", "approval_required"],
    ["policy_pending", "rejected"],
    ["approval_required", "queued"],
    ["approval_required", "rejected"],
    ["approved", "queued"],
    ["queued", "running"],
    ["running", "blocked"],
    ["running", "cancel_requested"],
    ["running", "artifact_ready"],
    ["artifact_ready", "review_pending"],
    ["cancel_requested", "cancelled"],
    ["review_pending", "completed"],
    ["review_pending", "revision_required"],
    ["revision_required", "queued"],
    ["blocked", "queued"],
    ["blocked", "cancel_requested"],
    ["rejected", "draft"],
  ];

  test.each(legalCases)("allows %p to %p", (from, to) =>
    expect(canTransition(from, to)).toBe(true)
  );

  const illegalCases: [WorkOrderStatus, WorkOrderStatus][] = [
    ["draft", "completed"],
    ["draft", "running"],
    ["review_pending", "running"],
    ["cancelled", "running"],
    ["completed", "running"],
    ["completed", "draft"],
    ["blocked", "running"],
    ["queued", "completed"],
    ["approval_required", "running"],
    ["policy_pending", "running"],
    ["cancelled", "draft"],
    ["running", "completed"],
  ];

  test.each(illegalCases)("refuses %p to %p", (from, to) =>
    expect(canTransition(from, to)).toBe(false)
  );

  test("a status may never transition to itself", () =>
    WORK_ORDER_STATUSES.forEach((status) =>
      expect(canTransition(status, status)).toBe(false)
    ));

  test("every transition target is a known status", () =>
    Object.values(WORK_ORDER_TRANSITIONS).forEach((edges) =>
      edges.forEach((edge) => expect(WORK_ORDER_STATUSES).toContain(edge.to))
    ));

  const terminalCases: [WorkOrderStatus, boolean][] = [
    ["cancelled", true],
    ["completed", true],
    ["rejected", false],
    ["blocked", false],
    ["draft", false],
  ];

  test.each(terminalCases)("terminality of %p is %p", (status, expected) =>
    expect(isTerminalStatus(status)).toBe(expected)
  );

  test("the revision cycle returns to queued rather than running directly", () => {
    expect(canTransition("review_pending", "revision_required")).toBe(true);
    expect(canTransition("revision_required", "running")).toBe(false);
    expect(canTransition("revision_required", "queued")).toBe(true);
  });

  test("cancellation is a two-step acknowledgement, never immediate", () => {
    expect(canTransition("running", "cancelled")).toBe(false);
    expect(canTransition("running", "cancel_requested")).toBe(true);
    expect(canTransition("cancel_requested", "cancelled")).toBe(true);
  });

  test("every status has an operator-facing label", () =>
    WORK_ORDER_STATUSES.forEach((status) =>
      expect(WORK_ORDER_STATUS_LABELS[status]).toBeTruthy()
    ));

  test("no work order can hide from every filter", () => {
    expect([...WORK_ORDER_FILTER_ORDER].sort(byName)).toStrictEqual(
      [...WORK_ORDER_STATUSES].sort(byName)
    );
  });
});
