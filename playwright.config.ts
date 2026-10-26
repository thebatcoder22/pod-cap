import { defineConfig, devices } from "@playwright/test";

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/podcap_e2e";
// E2E_PORT runs a second checkout's specs next to the first, each with its own E2E_DATABASE_URL.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Specs share one database (the Jira connection, the allowlist), so they run one at a time.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"] },
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      E2E_TEST_LOGIN: "1",
      AUTH_TRUST_HOST: "true",
      ENCRYPTION_KEY: "ZTJlLW9ubHkta2V5LWUyZS1vbmx5LWtleS0zMmJ5dGU=",
    },
  },
});
