import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { viewport: { width: 800, height: 600 }, headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(edge) ? edge : undefined) } },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
