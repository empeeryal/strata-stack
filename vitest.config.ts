/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// `getViteConfig` loads astro.config.ts so tests see the same aliases, plugins and
// virtual modules (astro:content, astro:env, …) as the app.
export default getViteConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
      'config/**/*.test.ts',
      'integrations/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', '.astro', 'tests/e2e/**'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**', 'config/**', 'integrations/**'],
      exclude: ['src/**/*.d.ts', 'src/content/**', 'src/db/schema/**', 'src/pages/**'],
    },
  },
});
