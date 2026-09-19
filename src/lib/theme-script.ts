/**
 * Anti-flash theme bootstrap, injected into <head> by integrations/theme-script.ts. It runs
 * before the body renders on every page, so it stays dependency-free and tiny.
 *
 * - `localStorage.theme` is "light" | "dark" when the visitor chose explicitly, otherwise
 *   absent (follow the OS preference).
 * - `<html data-theme>` is the resolved "light" | "dark"; `data-theme-preference` is
 *   "light" | "dark" | "system". ThemeToggle.astro reads and writes the same values.
 */
export const THEME_STORAGE_KEY = 'theme';

export const THEME_SCRIPT = `(()=>{try{var k="${THEME_STORAGE_KEY}",s=localStorage.getItem(k),p=s==="light"||s==="dark"?s:"system",t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p,h=document.documentElement;h.dataset.theme=t;h.dataset.themePreference=p;h.style.colorScheme=t}catch(e){}})();`;
