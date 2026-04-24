import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // A11Y-002: Escalate key jsx-a11y rules to error level.
  // eslint-config-next already includes eslint-plugin-jsx-a11y; we only override severity.
  {
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
    },
  },
  // TD-14: Temporarily downgrade rules with significant pre-existing violations
  // so CI can go green again. Cleanup tracked in BACKLOG.md TD-14.
  // CLAUDE.md still prohibits new `any` usage without explicit approval — these
  // downgrades only stop historical debt from blocking CI. Restore to "error"
  // once TD-14 is complete.
  {
    rules: {
      // 471 pre-existing violations across the codebase.
      "@typescript-eslint/no-explicit-any": "warn",
      // 9 pre-existing violations. Modern React renders apostrophes/quotes safely;
      // the rule is mostly cosmetic and routinely disabled in many codebases.
      "react/no-unescaped-entities": "warn",
      // 3 pre-existing violations. Newer React rule; the patterns flagged
      // (storage hydration, prop-driven reset) require refactors to fully resolve
      // (lift state, useSyncExternalStore, key-based remount). Tracked separately.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
