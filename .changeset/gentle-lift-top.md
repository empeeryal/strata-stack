---
'strata-stack': minor
---

Back-to-top button. Every page gets a fixed button (`src/components/ui/BackToTop.astro`, rendered by `BaseLayout`) that appears once the page has been scrolled about a screen, scrolls back to the top and moves focus to the main landmark, so keyboard and screen-reader users land at the start of the content. It respects the reduced-motion preference through the page's `scroll-behavior`, needs no island, and the main element now carries `tabindex="-1"` so both it and the skip link can move focus there.
