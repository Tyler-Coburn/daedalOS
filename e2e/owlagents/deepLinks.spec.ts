import { expect, test } from "@playwright/test";
import {
  captureConsoleLogs,
  disableWallpaper,
  taskbarIsVisible,
  windowTitlebarTextIsVisible,
  windowsAreVisible,
} from "e2e/functions";
import {
  loadPath,
  owlWindowCount,
  owlWindowHasText,
  pageWasNotReloaded,
  stampPageLoad,
} from "e2e/owlagents/functions";

test.beforeEach(disableWallpaper);

const LINKS: [string, string, string][] = [
  ["/projects/PRJ-001", "Projects", "PRJ-001"],
  ["/work-orders/WO-2026-0051", "Work Orders", "WO-2026-0051"],
  ["/reviews/REV-2026-0184", "Review Queue", "REV-2026-0184"],
  ["/artifacts/ART-0031", "Artifact Viewer", "ART-0031"],
  ["/memory/MC-0031", "Wovenstead Staging", "MC-0031"],
];

test.describe("a deep link opens or focuses the right application", () => {
  test.beforeEach(captureConsoleLogs());

  LINKS.forEach(([pathname, title, objectId]) => {
    test(`${pathname} opens ${title} on ${objectId}`, async ({ page }) => {
      await loadPath(pathname)({ page });
      await windowsAreVisible({ page });
      await windowTitlebarTextIsVisible(title, { page });
      await owlWindowHasText(objectId, { page });
    });
  });

  test("a deep link opens the desktop, never replaces it", async ({ page }) => {
    await loadPath("/work-orders/WO-2026-0051")({ page });
    await windowsAreVisible({ page });
    await taskbarIsVisible({ page });
  });

  test("the root still serves the plain desktop", async ({ page }) => {
    await loadPath("/")({ page });
    await taskbarIsVisible({ page });
    await owlWindowCount({ page }, 0);
  });

  test("reloading a deep link restores the selected object", async ({
    page,
  }) => {
    await loadPath("/reviews/REV-2026-0186")({ page });
    await windowsAreVisible({ page });
    await owlWindowHasText("REV-2026-0186", { page });

    await page.reload();

    await windowsAreVisible({ page });
    await owlWindowHasText("REV-2026-0186", { page });
  });

  test("in-app navigation preserves other windows and does not reload", async ({
    page,
  }) => {
    await loadPath("/work-orders/WO-2026-0051")({ page });
    await windowsAreVisible({ page });
    await stampPageLoad({ page });

    // The project field links out by name, which is what the operator sees.
    await page.getByRole("button", { name: "Delphi Research" }).first().click();

    await owlWindowCount({ page }, 2);
    await pageWasNotReloaded({ page });
    expect(page.url()).toContain("/projects/PRJ-001");
  });
});

test.describe("unrecognised links", () => {
  /**
   * These paths are served from 404.html on purpose — static export has no
   * server to rewrite them — so the browser reports the HTTP status while the
   * desktop renders normally. The exclusion is scoped to this block alone.
   */
  test.beforeEach(captureConsoleLogs("owlagents-unknown-link"));

  test("an unknown id opens Mission Control and says so", async ({ page }) => {
    await loadPath("/work-orders/NOT-A-REAL-ID")({ page });
    await windowsAreVisible({ page });
    await windowTitlebarTextIsVisible("Mission Control", { page });
    await owlWindowHasText(/link not recognised/i, { page });
  });

  test("an unknown route opens Mission Control rather than a 404", async ({
    page,
  }) => {
    await loadPath("/widgets/W-0001")({ page });
    await windowsAreVisible({ page });
    await windowTitlebarTextIsVisible("Mission Control", { page });
  });
});
