import type { AstroIntegration } from 'astro';

import { THEME_SCRIPT } from '../src/lib/theme-script';

/**
 * Injects the anti-flash theme script as an inline <script> in <head>.
 *
 * Why an integration instead of `<script is:inline>` in the layout?
 * Astro's CSP support hashes scripts injected at the `head-inline` stage, but it
 * does NOT hash raw `is:inline` scripts written in templates. Using the
 * integration keeps the CSP hash in sync with the script automatically.
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
