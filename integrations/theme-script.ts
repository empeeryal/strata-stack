import type { AstroIntegration } from 'astro';

import { THEME_SCRIPT } from '../src/lib/theme-script';

/**
 * Injects THEME_SCRIPT at the `head-inline` stage, which Astro hashes for the Content
 * Security Policy. A raw `<script is:inline>` in a template would not be hashed.
 */
export function themeScript(): AstroIntegration {
  return {
    name: 'framework:theme-script',
    hooks: {
      'astro:config:setup': ({ injectScript }) => {
        injectScript('head-inline', THEME_SCRIPT);
      },
    },
  };
}
