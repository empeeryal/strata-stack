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
        exclude: ['src/**/*.d.ts', 'src/content/**', 'src/db/schema/**', 'src/pages/**'],
      },
    },
  },
  { devToolbar: { enabled: false } },
);
