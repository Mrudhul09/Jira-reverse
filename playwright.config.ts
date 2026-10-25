import { defineConfig, devices } from "@playwright/test";

// Runs against a dev server on a fresh demo database in data/test/. Tests share that data, so one worker.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3200", screenshot: "only-on-failure", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
  webServer: {
    // A production build: what people will use, and no compile pauses on first visits.
    // Tracing is off on purpose: it stops Next.js following redirects after form posts in tests.
    command: "node -e \"require('fs').rmSync('data/test',{recursive:true,force:true})\" && npm run build && npx next start -p 3200",
    url: "http://localhost:3200/login",
    timeout: 400_000,
    reuseExistingServer: !!process.env.PW_REUSE,
    env: { DATABASE_PATH: "data/test/itsm.db", ALERT_TOKEN: "e2e-token", JOBS: "off", APP_URL: "http://localhost:3200", ALLOW_HTTP: "1" },
  },
});
