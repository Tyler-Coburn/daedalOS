import {
  isDecidableReviewState,
  reviewStaleness,
  type ReviewState,
  type ReviewStaleness,
} from "owlagents/domain/reviewDecision";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { type Review } from "owlagents/domain/types";

export type ReviewFilter = ReviewState | "all" | "open";

const byRequestedDescending = (a: Review, b: Review): number =>
  b.requestedAt.localeCompare(a.requestedAt);

export const selectReview =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): Review | undefined =>
    snapshot.reviews[id];

export const selectReviewList =
  (filter: ReviewFilter) =>
  (snapshot: OwlAgentsSnapshot): readonly Review[] =>
    Object.values(snapshot.reviews)
      .filter((review) => {
        if (filter === "all") return true;
        if (filter === "open") return isDecidableReviewState(review.status);

        return review.status === filter;
      })
      .sort(byRequestedDescending);

/**
 * Compares what the review pinned against the artifact as it stands now.
 *
 * This is what disables Approve: a review is a decision about a specific
 * version of a specific artifact, so if the artifact moved, the decision is no
 * longer the one the operator was asked to make.
 */
export const selectReviewStaleness =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): ReviewStaleness => {
    const review = snapshot.reviews[id];

    if (!review) return { isStale: false, reasons: [] };

    const artifact = snapshot.artifacts[review.artifactIds[0] ?? ""];

    return reviewStaleness(
      {
        expectedArtifactHash: review.expectedArtifactHash,
        expectedArtifactVersion: review.expectedArtifactVersion,
        expectedVersion: review.expectedVersion,
      },
      {
        artifactHash: artifact?.hash ?? "",
        artifactVersion: artifact?.version ?? 0,
        version: review.version,
      }
    );
  };

export const selectCanDecideReview =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): boolean => {
    const review = snapshot.reviews[id];

    if (!review || !isDecidableReviewState(review.status)) return false;

    return !selectReviewStaleness(id)(snapshot).isStale;
  };

export const selectPendingReviews = (
  snapshot: OwlAgentsSnapshot
): readonly Review[] =>
  Object.values(snapshot.reviews)
    .filter((review) => review.status === "pending")
    .sort(byRequestedDescending);

export const selectReviewsForWorkOrder =
  (workOrderId: string) =>
  (snapshot: OwlAgentsSnapshot): readonly Review[] =>
    Object.values(snapshot.reviews)
      .filter((review) => review.workOrderId === workOrderId)
      .sort(byRequestedDescending);
