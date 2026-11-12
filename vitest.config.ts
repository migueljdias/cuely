import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // The rules are tested without the week's measured signals; tests/health.test.ts passes its own.
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000, env: { CUELY_NO_SIGNALS: "1" } },
});
