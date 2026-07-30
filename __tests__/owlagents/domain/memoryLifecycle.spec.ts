import {
  canPromoteMemory,
  isOperatorOnlyMemoryTransition,
  MEMORY_STATE_LABELS,
  MEMORY_STATES,
  PUBLICATION_PRECONDITIONS,
  type MemoryState,
} from "owlagents/domain/memoryLifecycle";

describe("wovenstead memory lifecycle", () => {
  test("the only path to canonical is candidate, approved, staged, published", () => {
    expect(canPromoteMemory("candidate", "approved")).toBe(true);
    expect(canPromoteMemory("approved", "staged")).toBe(true);
    expect(canPromoteMemory("staged", "published")).toBe(true);
  });

  const refusedCases: [MemoryState, MemoryState][] = [
    ["candidate", "staged"],
    ["candidate", "published"],
    ["approved", "published"],
    ["rejected", "staged"],
    ["rejected", "approved"],
    ["rejected", "published"],
    ["published", "staged"],
    ["superseded", "published"],
    ["staged", "approved"],
  ];

  test.each(refusedCases)("refuses %p to %p", (from, to) =>
    expect(canPromoteMemory(from, to)).toBe(false)
  );

  test("a published record is superseded, never overwritten", () => {
    expect(canPromoteMemory("published", "superseded")).toBe(true);
    expect(canPromoteMemory("superseded", "candidate")).toBe(false);
  });

  test("approve, stage and publish are all operator-only", () => {
    expect(isOperatorOnlyMemoryTransition("candidate", "approved")).toBe(true);
    expect(isOperatorOnlyMemoryTransition("approved", "staged")).toBe(true);
    expect(isOperatorOnlyMemoryTransition("staged", "published")).toBe(true);
  });

  test("a conflict is raised by the system, not by an operator click", () =>
    expect(isOperatorOnlyMemoryTransition("candidate", "conflict")).toBe(
      false
    ));

  test("every state has an operator-facing label", () =>
    MEMORY_STATES.forEach((state) =>
      expect(MEMORY_STATE_LABELS[state]).toBeTruthy()
    ));

  test("the publication gate is stated so a refusal can be explained", () =>
    expect(PUBLICATION_PRECONDITIONS.length).toBeGreaterThanOrEqual(6));
});
