import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import '@testing-library/jest-dom'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})