import { listDemoDeepLinkPaths } from "owlagents/adapters/demo/fixtures";
import {
  buildDeepLink,
  DEEP_LINK_ROUTES,
  resolveDeepLink,
  type DeepLinkObjectType,
} from "owlagents/deepLinks";

describe("resolveDeepLink", () => {
  const hits: [string, string, string][] = [
    ["/projects/PRJ-001", "Projects", "PRJ-001"],
    ["/work-orders/WO-2026-0051", "WorkOrders", "WO-2026-0051"],
    ["/reviews/REV-2026-0184", "ReviewQueue", "REV-2026-0184"],
    ["/artifacts/ART-0031", "ArtifactViewer", "ART-0031"],
    ["/sources/SRC-0142", "SourcesFiles", "SRC-0142"],
    ["/memory/MC-0031", "WovensteadStaging", "MC-0031"],
  ];

  test.each(hits)("%p opens %p on %p", (pathname, appId, objectId) => {
    const target = resolveDeepLink(pathname);

    expect(target?.appId).toBe(appId);
    expect(target?.objectId).toBe(objectId);
  });

  test("tolerates a trailing slash and mixed-case segments", () => {
    expect(resolveDeepLink("/work-orders/WO-2026-0051/")?.appId).toBe(
      "WorkOrders"
    );
    expect(resolveDeepLink("/Work-Orders/WO-2026-0051")?.appId).toBe(
      "WorkOrders"
    );
  });

  const misses: [string, string][] = [
    ["the root", "/"],
    ["an unknown segment", "/widgets/W-0001"],
    ["a malformed id", "/work-orders/nonsense"],
    ["an id from the wrong family", "/work-orders/REV-2026-0184"],
    ["a missing id", "/work-orders"],
    ["too many segments", "/work-orders/WO-2026-0051/extra"],
    ["an empty path", ""],
  ];

  test.each(misses)("returns undefined for %s", (_label, pathname) =>
    expect(resolveDeepLink(pathname)).toBeUndefined()
  );

  test("an id is never accepted for the wrong route", () =>
    DEEP_LINK_ROUTES.forEach((route) =>
      expect(
        resolveDeepLink(`/${route.segment}/PRJ-001`)?.appId === "Projects" &&
          route.segment !== "projects"
      ).toBe(false)
    ));
});

describe("buildDeepLink", () => {
  const types: DeepLinkObjectType[] = [
    "artifact",
    "memory",
    "project",
    "review",
    "source",
    "workOrder",
  ];

  test.each(types)("round-trips %p", (objectType) => {
    const id =
      objectType === "artifact"
        ? "ART-0031"
        : objectType === "memory"
          ? "MC-0031"
          : objectType === "project"
            ? "PRJ-001"
            : objectType === "review"
              ? "REV-2026-0184"
              : objectType === "source"
                ? "SRC-0142"
                : "WO-2026-0051";
    const target = resolveDeepLink(buildDeepLink(objectType, id));

    expect(target?.objectType).toBe(objectType);
    expect(target?.objectId).toBe(id);
  });
});

describe("the static export pre-renders every known object", () => {
  const paths = listDemoDeepLinkPaths();

  test("every enumerated path resolves", () =>
    expect(
      paths.filter((pathname) => !resolveDeepLink(pathname))
    ).toStrictEqual([]));

  test("the vertical slice is reachable by link", () =>
    [
      "/projects/PRJ-001",
      "/sources/SRC-0142",
      "/work-orders/WO-2026-0051",
      "/artifacts/ART-0031",
      "/reviews/REV-2026-0186",
      "/memory/MC-0036",
    ].forEach((pathname) => expect(paths).toContain(pathname)));

  test("the documented canonical ids are all pre-rendered", () =>
    [
      "/projects/PRJ-001",
      "/work-orders/WO-2026-0051",
      "/reviews/REV-2026-0184",
      "/artifacts/ART-0031",
      "/sources/SRC-0142",
      "/memory/MC-0031",
    ].forEach((pathname) => expect(paths).toContain(pathname)));

  test("paths are unique", () =>
    expect(new Set(paths).size).toBe(paths.length));
});
