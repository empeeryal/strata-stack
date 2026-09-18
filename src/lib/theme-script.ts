/**
 * Anti-flash theme bootstrap.
 *
 * Injected into <head> by `integrations/theme-script.ts` via
 * `injectScript('head-inline', …)`, which Astro hashes automatically for the
 * Content Security Policy. Keep this dependency-free and tiny: it runs before
 * the body renders on every page.
 *
 * Contract shared with `ThemeToggle.astro`:
 * - `localStorage.theme` is `"light" | "dark"` when the visitor chose explicitly,
 *   otherwise absent (follow the OS preference).
 * - `<html data-theme>` is always resolved to `"light" | "dark"`.
 * - `<html data-theme-preference>` is `"light" | "dark" | "system"`.
 */
export const THEME_STORAGE_KEY = 'theme';

export const THEME_SCRIPT = `(()=>{try{var k="${THEME_STORAGE_KEY}",s=localStorage.getItem(k),p=s==="light"||s==="dark"?s:"system",t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p,h=document.documentElement;h.dataset.theme=t;h.dataset.themePreference=p;h.style.colorScheme=t}catch(e){}})();`;
