import { useCallback } from "react";
import useOwlSelector, {
  shallowArrayEqual,
} from "components/apps/OwlAgents/hooks/useOwlSelector";
import { useOwlAgentsContext } from "contexts/owlagents";
import { type EnvironmentAuthority } from "owlagents/domain/authority";
import { type MemoryTransition } from "owlagents/domain/memoryLifecycle";
import { type ReviewStaleness } from "owlagents/domain/reviewDecision";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import {
  type Agent,
  type Artifact,
  type AttentionItem,
  type ContextPack,
  type EvidenceItem,
  type Incident,
  type Integration,
  type LedgerEvent,
  type MemoryCandidate,
  type ModelProvider,
  type PolicyDecision,
  type PolicyRule,
  type Project,
  type Review,
  type ServiceHealth,
  type Source,
  type WorkOrder,
  type WovensteadRecord,
} from "owlagents/domain/types";
import { type WorkOrderTransition } from "owlagents/domain/workOrderStatus";
import {
  selectAgents,
  selectArtifact,
  selectArtifacts,
  selectAuthority,
  selectContextPack,
  selectEvidenceItems,
  selectIncidents,
  selectIntegrations,
  selectModelProviders,
  selectPolicyDecision,
  selectPolicyRules,
  selectProject,
  selectProjects,
  selectServices,
  selectSource,
  selectSources,
} from "owlagents/selectors/catalog";
import { selectLedger, type LedgerQuery } from "owlagents/selectors/ledger";
import {
  selectAllowedMemoryTransitions,
  selectExistingRecord,
  selectMemoryCandidate,
  selectMemoryCandidateList,
  selectMemoryCounts,
  selectPublicationGate,
  type MemoryFilter,
} from "owlagents/selectors/memory";
import {
  deriveAttentionItems,
  selectActiveWork,
  selectBriefing,
  selectMissionControlStats,
  selectProjectPulse,
  type ActiveWorkRow,
  type BriefingLine,
  type MissionControlStat,
  type ProjectPulse,
} from "owlagents/selectors/missionControl";
import {
  selectCanDecideReview,
  selectReview,
  selectReviewList,
  selectReviewStaleness,
  selectReviewsForWorkOrder,
  type ReviewFilter,
} from "owlagents/selectors/reviews";
import {
  selectAllowedTransitions,
  selectWorkOrder,
  selectWorkOrderCounts,
  selectWorkOrderList,
  type WorkOrderFilter,
} from "owlagents/selectors/workOrders";
import { type OwlAgentsServices } from "owlagents/services/types";

/** Services never change identity, so a dep array naming them never lies. */
export const useOwlServices = (): OwlAgentsServices =>
  useOwlAgentsContext().services;

export const useAuthority = (): EnvironmentAuthority =>
  useOwlSelector(selectAuthority);

export const useWorkOrder = (id: string): WorkOrder | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectWorkOrder(id)(s), [id])
  );

export const useWorkOrderList = (
  filter: WorkOrderFilter
): readonly WorkOrder[] =>
  useOwlSelector(
    useCallback(
      (s: OwlAgentsSnapshot) => selectWorkOrderList(filter)(s),
      [filter]
    ),
    shallowArrayEqual
  );

export const useWorkOrderCounts = (): ReturnType<
  typeof selectWorkOrderCounts
> => useOwlSelector(selectWorkOrderCounts);

export const useAllowedTransitions = (
  id: string
): readonly WorkOrderTransition[] =>
  useOwlSelector(
    useCallback(
      (s: OwlAgentsSnapshot) => selectAllowedTransitions(id)(s),
      [id]
    ),
    shallowArrayEqual
  );

export const useReview = (id: string): Review | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectReview(id)(s), [id])
  );

export const useReviewList = (filter: ReviewFilter): readonly Review[] =>
  useOwlSelector(
    useCallback(
      (s: OwlAgentsSnapshot) => selectReviewList(filter)(s),
      [filter]
    ),
    shallowArrayEqual
  );

export const useReviewStaleness = (id: string): ReviewStaleness =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectReviewStaleness(id)(s), [id])
  );

export const useCanDecideReview = (id: string): boolean =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectCanDecideReview(id)(s), [id])
  );

