import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { resolveDeepLink } from "owlagents/deepLinks";
import {
  appIdsInCategory,
  isOwlAgentsAppId,
  OWLAGENTS_APP_IDS,
  OWLAGENTS_CATEGORY_ORDER,
  OWLAGENTS_REGISTRY,
  type OwlAgentsAppId,
} from "owlagents/registry";

/**
 * `contexts/process/directory.ts` is read as text rather than imported: it pulls
 * in `next/dynamic` and sixteen React components, none of which a domain test
 * should need to evaluate.
 */
const directorySource = readFileSync(
  join("contexts", "process", "directory.ts"),
  "utf8"
);

const byName = (a: string, b: string): number => a.localeCompare(b);

const TASKBAR_AND_TITLEBAR = 60;
const MIN_SUPPORTED = { height: 768, width: 1366 };

describe("the registry is the single owner", () => {
  test("declares exactly sixteen applications", () =>
    expect(OWLAGENTS_APP_IDS).toHaveLength(16));

  test("ids are unique", () =>
    expect(new Set(OWLAGENTS_APP_IDS).size).toBe(OWLAGENTS_APP_IDS.length));

  test("every entry is registered in the process directory", () =>
    OWLAGENTS_APP_IDS.forEach((id) =>
      expect(directorySource).toContain(`  ${id}: {`)
    ));

  test("every entry spreads the registry rather than restating it", () =>
    OWLAGENTS_APP_IDS.forEach((id) =>
      expect(directorySource).toContain(`...OWLAGENTS_REGISTRY.${id}`)
    ));

  test("every entry points at its own component", () =>
    OWLAGENTS_APP_IDS.forEach((id) =>
      expect(directorySource).toContain(`components/apps/OwlAgents/${id}`)
    ));

  test("no command-center id collides with an existing daedalOS process", () => {
    const existing = [
      "Browser",
      "FileExplorer",
      "MonacoEditor",
      "Properties",
      "Run",
      "Terminal",
      "Transfer",
    ];

    existing.forEach((id) => expect(isOwlAgentsAppId(id)).toBe(false));
  });
});

describe("categories drive the Start menu grouping", () => {
  test("every entry has a valid category", () =>
    OWLAGENTS_APP_IDS.forEach((id) =>
      expect(OWLAGENTS_CATEGORY_ORDER).toContain(
        OWLAGENTS_REGISTRY[id].category
      )
    ));

  test("the three groups partition all sixteen applications", () => {
    const grouped = OWLAGENTS_CATEGORY_ORDER.flatMap((category) =>
      appIdsInCategory(category)
    );

    expect(grouped).toHaveLength(16);
    expect(new Set(grouped).size).toBe(16);
  });

  test("the group sizes match the accepted hierarchy", () => {
    expect(appIdsInCategory("primary")).toHaveLength(6);
    expect(appIdsInCategory("diagnostic")).toHaveLength(5);
    expect(appIdsInCategory("advanced")).toHaveLength(5);
  });
});

describe("singleton behaviour is declared, not implied", () => {
  const multiInstance: OwlAgentsAppId[] = [
    "ArtifactViewer",
    "RestrictedTerminal",
    "SourcesFiles",
  ];

  test("exactly three applications open more than one window", () =>
    expect(
      OWLAGENTS_APP_IDS.filter(
        (id) => !OWLAGENTS_REGISTRY[id].singleton
      ).toSorted(byName)
    ).toStrictEqual(multiInstance.toSorted(byName)));

  test("everything else is a singleton", () =>
    OWLAGENTS_APP_IDS.filter((id) => !multiInstance.includes(id)).forEach(
      (id) => expect(OWLAGENTS_REGISTRY[id].singleton).toBe(true)
    ));
});

describe("every application fits the smallest supported display", () => {
  test("no default size exceeds 1366x768 with the taskbar and title bar", () =>
    OWLAGENTS_APP_IDS.forEach((id) => {
      const { defaultSize } = OWLAGENTS_REGISTRY[id];

      expect(defaultSize.width).toBeLessThanOrEqual(MIN_SUPPORTED.width);
      expect(defaultSize.height + TASKBAR_AND_TITLEBAR).toBeLessThanOrEqual(
        MIN_SUPPORTED.height
      );
    }));

  test("no minimum size exceeds its default size", () =>
    OWLAGENTS_APP_IDS.forEach((id) => {
      const { defaultSize, minSize } = OWLAGENTS_REGISTRY[id];

      expect(minSize.width).toBeLessThanOrEqual(defaultSize.width);
      expect(minSize.height).toBeLessThanOrEqual(defaultSize.height);
    }));

  test("the documented per-application minimums are honoured", () => {
    expect(OWLAGENTS_REGISTRY.MissionControl.minSize).toStrictEqual({
      height: 560,
      width: 900,
    });
    expect(OWLAGENTS_REGISTRY.RestrictedTerminal.minSize).toStrictEqual({
      height: 360,
      width: 640,
    });
  });
});

describe("icons resolve to real assets", () => {
  test("every icon exists at both rendered sizes", () =>
    OWLAGENTS_APP_IDS.forEach((id) => {
      const name = OWLAGENTS_REGISTRY[id].icon.split("/").pop() ?? "";

      expect(existsSync(join("public", "System", "Icons", "48x48", name))).toBe(
        true
      );
      expect(existsSync(join("public", "System", "Icons", "16x16", name))).toBe(
        true
      );
    }));
});

describe("deep-link patterns map back to registered applications", () => {
  test("six applications declare a pattern", () =>
    expect(
      OWLAGENTS_APP_IDS.filter((id) => OWLAGENTS_REGISTRY[id].deepLinkPatterns)
    ).toHaveLength(6));

  test("every declared pattern resolves to the application that declares it", () =>
    OWLAGENTS_APP_IDS.forEach((id) => {
      const patterns = OWLAGENTS_REGISTRY[id].deepLinkPatterns ?? [];

      patterns.forEach((pattern) => {
        const sample = pattern.replace(
          ":id",
          id === "ArtifactViewer"
            ? "ART-0031"
            : id === "Projects"
              ? "PRJ-001"
              : id === "ReviewQueue"
                ? "REV-2026-0184"
                : id === "SourcesFiles"
                  ? "SRC-0142"
                  : id === "WorkOrders"
                    ? "WO-2026-0051"
                    : "MC-0031"
        );

        expect(resolveDeepLink(sample)?.appId).toBe(id);
      });
    }));
});

describe("capabilities are declared for gating", () => {
  test("every application declares at least one required capability", () =>
    OWLAGENTS_APP_IDS.forEach((id) =>
      expect(
        OWLAGENTS_REGISTRY[id].requiredCapabilities.length
      ).toBeGreaterThan(0)
    ));

  test("every application declares a lane badge and a title", () =>
    OWLAGENTS_APP_IDS.forEach((id) => {
      expect(OWLAGENTS_REGISTRY[id].laneBadge).toBeTruthy();
      expect(OWLAGENTS_REGISTRY[id].title).toBeTruthy();
    }));
});
