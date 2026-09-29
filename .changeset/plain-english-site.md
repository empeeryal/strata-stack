---
'strata-stack': minor
---

The site ships in English only again. The German locale from 0.20.0 (the `/de` pages, the translated
blog post, the language switcher, the German dictionary and home page copy) is removed: with the
documentation and the signed-in areas in English, most links from a German page led back to
English, and a browser's own translation did a better job than a site translated in patches. The
i18n plumbing stays, configured for one locale: Astro's i18n routing, `src/i18n` with the
dictionaries and path helpers, per-locale home page copy, the content and docs locale helpers and
the `hreflang` output in `Head.astro`, so a project built on the template can add a language by
following the (rewritten) internationalisation guide. With one locale nothing in the markup mentions
another language, and `/de` is a 404.
