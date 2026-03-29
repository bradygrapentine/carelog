// vitest.config.ts (monorepo root)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/schemas',
      'packages/utils',
      'apps/web',
    ],
  },
})