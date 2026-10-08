import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts', // logs in with CRM_USERNAME / CRM_PASSWORD when auth.json is missing or expired
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }], ['./reporter/excel-reporter.ts', { outputDir: 'reports' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://qa-crm.asquareab.com',
    storageState: 'auth.json', // written by global-setup; every test reuses this session
    headless: true,
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
});
