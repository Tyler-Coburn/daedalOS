import { type MemoryState } from "owlagents/domain/memoryLifecycle";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import {
  type MemoryCandidate,
  type WovensteadRecord,
} from "owlagents/domain/types";

export type MemoryFilter = MemoryState | "all";

export const selectMemoryCandidate =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): MemoryCandidate | undefined =>
    snapshot.memoryCandidates[id];

export const selectMemoryCandidateList =
  (filter: MemoryFilter) =>
  (snapshot: OwlAgentsSnapshot): readonly MemoryCandidate[] =>
    Object.values(snapshot.memoryCandidates)
      .filter((candidate) => filter === "all" || candidate.status === filter)
      .sort((a, b) => a.id.localeCompare(b.id));

/** The record a candidate would supersede, so the comparison is honest. */
export const selectExistingRecord =
  (candidateId: string) =>
  (snapshot: OwlAgentsSnapshot): WovensteadRecord | undefined => {
    const candidate = snapshot.memoryCandidates[candidateId];

    if (!candidate?.existingRecordId) return undefined;

    return snapshot.wovensteadRecords[candidate.existingRecordId];
  };

/**
 * Publication is gated, and the gate explains itself. Returning the reason
 * rather than a bare boolean is what lets the button say why it is disabled.
 */
export const selectPublicationGate =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): { canPublish: boolean; reason: string } => {
    const candidate = snapshot.memoryCandidates[id];

    if (!candidate) {
      return { canPublish: false, reason: "No candidate is selected." };
    }
    if (candidate.status === "published") {
      return {
        canPublish: false,
        reason: "This candidate is already published.",
      };
    }
    if (candidate.status === "staged") {
      return { canPublish: true, reason: "" };
    }
    if (candidate.status === "approved") {
      return {
        canPublish: false,
        reason: "Approved, but not yet staged. Stage it before publishing.",
      };
    }
    if (candidate.status === "candidate") {
      return {
        canPublish: false,
        reason: "Approve this candidate, then stage it, before publishing.",
      };
    }

    return {
      canPublish: false,
      reason: `A ${candidate.status.replace("_", " ")} candidate cannot be published.`,
    };
  };

export const selectMemoryCounts = (
  snapshot: OwlAgentsSnapshot
): { approved: number; candidates: number; published: number } => {
  const candidates = Object.values(snapshot.memoryCandidates);

  return {
    approved: candidates.filter((candidate) => candidate.status === "approved")
      .length,
    candidates: candidates.filter(
      (candidate) => candidate.status === "candidate"
    ).length,
    published: candidates.filter(
      (candidate) => candidate.status === "published"
    ).length,
  };
};
