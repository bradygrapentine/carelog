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
          // Pre-bundle every dep used by the browser-project tests. Anything
          // discovered lazily by Vite mid-run triggers a re-optimize that
          // shows up as `Vite unexpectedly reloaded a test` and a flaky
          // dynamic-import failure (almost always on whichever test file
          // imports the not-yet-pre-bundled dep first). lucide-react was
          // the historical culprit — every icon is its own entry point.
          include: [
            "react",
            "react-dom",
            "@testing-library/react",
            "@trpc/react-query",
            "@base-ui/react/input",
            "@base-ui/react/merge-props",
            "@base-ui/react/separator",
            "@base-ui/react/use-render",
            "lucide-react",
            "next/link",
            "next/navigation",
          ],
        },
        test: {
          name: "web",
          // Browser-mode + a single chromium instance + parallel file-loading
          // races on Vite's optimizeDeps and on the runner registry, surfacing
          // as "Vitest failed to find the runner" and dynamic-import failures.
          // Run browser-project test files serially in the one chromium tab —
          // each file's tests still run as a unit; only file-to-file is serial.
          fileParallelism: false,
          browser: {
            enabled: true,
            // Headless by default — no Chromium windows during local runs
            // or pre-commit. Override with VITEST_HEADED=1 (or `--browser.headless=false`)
            // to debug interactively.
            headless: process.env.VITEST_HEADED !== "1",
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
          exclude: [
            "node_modules/**",
            "server/**",
            "app/api/**",
            // axe tests run in the a11y jsdom project (vitest-axe requires Node/createRequire)
            "components/ui/__tests__/Card.test.tsx",
            "components/ui/__tests__/Button.test.tsx",
            "components/ui/__tests__/Input.test.tsx",
            "components/ui/__tests__/Label.test.tsx",
            "components/ui/__tests__/Dialog.test.tsx",
            "components/journal/__tests__/PatternsStrip.test.tsx",
            "components/__tests__/QuickLogFab.a11y.test.tsx",
            "components/dashboard/__tests__/BriefHero.test.tsx",
            "components/dashboard/__tests__/MedCard.test.tsx",
            "components/dashboard/__tests__/MoodCard.test.tsx",
          ],
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
            "lib/**/__tests__/**/*.test.ts",
            "lib/**/*.test.ts",
            "eslint-rules/**/*.test.mjs",
          ],
          setupFiles: ["./vitest.setup.node.ts"],
          globals: true,
        },
      },
      {
        // A11Y project — axe accessibility assertions on UI primitives
        // vitest-axe uses Node's createRequire to load axe-core; jsdom provides the DOM
        plugins: [
          react(),
          tsconfigPaths({ root: __dirname, projects: ["./tsconfig.json"] }),
        ],
        resolve: {
          dedupe: ["react", "react-dom"],
          alias: { "@": path.resolve(__dirname, ".") },
        },
        test: {
          name: "a11y",
          environment: "jsdom",
          include: [
            "components/ui/__tests__/Card.test.tsx",
            "components/ui/__tests__/Button.test.tsx",
            "components/ui/__tests__/Input.test.tsx",
            "components/ui/__tests__/Label.test.tsx",
            "components/ui/__tests__/Dialog.test.tsx",
            "components/journal/__tests__/PatternsStrip.test.tsx",
            "components/__tests__/QuickLogFab.a11y.test.tsx",
            "components/dashboard/__tests__/BriefHero.test.tsx",
            "components/dashboard/__tests__/MedCard.test.tsx",
            "components/dashboard/__tests__/MoodCard.test.tsx",
          ],
          setupFiles: ["./vitest.setup.ts"],
          globals: true,
        },
      },
    ],
  },
});
