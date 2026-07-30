import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import {
  DEFAULT_SESSION,
  TASKBAR_ENTRY_SELECTOR,
  WINDOW_SELECTOR,
  WINDOW_TITLEBAR_SELECTOR,
} from "e2e/constants";

/** `e2e/functions.ts` keeps its own copy file-local, so declare ours here. */
type TestProps = { page: Page };

/** Seeds the session the same way `loadApp` does, then goes to a real path. */
export const loadPath =
  (pathname: string) =>
  async ({ page }: TestProps): Promise<Response | null> => {
    await page.addInitScript((session) => {
      window.DEBUG_DEFAULT_SESSION = session;
    }, DEFAULT_SESSION);

    return page.goto(pathname);
  };

export const loadOwlApp =
  (appId: string) =>
  async ({ page }: TestProps): Promise<Response | null> =>
    loadPath(`/?app=${appId}`)({ page });

export const owlWindowCount = async (
  { page }: TestProps,
  count: number
): Promise<void> =>
  expect(async () =>
    expect(await page.locator(WINDOW_SELECTOR).count()).toBe(count)
  ).toPass();

export const taskbarEntryCount = async (
  { page }: TestProps,
  count: number
): Promise<void> =>
  expect(async () =>
    expect(await page.locator(TASKBAR_ENTRY_SELECTOR).count()).toBe(count)
  ).toPass();

export const owlWindowHasText = async (
  text: RegExp | string,
  { page }: TestProps
): Promise<void> =>
  expect(async () =>
    expect(page.locator(WINDOW_SELECTOR).getByText(text).first()).toBeVisible()
  ).toPass();

export const owlTitlebarHasText = async (
  text: RegExp | string,
  { page }: TestProps
): Promise<void> =>
  expect(async () =>
    expect(
      page.locator(WINDOW_TITLEBAR_SELECTOR).getByText(text).first()
    ).toBeVisible()
  ).toPass();

/**
 * Exact by default. List rows carry their status in the accessible name, so a
 * substring match for "Approve" would also hit "… Approved" and click the wrong
 * control — which is how the first version of these tests fooled itself.
 */
const owlButton = (label: RegExp | string, { page }: TestProps): Locator =>
  page
    .locator(WINDOW_SELECTOR)
    .getByRole("button", {
      exact: typeof label === "string",
      name: label,
    })
    .first();

export const clickOwlButton = async (
  label: RegExp | string,
  { page }: TestProps
): Promise<void> => owlButton(label, { page }).click();

export const owlButtonIsDisabled = async (
  label: RegExp | string,
  { page }: TestProps
): Promise<void> => expect(owlButton(label, { page })).toBeDisabled();

/**
 * A sentinel that survives client-side navigation but not a page load, so a
 * test can prove `history.pushState` was used rather than a real navigation.
 */
export const stampPageLoad = async ({ page }: TestProps): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __owlPageLoadId?: number }).__owlPageLoadId =
      Date.now();
  });

export const pageWasNotReloaded = async ({ page }: TestProps): Promise<void> =>
  expect(
    await page.evaluate(
      () => (window as unknown as { __owlPageLoadId?: number }).__owlPageLoadId
    )
  ).toBeDefined();
