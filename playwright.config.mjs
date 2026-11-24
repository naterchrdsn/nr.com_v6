import { defineConfig, devices } from '@playwright/test';

const remote = process.env.SITE_URL;
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: remote || 'http://127.0.0.1:4326', headless: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: remote ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4326',
    url: 'http://127.0.0.1:4326',
    reuseExistingServer: false,
  },
});
