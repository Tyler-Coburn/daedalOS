/**
 * Stable identifier contracts for every OwlAgents domain object.
 *
 * Ids are the only thing that links objects across applications. A work order,
 * the review of its artifact and the memory candidate derived from it all refer
 * to each other by id — never by copying the object into another fixture.
 */

declare const idBrand: unique symbol;

/**
 * A documented string. The brand is optional, so a literal like
 * `"WO-2026-0051"` still assigns cleanly, but a `ReviewId` never reads as
 * interchangeable with a `WorkOrderId` at a glance.
 */
type Branded<TName extends string> = string & {
  readonly [idBrand]?: TName;
};

export type ArtifactId = Branded<"ArtifactId">;
export type ContextPackId = Branded<"ContextPackId">;
export type EvidenceId = Branded<"EvidenceId">;
export type IncidentId = Branded<"IncidentId">;
export type IntegrationId = Branded<"IntegrationId">;
export type IsoTimestamp = Branded<"IsoTimestamp">;
export type LedgerEventId = Branded<"LedgerEventId">;
export type MemoryCandidateId = Branded<"MemoryCandidateId">;
export type PolicyDecisionId = Branded<"PolicyDecisionId">;
export type PolicyRuleId = Branded<"PolicyRuleId">;
export type ProjectId = Branded<"ProjectId">;
export type ReviewId = Branded<"ReviewId">;
export type RunId = Branded<"RunId">;
export type SourceId = Branded<"SourceId">;
export type WorkOrderId = Branded<"WorkOrderId">;
export type WovensteadRecordId = Branded<"WovensteadRecordId">;

export const ID_PATTERNS = {
  artifact: /^ART-\d{4}$/,
  contextPack: /^PACK-\d{4}$/,
  evidence: /^EV-\d{4}$/,
  incident: /^INC-\d{4}$/,
  integration: /^INT-\d{3}$/,
  ledgerEvent: /^EVT-\d{6}$/,
  memoryCandidate: /^MC-\d{4}$/,
  policyDecision: /^PD-\d{4}$/,
  policyRule: /^POL-\d{3}$/,
  project: /^PRJ-\d{3}$/,
  review: /^REV-\d{4}-\d{4}$/,
  run: /^RUN-\d{4}$/,
  source: /^SRC-\d{4}$/,
  workOrder: /^WO-\d{4}-\d{4}$/,
  wovensteadRecord: /^WSR-\d{4}$/,
} as const;

export type IdKind = keyof typeof ID_PATTERNS;

export const isId = (kind: IdKind, value: string): boolean =>
  ID_PATTERNS[kind].test(value);