export const useReviewsForWorkOrder = (id: string): readonly Review[] =>
  useOwlSelector(
    useCallback(
      (s: OwlAgentsSnapshot) => selectReviewsForWorkOrder(id)(s),
      [id]
    ),
    shallowArrayEqual
  );

export const useMemoryCandidate = (id: string): MemoryCandidate | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectMemoryCandidate(id)(s), [id])
  );

export const useMemoryCandidateList = (
  filter: MemoryFilter
): readonly MemoryCandidate[] =>
  useOwlSelector(
    useCallback(
      (s: OwlAgentsSnapshot) => selectMemoryCandidateList(filter)(s),
      [filter]
    ),
    shallowArrayEqual
  );

export const useMemoryCounts = (): ReturnType<typeof selectMemoryCounts> =>
  useOwlSelector(selectMemoryCounts);

export const useExistingRecord = (id: string): WovensteadRecord | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectExistingRecord(id)(s), [id])
  );

export const useAllowedMemoryTransitions = (
  id: string
): readonly MemoryTransition[] =>
  useOwlSelector(
    useCallback(
      (s: OwlAgentsSnapshot) => selectAllowedMemoryTransitions(id)(s),
      [id]
    ),
    shallowArrayEqual
  );

export const usePublicationGate = (
  id: string
): { canPublish: boolean; reason: string } =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectPublicationGate(id)(s), [id])
  );

export const useLedger = (query: LedgerQuery): readonly LedgerEvent[] =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectLedger(query)(s), [query]),
    shallowArrayEqual
  );

export const useAttentionItems = (): readonly AttentionItem[] =>
  useOwlSelector(deriveAttentionItems, shallowArrayEqual);

export const useMissionControlStats = (): readonly MissionControlStat[] =>
  useOwlSelector(selectMissionControlStats, shallowArrayEqual);

export const useBriefing = (): readonly BriefingLine[] =>
  useOwlSelector(selectBriefing, shallowArrayEqual);

export const useProjectPulse = (): readonly ProjectPulse[] =>
  useOwlSelector(selectProjectPulse, shallowArrayEqual);

export const useActiveWork = (): readonly ActiveWorkRow[] =>
  useOwlSelector(selectActiveWork, shallowArrayEqual);

export const useProject = (id: string): Project | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectProject(id)(s), [id])
  );

export const useProjects = (): readonly Project[] =>
  useOwlSelector(selectProjects, shallowArrayEqual);

export const useSource = (id: string): Source | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectSource(id)(s), [id])
  );

export const useSources = (): readonly Source[] =>
  useOwlSelector(selectSources, shallowArrayEqual);

export const useArtifact = (id: string): Artifact | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectArtifact(id)(s), [id])
  );

export const useArtifacts = (): readonly Artifact[] =>
  useOwlSelector(selectArtifacts, shallowArrayEqual);

export const useEvidence = (ids: readonly string[]): readonly EvidenceItem[] =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectEvidenceItems(ids)(s), [ids]),
    shallowArrayEqual
  );

export const useContextPack = (
  id: string | undefined
): ContextPack | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectContextPack(id)(s), [id])
  );

export const usePolicyDecision = (
  id: string | undefined
): PolicyDecision | undefined =>
  useOwlSelector(
    useCallback((s: OwlAgentsSnapshot) => selectPolicyDecision(id)(s), [id])
  );

export const usePolicyRules = (): readonly PolicyRule[] =>
  useOwlSelector(selectPolicyRules, shallowArrayEqual);

export const useAgents = (): readonly Agent[] =>
  useOwlSelector(selectAgents, shallowArrayEqual);

export const useServices = (): readonly ServiceHealth[] =>
  useOwlSelector(selectServices, shallowArrayEqual);

export const useIncidents = (): readonly Incident[] =>
  useOwlSelector(selectIncidents, shallowArrayEqual);

export const useModelProviders = (): readonly ModelProvider[] =>
  useOwlSelector(selectModelProviders, shallowArrayEqual);

export const useIntegrations = (): readonly Integration[] =>
  useOwlSelector(selectIntegrations, shallowArrayEqual);
