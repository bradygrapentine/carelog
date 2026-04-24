/// <reference types="vitest/globals" />
// TD-14 follow-up: vitest.config.ts sets `globals: true`, but TypeScript needs
// this declaration to recognize describe/it/expect/vi/beforeEach/etc. as globals.
// Without it, ~100 test files fail typecheck even though they pass at runtime.
