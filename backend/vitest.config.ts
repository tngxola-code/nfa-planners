import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20_000,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "tests/integration/tenantAuthorization.test.ts",
      "tests/unit/tenantAuthorization.test.ts",
    ],
  },
});
