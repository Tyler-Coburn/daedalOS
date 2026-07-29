import {
  explainStaleness,
  isDecidableReviewState,
  REVIEW_DECISION_RESULT,
  REVIEW_DECISIONS,
  reviewStaleness,
  type ReviewState,
  type StalenessReason,
} from "owlagents/domain/reviewDecision";

const EXPECTED = {
  expectedArtifactHash: "abc123",
  expectedArtifactVersion: 2,
  expectedVersion: 1,
};

const OBSERVED = {
  artifactHash: "abc123",
  artifactVersion: 2,
  version: 1,
};

describe("review staleness", () => {
  test("a review whose artifact has not moved is current", () =>
    expect(reviewStaleness(EXPECTED, OBSERVED)).toStrictEqual({
      isStale: false,
      reasons: [],
    }));

  const staleCases: [string, Partial<typeof OBSERVED>, StalenessReason][] = [
    [
      "the artifact content changed",
      { artifactHash: "def456" },
      "artifact_hash_changed",
    ],
    [
      "a newer artifact version exists",
      { artifactVersion: 3 },
      "artifact_version_changed",
    ],
    [
      "the review was updated elsewhere",
      { version: 2 },
      "review_version_changed",
    ],
  ];

  test.each(staleCases)("is stale when %s", (_label, override, reason) => {
    const staleness = reviewStaleness(EXPECTED, { ...OBSERVED, ...override });

    expect(staleness.isStale).toBe(true);
    expect(staleness.reasons).toContain(reason);
  });

  test("reports every reason at once so the operator sees the whole story", () => {
    const staleness = reviewStaleness(EXPECTED, {
      artifactHash: "def456",
      artifactVersion: 9,
      version: 4,
    });

    expect(staleness.reasons).toHaveLength(3);
    expect(explainStaleness(staleness)).toHaveLength(3);
  });

  test("every staleness reason carries a human explanation", () =>
    explainStaleness(
      reviewStaleness(EXPECTED, { ...OBSERVED, artifactHash: "def456" })
    ).forEach((explanation) => expect(explanation.length).toBeGreaterThan(20)));
});

describe("review decisions", () => {
  const decidableCases: [ReviewState, boolean][] = [
    ["pending", true],
    ["deferred", true],
    ["approved", false],
    ["rejected", false],
    ["revision_requested", false],
    ["stale", false],
  ];

  test.each(decidableCases)("%p decidable: %p", (state, expected) =>
    expect(isDecidableReviewState(state)).toBe(expected)
  );

  test("a stale review can never be decided", () =>
    expect(isDecidableReviewState("stale")).toBe(false));

  test("every decision maps to exactly one resulting state", () =>
    REVIEW_DECISIONS.forEach((decision) =>
      expect(REVIEW_DECISION_RESULT[decision]).toBeTruthy()
    ));
});
