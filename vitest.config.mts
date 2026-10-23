import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/podcap_test",
      ENCRYPTION_KEY: "dGVzdC1vbmx5LWtleS10ZXN0LW9ubHkta2V5LTMyYiE=",
    },
    globalSetup: "./tests/global-setup.ts",
    // One shared test database.
    fileParallelism: false,
  },
});
