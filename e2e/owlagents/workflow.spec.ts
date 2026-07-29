import { expect, test } from "@playwright/test";
import { WINDOW_SELECTOR } from "e2e/constants";
import {
  captureConsoleLogs,
  disableWallpaper,
  windowsAreVisible,
} from "e2e/functions";
import {
  clickOwlButton,
  loadPath,
  owlButtonIsDisabled,
  owlWindowHasText,
} from "e2e/owlagents/functions";

test.beforeEach(captureConsoleLogs());
test.beforeEach(disableWallpaper);

test.describe("work order transitions are validated", () => {
  test("only legal actions are offered", async ({ page }) => {
    await loadPath("/work-orders/WO-2026-0043")({ page });
    await windowsAreVisible({ page });

    // A draft may be submitted for a policy decision, and nothing else.
    await owlWindowHasText("Submit for policy decision", { page });
    await expect(
      page.getByRole("button", { name: "Approve bounded execution" })
    ).toHaveCount(0);
  });

  test("a committed transition reports the commit, not the request", async ({
    page,
  }) => {
    await loadPath("/work-orders/WO-2026-0043")({ page });
    await windowsAreVisible({ page });
    await clickOwlButton("Submit for policy decision", { page });

    await owlWindowHasText("Committed", { page });
    await owlWindowHasText("Awaiting policy", { page });
  });

  test("a blocked order retries to queued, never straight to running", async ({
    page,
  }) => {
    await loadPath("/work-orders/WO-2026-0050")({ page });
    await windowsAreVisible({ page });

    await owlWindowHasText("Retry (operator command)", { page });
    await expect(page.getByRole("button", { name: /^Run$/ })).toHaveCount(0);
  });
});

test.describe("review safety", () => {
  test("a current review can be approved", async ({ page }) => {
    await loadPath("/reviews/REV-2026-0186")({ page });
    await windowsAreVisible({ page });
    await clickOwlButton("Approve", { page });

    await owlWindowHasText("Committed", { page });
  });

  test("an already-decided review offers no decision", async ({ page }) => {
    await loadPath("/reviews/REV-2026-0192")({ page });
    await windowsAreVisible({ page });

    await owlButtonIsDisabled("Approve", { page });
    await owlWindowHasText(/decision history is preserved/i, { page });
  });

  test("a stale review blocks approval and explains why", async ({ page }) => {
    await loadPath("/?app=MissionControl")({ page });
    await windowsAreVisible({ page });
    await clickOwlButton("Simulate stale review", { page });

    await page.evaluate(() => {
      window.history.pushState({}, "", "/reviews/REV-2026-0186");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await owlWindowHasText(/This review is stale/i, { page });
    await owlWindowHasText(/artifact content hash changed/i, { page });
  });
});

test.describe("wovenstead publication gate", () => {
  test("publish is refused until the candidate is staged", async ({ page }) => {
    await loadPath("/memory/MC-0036")({ page });
    await windowsAreVisible({ page });

    await owlButtonIsDisabled("Publish to Wovenstead", { page });
    await owlWindowHasText(/Approve this candidate, then stage it/i, { page });
  });

  test("approve, stage and publish must be walked in order", async ({
    page,
  }) => {
    await loadPath("/memory/MC-0036")({ page });
    await windowsAreVisible({ page });

    await clickOwlButton("Approve candidate", { page });
    await owlWindowHasText(/Approved, but not yet staged/i, { page });
    await owlButtonIsDisabled("Publish to Wovenstead", { page });

    await clickOwlButton("Stage candidate", { page });
    await clickOwlButton("Publish to Wovenstead", { page });

    await owlWindowHasText("Committed", { page });
    await owlWindowHasText("Published", { page });
  });
});

test.describe("one environment authority", () => {
  test("Mission Control, System Health and Integrations agree", async ({
    page,
  }) => {
    await loadPath("/?app=SystemHealth")({ page });
    await windowsAreVisible({ page });
    await owlWindowHasText("DEMO", { page });
    await owlWindowHasText(/No external system was contacted/i, { page });

    await loadPath("/?app=Integrations")({ page });
    await windowsAreVisible({ page });
    await owlWindowHasText("DEMO", { page });
    await owlWindowHasText(/No external system was contacted/i, { page });
  });

  test("a disconnected integration states its reason", async ({ page }) => {
    await loadPath("/?app=Integrations")({ page });
    await windowsAreVisible({ page });

    await owlWindowHasText("Disconnected", { page });
    await owlWindowHasText(/No runtime detected/i, { page });
  });
});

test.describe("mission control is derived", () => {
  test("resolving an approval removes its attention row", async ({ page }) => {
    await loadPath("/?app=MissionControl")({ page });
    await windowsAreVisible({ page });
    await owlWindowHasText("WO-2026-0047", { page });

    await page.evaluate(() => {
      window.history.pushState({}, "", "/work-orders/WO-2026-0047");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await clickOwlButton("Approve bounded execution", { page });
    await owlWindowHasText("Committed", { page });

    await expect(
      page.getByText(/is waiting for you to approve bounded execution/i)
    ).toHaveCount(0);
  });

  test("progress is reported as a stage, never a percentage", async ({
    page,
  }) => {
    await loadPath("/work-orders/WO-2026-0051")({ page });
    await windowsAreVisible({ page });

    await owlWindowHasText("Research pass — 4 of 6 rubric fields", { page });
    await expect(page.locator(WINDOW_SELECTOR).getByText(/^\d+%$/)).toHaveCount(
      0
    );
  });
});
