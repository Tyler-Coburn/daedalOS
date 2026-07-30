import { ID_PATTERNS, type IdKind } from "owlagents/domain/ids";
import { type OwlAgentsAppId } from "owlagents/registry";

export type DeepLinkObjectType =
  | "artifact"
  | "memory"
  | "project"
  | "review"
  | "source"
  | "workOrder";

type DeepLinkTarget = {
  appId: OwlAgentsAppId;
  objectId: string;
  objectType: DeepLinkObjectType;
  pathname: string;
};

type DeepLinkRoute = {
  appId: OwlAgentsAppId;
  idKind: IdKind;
  objectType: DeepLinkObjectType;
  segment: string;
};

/**
 * Route -> intent -> registry lookup -> openProcess.
 *
 * A route is an entry point and a history mechanism. It never replaces the
 * desktop, and it never closes a window: opening a singleton re-targets the
 * process that is already there.
 */
export const DEEP_LINK_ROUTES: readonly DeepLinkRoute[] = [
  {
    appId: "ArtifactViewer",
    idKind: "artifact",
    objectType: "artifact",
    segment: "artifacts",
  },
  {
    appId: "WovensteadStaging",
    idKind: "memoryCandidate",
    objectType: "memory",
    segment: "memory",
  },
  {
    appId: "Projects",
    idKind: "project",
    objectType: "project",
    segment: "projects",
  },
  {
    appId: "ReviewQueue",
    idKind: "review",
    objectType: "review",
    segment: "reviews",
  },
  {
    appId: "SourcesFiles",
    idKind: "source",
    objectType: "source",
    segment: "sources",
  },
  {
    appId: "WorkOrders",
    idKind: "workOrder",
    objectType: "workOrder",
    segment: "work-orders",
  },
];

/**
 * Total and pure: anything that is not a recognised route with a well-formed id
 * returns undefined, and the caller opens Mission Control with a visible error
 * rather than 404-ing the desktop.
 */
export const resolveDeepLink = (
  pathname: string
): DeepLinkTarget | undefined => {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 2) return undefined;

  const [segment = "", objectId = ""] = segments;
  const route = DEEP_LINK_ROUTES.find(
    (candidate) => candidate.segment === segment.toLowerCase()
  );

  if (!route || !ID_PATTERNS[route.idKind].test(objectId)) return undefined;

  return {
    appId: route.appId,
    objectId,
    objectType: route.objectType,
    pathname: `/${route.segment}/${objectId}`,
  };
};

export const buildDeepLink = (
  objectType: DeepLinkObjectType,
  objectId: string
): string => {
  const route = DEEP_LINK_ROUTES.find(
    (candidate) => candidate.objectType === objectType
  );

  return route ? `/${route.segment}/${objectId}` : "/";
};
