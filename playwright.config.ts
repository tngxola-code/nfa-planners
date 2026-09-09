import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],

  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: './backend',
      port: 4000,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: 'rm -rf .next && npm run dev',
      cwd: './frontend',
      port: 3002,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
