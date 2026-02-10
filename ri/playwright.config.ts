import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for E2E testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './test/e2e',
  
  // Maximum time one test can run for
  timeout: 60 * 1000,
  
  // Run tests in files in parallel
  fullyParallel: false, // Electron apps need serial execution
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: 1, // Electron can only run one instance at a time
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot only when test fails
    screenshot: 'only-on-failure',
    
    // Record video only when test fails
    video: 'retain-on-failure',
    
    // Base URL to use in actions like `await page.goto('/')`
    // baseURL: 'http://127.0.0.1:5173',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Run your local dev server before starting the tests
  // Uncomment if you want to auto-start the app for E2E tests
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://127.0.0.1:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
