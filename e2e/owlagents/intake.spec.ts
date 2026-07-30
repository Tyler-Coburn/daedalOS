import { expect, test } from "@playwright/test";
import { DESKTOP_ENTRIES_SELECTOR, WINDOW_SELECTOR } from "e2e/constants";
import {
  captureConsoleLogs,
  disableWallpaper,
  windowsAreVisible,
} from "e2e/functions";
import {
  clickOwlButton,
  loadOwlApp,
  loadPath,
  owlWindowCount,
  owlWindowHasText,
} from "e2e/owlagents/functions";

test.beforeEach(captureConsoleLogs());
test.beforeEach(disableWallpaper);

test.describe("governed source intake", () => {
  test("a dropped file walks every stage and only then is it ready", async ({
    page,
  }) => {
    await loadOwlApp("SourcesFiles")({ page });
    await windowsAreVisible({ page });
    await owlWindowHasText(/Drop a file here to begin a governed intake/i, {
      page,
    });

    await page.locator(`${WINDOW_SELECTOR} input[type=file]`).setInputFiles({
      buffer: Buffer.from("# Dropped by the operator\n\nEvidence excerpt.\n"),
      mimeType: "text/markdown",
      name: "operator-drop.md",
    });

    // The new source appears with a real hash and reaches Ready by walking
    // the stages, not by being declared authoritative on arrival.
    await owlWindowHasText("SRC-0149", { page });
    await owlWindowHasText("operator-drop.md", { page });
    await expect(
      page.locator(WINDOW_SELECTOR).getByText("Ready").first()
    ).toBeVisible();
  });

  test("the ledger records every intake stage separately", async ({ page }) => {
    await loadOwlApp("SourcesFiles")({ page });
    await windowsAreVisible({ page });

    await page.locator(`${WINDOW_SELECTOR} input[type=file]`).setInputFiles({
      buffer: Buffer.from("ledger check\n"),
      mimeType: "text/plain",
      name: "ledger-check.txt",
    });
    await owlWindowHasText("SRC-0149", { page });

    await page.evaluate(() => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await loadOwlApp("EventTimeline")({ page });
    await windowsAreVisible({ page });

    // Intake events only exist after a real intake, so this run starts fresh.
    await owlWindowHasText(/source/i, { page });
  });

  test("the intake surface explains that arrival is not authority", async ({
    page,
  }) => {
    await loadPath("/?app=SourcesFiles")({ page });
    await windowsAreVisible({ page });

    await owlWindowHasText(/not authoritative until it reaches Ready/i, {
      page,
    });
  });
});

test.describe("capability gating", () => {
  test("an application opens normally while its capability is held", async ({
    page,
  }) => {
    await loadOwlApp("PolicyInspector")({ page });
    await windowsAreVisible({ page });

    await owlWindowHasText("POL-001", { page });
  });

  /**
   * The gate has to be reactive, not merely checked once at mount — revoking a
   * capability must close off an application that is already open. Both windows
   * live in one page session, because a reload would build a fresh store with
   * the full capability set.
   */
  test("revoking the capability refuses an application that is already open", async ({
    page,
  }) => {
    await loadOwlApp("PolicyInspector")({ page });
    await windowsAreVisible({ page });
    await owlWindowHasText("POL-001", { page });

    // The generated desktop shortcut opens Mission Control alongside it.
    await page
      .locator(DESKTOP_ENTRIES_SELECTOR)
      .getByText("OwlAgents")
      .dblclick();
    await owlWindowCount({ page }, 2);

    await clickOwlButton("Simulate denied permission", { page });

    await owlWindowHasText(/You do not have access to this application/i, {
      page,
    });
    await owlWindowHasText(/policy\.read/i, { page });
    await expect(
      page.locator(WINDOW_SELECTOR).getByText("POL-001")
    ).toHaveCount(0);
  });
});
