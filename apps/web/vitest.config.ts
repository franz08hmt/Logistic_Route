import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The existing suites are plain contract tests that run in Node. Only the
 * component tests need a DOM, and they opt in with a `@vitest-environment`
 * docblock, so nothing already passing gets slower or changes environment.
 */
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\/(.*)$/, replacement: `${fileURLToPath(new URL('./', import.meta.url))}$1` }],
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
