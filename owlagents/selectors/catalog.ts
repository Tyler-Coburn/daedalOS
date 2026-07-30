import {
  isHealthyIntegrationState,
  type EnvironmentAuthority,
} from "owlagents/domain/authority";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import {
  type Agent,
  type Artifact,
  type ContextPack,
  type EvidenceItem,
  type Incident,
  type Integration,
  type ModelProvider,
  type PolicyDecision,
  type PolicyRule,
  type Project,
  type ServiceHealth,
  type Source,
} from "owlagents/domain/types";

export const selectProject =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): Project | undefined =>
    snapshot.projects[id];

export const selectProjects = (
  snapshot: OwlAgentsSnapshot
): readonly Project[] =>
  Object.values(snapshot.projects).sort((a, b) => a.id.localeCompare(b.id));

export const selectSource =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): Source | undefined =>
    snapshot.sources[id];

export const selectSources = (snapshot: OwlAgentsSnapshot): readonly Source[] =>
  Object.values(snapshot.sources).sort((a, b) => a.id.localeCompare(b.id));

export const selectArtifact =
  (id: string) =>
  (snapshot: OwlAgentsSnapshot): Artifact | undefined =>
    snapshot.artifacts[id];

export const selectEvidenceItems =
  (ids: readonly string[]) =>
  (snapshot: OwlAgentsSnapshot): readonly EvidenceItem[] =>
    ids.flatMap((id) => {
      const item = snapshot.evidence[id];

      return item ? [item] : [];
    });

export const selectContextPack =
  (id: string | undefined) =>
  (snapshot: OwlAgentsSnapshot): ContextPack | undefined =>
    id ? snapshot.contextPacks[id] : undefined;

export const selectPolicyDecision =
  (id: string | undefined) =>
  (snapshot: OwlAgentsSnapshot): PolicyDecision | undefined =>
    id ? snapshot.policyDecisions[id] : undefined;

export const selectPolicyRules = (
  snapshot: OwlAgentsSnapshot
): readonly PolicyRule[] =>
  Object.values(snapshot.policyRules).sort((a, b) => a.id.localeCompare(b.id));

export const selectAgents = (snapshot: OwlAgentsSnapshot): readonly Agent[] =>
  Object.values(snapshot.agents).sort((a, b) => a.id.localeCompare(b.id));

export const selectServices = (
  snapshot: OwlAgentsSnapshot
): readonly ServiceHealth[] => snapshot.services;

export const selectIncidents = (
  snapshot: OwlAgentsSnapshot
): readonly Incident[] => snapshot.incidents;

export const selectModelProviders = (
  snapshot: OwlAgentsSnapshot
): readonly ModelProvider[] => snapshot.modelProviders;

export const selectIntegrations = (
  snapshot: OwlAgentsSnapshot
): readonly Integration[] =>
  Object.values(snapshot.integrations).sort((a, b) => a.id.localeCompare(b.id));

/**
 * The one environment value.
 *
 * The tray, Mission Control, System Health, Integrations and every application
 * header read this. They cannot disagree because there is nothing else to read.
 */
export const selectAuthority = (
  snapshot: OwlAgentsSnapshot
): EnvironmentAuthority => snapshot.environment;

/**
 * System Health and Integrations must agree. Both count "not connected" the
 * same way, from the same snapshot, using the same predicate.
 */
export const selectDegradedCount = (snapshot: OwlAgentsSnapshot): number =>
  snapshot.services.filter(
    (service) => !isHealthyIntegrationState(service.state)
  ).length +
  Object.values(snapshot.integrations).filter(
    (integration) => !isHealthyIntegrationState(integration.state)
  ).length;
