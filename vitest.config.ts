// vitest.config.ts (monorepo root)
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { playwright } from "@vitest/browser-playwright";

const webRoot = path.resolve(__dirname, "apps/web");

export default defineConfig({
  test: {
    projects: [
      "packages/schemas",
      "packages/utils",
      {
        // Web — browser: React component + flow tests (.tsx)
        plugins: [react()],
        define: {
          global: "globalThis",
          "process.env": "{}",
        },
        resolve: {
          dedupe: ["react", "react-dom"],
          alias: { "@": webRoot },
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
          root: webRoot,
          browser: {
            enabled: true,
            // @ts-ignore — pnpm resolves vitest@4.1.2+jsdom alongside 4.1.4+browser-playwright causing type divergence
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          include: [
            "apps/web/**/__tests__/**/*.test.tsx",
            "apps/web/**/__tests__/**/*.flow.test.tsx",
          ],
          exclude: [
            "**/node_modules/**",
            "apps/web/server/**",
            "apps/web/app/api/**",
          ],
          setupFiles: [path.join(webRoot, "vitest.setup.ts")],
          globals: true,
        },
      },
      {
        // Web — node: server routers + API routes
        resolve: {
          alias: { "@": webRoot },
        },
        test: {
          name: "node",
          root: webRoot,
          environment: "node",
          include: [
            "apps/web/server/**/*.test.ts",
            "apps/web/app/api/**/*.test.ts",
            "apps/web/lib/**/*.test.ts",
          ],
          setupFiles: [path.join(webRoot, "vitest.setup.node.ts")],
          globals: true,
        },
      },
    ],
  },
});
