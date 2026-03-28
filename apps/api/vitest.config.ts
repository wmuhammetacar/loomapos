import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests-node/setup-env.ts"],
    include: ["tests-node/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true
  }
});
