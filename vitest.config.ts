/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// `getViteConfig` loads astro.config.ts so tests see the same aliases, plugins and
// virtual modules (astro:content, astro:env, …) as the app. The dev toolbar is off so the
// compiler does not annotate rendered markup with source locations, which the Container API
// tests compare literally.
export default getViteConfig(
  {
    test: {
      environment: 'node',
      restoreMocks: true,
      include: [
        'src/**/*.test.{ts,tsx}',
        'tests/unit/**/*.test.{ts,tsx}',
        'config/**/*.test.ts',
        'integrations/**/*.test.ts',
      ],
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**', 'config/**', 'integrations/**'],
        // Left out of the unit report because only a running server exercises them: the
        // pages, the actions, the middleware, the Better Auth wiring and the feed. The
        // Playwright suite covers those paths end to end.
        exclude: [
          'src/**/*.d.ts',
          'src/content/**',
          'src/content.config.ts',
          'src/db/schema/**',
          'src/pages/**',
          'src/actions/**',
          'src/middleware.ts',
          'src/lib/auth.ts',
          'src/lib/session.ts',
          'src/lib/rss.ts',
        ],
        // Floors, not targets: a pull request that drops a group below its floor fails the
        // unit job. Raise a floor when the group's coverage has settled above it.
        thresholds: {
          'src/lib/**/*.ts': { lines: 85, branches: 80, functions: 85, statements: 85 },
          'config/**/*.ts': { lines: 80, branches: 80, functions: 70, statements: 75 },
          'src/components/react/**/*.tsx': {
            lines: 80,
            branches: 75,
            functions: 75,
            statements: 80,
          },
          'integrations/**/*.ts': { lines: 80, branches: 70, functions: 80, statements: 80 },
        },
      },
    },
  },
  { devToolbar: { enabled: false } },
);
