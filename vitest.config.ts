import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // The rules are tested without the week's measured signals and re-read prices; tests/health.test.ts and tests/facts.test.ts pass their own.
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000, env: { CUELY_NO_SIGNALS: "1", CUELY_NO_FACT_UPDATES: "1", CUELY_NO_COMPLIANCE: "1" } },
});
