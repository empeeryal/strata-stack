---
'strata-stack': minor
---

Internationalisation layout. Astro's i18n routing is enabled with English at the root and German
under `/de`: the header, navigation, footer, search trigger, theme toggle, account menu and skip
link read their strings from `src/i18n/ui.ts`, a language switcher in the header links to the
translation of the current page (or the other home page), and `Head.astro` emits `hreflang` and
`og:locale` alternates. The home page, the about page and the blog are translated; blog posts are
translated by adding a file with the same slug under `src/content/blog/<locale>/`, the German index
lists the untranslated English posts after the German ones, and `/de/rss.xml` carries the German
feed. The documentation and the signed-in areas stay English. New guide:
docs/guides/internationalisation.
