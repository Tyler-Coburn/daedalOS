import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ACCESSIBILITY_EXCEPTION_IDS, WINDOW_SELECTOR } from "e2e/constants";
import {
  captureConsoleLogs,
  disableWallpaper,
  windowAnimationIsFinished,
  windowsAreVisible,
} from "e2e/functions";
import { loadOwlApp } from "e2e/owlagents/functions";
import { OWLAGENTS_APP_IDS } from "owlagents/registry";

test.beforeEach(captureConsoleLogs());
test.beforeEach(disableWallpaper);

/**
 * The repository scans the bare desktop for accessibility violations. These
 * apps opt into the same gate per window: dense tables reliably trip contrast,
 * scrollable-region-focusable and nested-interactive, so the checks belong
 * where the density is. The exception list is the repository's, unchanged.
 */
OWLAGENTS_APP_IDS.forEach((id) => {
  test(`${id} has no accessibility violations`, async ({ page }) => {
    await loadOwlApp(id)({ page });
    await windowsAreVisible({ page });
    await windowAnimationIsFinished({ page });

    const { violations } = await new AxeBuilder({ page })
      .include(WINDOW_SELECTOR)
      .disableRules(ACCESSIBILITY_EXCEPTION_IDS)
      .analyze();

    expect(violations).toStrictEqual([]);
  });
});
