import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 } },
    },
    {
      name: 'tablet',
      use: { browserName: 'chromium', viewport: { width: 1024, height: 768 } },
    },
  ],
  webServer: {
    command: 'yarn dev --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
})
