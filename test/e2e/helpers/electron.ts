import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extended test fixture that includes Electron app and page
 */
export const test = base.extend<{
  electronApp: ElectronApplication;
  page: Page;
}>({
  electronApp: async ({}, use) => {
    // Launch Electron app
    const app = await electron.launch({
      args: [path.join(__dirname, '../../../electron/main.cjs')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    // Wait for app to be ready
    await app.evaluate(async ({ app: electronApp }) => {
      return electronApp.whenReady();
    });

    // Use the app
    await use(app);

    // Cleanup
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    // Get the first window
    const page = await electronApp.firstWindow();
    
    // Wait for the app to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Use the page
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper to get element by test-id
 */
export function getByTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]`);
}

/**
 * Helper to wait for element by test-id
 */
export async function waitForTestId(page: Page, testId: string, options?: { timeout?: number }) {
  const element = getByTestId(page, testId);
  await element.waitFor({ state: 'visible', ...options });
  return element;
}

/**
 * Helper to click element by test-id
 */
export async function clickByTestId(page: Page, testId: string, options?: { timeout?: number }) {
  const element = await waitForTestId(page, testId, options);
  await element.click();
  return element;
}

/**
 * Helper to type into element by test-id
 */
export async function typeByTestId(
  page: Page,
  testId: string,
  text: string,
  options?: { timeout?: number; delay?: number }
) {
  const element = await waitForTestId(page, testId, options);
  await element.fill(text);
  return element;
}

/**
 * Helper to wait for condition with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Helper to take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Helper to restart the Electron app (useful for persistence tests)
 */
export async function restartApp(app: ElectronApplication): Promise<{ newApp: ElectronApplication; newPage: Page }> {
  // Close the current app
  await app.close();

  // Launch a new instance
  const newApp = await electron.launch({
    args: [path.join(__dirname, '../../../electron/main.cjs')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  // Wait for app to be ready
  await newApp.evaluate(async ({ app: electronApp }) => {
    return electronApp.whenReady();
  });

  // Get the first window
  const newPage = await newApp.firstWindow();
  await newPage.waitForLoadState('domcontentloaded');

  return { newApp, newPage };
}

/**
 * Helper to count elements by test-id prefix
 */
export async function countByTestIdPrefix(page: Page, prefix: string): Promise<number> {
  const elements = await page.locator(`[data-testid^="${prefix}"]`).all();
  return elements.length;
}

/**
 * Helper to get all elements by test-id prefix
 */
export function getAllByTestIdPrefix(page: Page, prefix: string) {
  return page.locator(`[data-testid^="${prefix}"]`);
}
