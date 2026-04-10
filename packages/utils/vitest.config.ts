import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "utils",
    environment: "node",
    coverage: {
      provider: "v8",
    },
    reporters: [
      "default", // Vitest's default reporter so that terminal output is still visible
      ["vitest-sonar-reporter", { outputFile: "sonar-report.xml" }],
    ],
  },
});
