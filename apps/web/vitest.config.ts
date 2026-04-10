import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    name: "web",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
    },
    reporters: [
      "default", // Vitest's default reporter so that terminal output is still visible
      ["vitest-sonar-reporter", { outputFile: "sonar-report.xml" }],
    ],
  },
});
