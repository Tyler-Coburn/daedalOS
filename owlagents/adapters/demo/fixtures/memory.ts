import {
  type MemoryCandidate,
  type WovensteadRecord,
} from "owlagents/domain/types";

/**
 * DEMO FIXTURE — memory candidates at every stage of the lifecycle, so the
 * publication gate can be demonstrated rather than described.
 *
 * `MC-0036` is the vertical slice: candidate -> approved -> staged -> published,
 * all four steps operator-driven. `MC-0033` is already approved (stageable),
 * `MC-0032` carries a live conflict, `MC-0034` is published.
 */
export const DEMO_MEMORY_CANDIDATES: Readonly<Record<string, MemoryCandidate>> =
  {
    "MC-0031": {
      comparison:
        "No existing record for supplier selection under Homestead Ledger / procurement.",
      conflicts: [],
      draftContent:
        "Supplier B selected for cedar stock. Claims verified against 4 sources; the lead-time conflict resolves to 6 weeks (newer, verified). Risk: lead-time variance ±2 weeks.",
      id: "MC-0031",
      projectId: "PRJ-005",
      sourceArtifactIds: ["ART-0034"],
      sourceWorkOrderId: "WO-2026-0045",
      status: "candidate",
      title: "Supplier decision — Homestead Ledger",
      version: 1,
    },
    "MC-0032": {
      comparison:
        "An existing note from 2025-11 describes immediate-reconnect behaviour and would be superseded.",
      conflicts: [
        'Conflicts with existing record "Argus stream behaviour v1" — publication will mark it superseded.',
      ],
      draftContent:
        "Reconnect uses exponential backoff with event buffering. The buffer is bounded at 10k events; overflow surfaces as a blocked state, never a silent drop.",
      existingRecordId: "WSR-0002",
      id: "MC-0032",
      projectId: "PRJ-007",
      sourceArtifactIds: ["ART-0032"],
      sourceWorkOrderId: "WO-2026-0047",
      status: "candidate",
      title: "Event-stream reconnect design note",
      version: 1,
    },
    "MC-0033": {
      approvedAt: "2026-07-28T11:30:00.000Z",
      comparison:
        "Wovenstead holds rubric v1 (5 fields). This candidate adds corroboration.",
      conflicts: [],
      draftContent:
        "Rubric fields: provenance, recency, authority, corroboration, completeness, bias. Each is scored A–D with a required evidence link.",
      existingRecordId: "WSR-0003",
      id: "MC-0033",
      projectId: "PRJ-002",
      sourceArtifactIds: ["ART-0030"],
      sourceWorkOrderId: "WO-2026-0048",
      status: "approved",
      title: "Source-quality rubric — six fields",
      version: 2,
    },
    "MC-0034": {
      approvedAt: "2026-07-27T16:45:00.000Z",
      comparison: "This is now the canonical record.",
      conflicts: [],
      draftContent:
        "Canonical map of local mounts: olympus (ro), workspace (rw), vault (ro).",
      existingRecordId: "WSR-0001",
      id: "MC-0034",
      projectId: "PRJ-008",
      publishedAt: "2026-07-27T10:02:00.000Z",
      publishedBy: "operator",
      sourceArtifactIds: ["ART-0036"],
      sourceWorkOrderId: "WO-2026-0040",
      stagedAt: "2026-07-27T16:50:00.000Z",
      status: "published",
      title: "Workspace mount map",
      version: 3,
    },
    "MC-0035": {
      comparison: "No related record.",
      conflicts: [],
      draftContent:
        "PolicyGate / ScopeGate split with a typed context. Pending: the failing tests must pass before this note is trustworthy.",
      id: "MC-0035",
      projectId: "PRJ-006",
      sourceArtifactIds: ["ART-0038"],
      sourceWorkOrderId: "WO-2026-0050",
      status: "candidate",
      title: "Policy adapter interface sketch",
      version: 1,
    },
    "MC-0036": {
      comparison: "No related record for EU battery directive applicability.",
      conflicts: [],
      draftContent:
        "EU battery directive 2026/0142 applies to portable batteries placed on the EU market from 2027-01-01. Rubric: provenance A, recency A, authority A, corroboration B. Annex III thresholds are referenced but not yet cross-checked.",
      id: "MC-0036",
      projectId: "PRJ-001",
      sourceArtifactIds: ["ART-0031"],
      sourceWorkOrderId: "WO-2026-0051",
      status: "candidate",
      title: "EU directive applicability summary",
      version: 1,
    },
  };

/** DEMO FIXTURE — the canonical Wovenstead records a publication compares against. */
export const DEMO_WOVENSTEAD_RECORDS: Readonly<
  Record<string, WovensteadRecord>
> = {
  "WSR-0001": {
    authority: "canonical",
    content:
      "Canonical map of local mounts: olympus (ro), workspace (rw), vault (ro).",
    hash: "aa1077bc03e2915f68d4b0a72cc3e185",
    id: "WSR-0001",
    projectId: "PRJ-008",
    provenance: {
      artifactId: "ART-0036",
      candidateId: "MC-0034",
      evidenceIds: [],
      sourceIds: [],
      workOrderId: "WO-2026-0040",
    },
    publishedAt: "2026-07-27T10:02:00.000Z",
    publishedBy: "operator",
    title: "Workspace mount map",
    version: 1,
  },
  "WSR-0002": {
    authority: "canonical",
    content:
      "Argus stream behaviour v1: on error the socket closes and reconnects immediately. Events in flight are lost.",
    hash: "3c5a9014bb02e7d6610ff84a27de0b31",
    id: "WSR-0002",
    projectId: "PRJ-007",
    provenance: { evidenceIds: [], sourceIds: ["SRC-0145"] },
    publishedAt: "2025-11-14T09:30:00.000Z",
    publishedBy: "operator",
    title: "Argus stream behaviour v1",
    version: 1,
  },
  "WSR-0003": {
    authority: "canonical",
    content:
      "Source-quality rubric v1: provenance, recency, authority, completeness, bias. Each scored A–D.",
    hash: "19df62aa07c1e4b58810ff2c34be0d97",
    id: "WSR-0003",
    projectId: "PRJ-002",
    provenance: { evidenceIds: [], sourceIds: [] },
    publishedAt: "2026-02-03T14:00:00.000Z",
    publishedBy: "operator",
    title: "Source-quality rubric v1",
    version: 1,
  },
};
