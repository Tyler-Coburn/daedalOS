import { test } from "@playwright/test";
import {
  captureConsoleLogs,
  disableWallpaper,
  taskbarEntryIsVisible,
  windowAnimationIsFinished,
  windowTitlebarTextIsVisible,
  windowsAreVisible,
} from "e2e/functions";
import {
  loadOwlApp,
  owlWindowCount,
  taskbarEntryCount,
} from "e2e/owlagents/functions";
import { OWLAGENTS_REGISTRY } from "owlagents/registry";

test.beforeEach(captureConsoleLogs());
test.beforeEach(disableWallpaper);

const APPS = Object.entries(OWLAGENTS_REGISTRY);

/**
 * Every application opens through the existing process system, gets a real
 * window and a taskbar entry, and carries its registered title. This is the
 * check that the registry is actually wired to the shell rather than merely
 * declared.
 */
APPS.forEach(([id, entry]) => {
  test(`${entry.title} opens with a window and a taskbar entry`, async ({
    page,
  }) => {
    await loadOwlApp(id)({ page });
    await windowsAreVisible({ page });
    await windowAnimationIsFinished({ page });
    await windowTitlebarTextIsVisible(entry.title, { page });
    await taskbarEntryIsVisible(entry.title, { page });
  });
});

test.describe("singleton behaviour comes from the registry", () => {
  test("a singleton re-targets rather than duplicating", async ({ page }) => {
    await loadOwlApp("MissionControl")({ page });
    await windowsAreVisible({ page });
    await page.evaluate(() => {
      window.history.pushState({}, "", "/work-orders/WO-2026-0051");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.evaluate(() => {
      window.history.pushState({}, "", "/work-orders/WO-2026-0050");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Mission Control plus one Work Orders window — not two Work Orders.
    await owlWindowCount({ page }, 2);
    await taskbarEntryCount({ page }, 2);
  });

  test("a non-singleton opens a window per object", async ({ page }) => {
    await loadOwlApp("MissionControl")({ page });
    await windowsAreVisible({ page });
    await page.evaluate(() => {
      window.history.pushState({}, "", "/artifacts/ART-0031");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.evaluate(() => {
      window.history.pushState({}, "", "/artifacts/ART-0032");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await owlWindowCount({ page }, 3);
  });
});
