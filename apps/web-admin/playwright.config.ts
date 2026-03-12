import { defineConfig } from "@playwright/test";

const PORT = 3210;
const baseURL = `http://127.0.0.1:${PORT}`;
const devCommand =
  process.platform === "win32"
    ? `cmd /c npm run dev -- --port ${PORT}`
    : `npm run dev -- --port ${PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  webServer: {
    command: devCommand,
    port: PORT,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_AUTH_MODE: "mock"
    },
    timeout: 120_000
  }
});
