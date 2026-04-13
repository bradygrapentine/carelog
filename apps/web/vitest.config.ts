import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { playwright } from "@vitest/browser-playwright";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
    },
    reporters: [
      "default",
      ["vitest-sonar-reporter", { outputFile: "sonar-report.xml" }],
    ],
    projects: [
      {
        // Browser project — React component and flow tests (.tsx)
        plugins: [
          react(),
          tsconfigPaths({ root: __dirname, projects: ["./tsconfig.json"] }),
        ],
        define: {
          global: "globalThis",
          "process.env": "{}",
        },
        resolve: {
          dedupe: ["react", "react-dom"],
          alias: { "@": path.resolve(__dirname, ".") },
        },
        optimizeDeps: {
          include: [
            "react",
            "react-dom",
            "@testing-library/react",
            "@trpc/react-query",
            "@base-ui/react/input",
            "@base-ui/react/merge-props",
            "@base-ui/react/use-render",
          ],
        },
        test: {
          name: "web",
          browser: {
            enabled: true,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — pnpm resolves vitest@4.1.2+jsdom alongside 4.1.4+browser-playwright causing type divergence
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            // 60s default was tripping on cold chromium boots when the
            // pre-commit hook ran alongside other dev processes. 180s
            // eliminates the flake without hiding a real failure.
            connectTimeout: 180_000,
          },
          include: [
            "**/__tests__/**/*.test.tsx",
            "**/__tests__/**/*.flow.test.tsx",
          ],
          exclude: ["node_modules/**", "server/**", "app/api/**"],
          setupFiles: ["./vitest.setup.ts"],
          globals: true,
        },
      },
      {
        // Node project — server routers and API routes (require Node.js / @trpc/server)
        plugins: [
          tsconfigPaths({ root: __dirname, projects: ["./tsconfig.json"] }),
        ],
        resolve: {
          alias: { "@": path.resolve(__dirname, ".") },
        },
        test: {
          name: "node",
          environment: "node",
          include: [
            "server/**/*.test.ts",
            "app/api/**/*.test.ts",
            "inngest/**/*.test.ts",
            "lib/**/*.test.ts",
          ],
          setupFiles: ["./vitest.setup.node.ts"],
          globals: true,
        },
      },
    ],
  },
});
