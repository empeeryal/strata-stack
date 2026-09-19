import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist/**',
    '.astro/**',
    '.vercel/**',
    '.netlify/**',
    '.wrangler/**',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'public/**',
    'drizzle/**',
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // .astro files (frontmatter + template) with accessibility checks.
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Injected at build time via `vite.define` in astro.config.ts.
        __DEPLOY_TARGET__: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // React islands.
  {
    files: ['**/*.{jsx,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended, reactHooks.configs.flat['recommended-latest']],
  },

  // Ambient type declarations: `/// <reference>` and `import()` types keep the file global.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // Scripts and config files run in Node and may log.
  {
    files: ['scripts/**', '*.config.{js,ts,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },

  // Must be last: disables formatting rules that conflict with Prettier.
  prettier,
]);
