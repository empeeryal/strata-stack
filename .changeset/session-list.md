---
'strata-stack': minor
---

The dashboard's session list is now an island, `SessionList`, that renders the same forms the
page handled before (so signing out a session still works without JavaScript through the
redirect and notice) and, once hydrated, submits them through the actions client and updates
the list in place. The badge styles moved to `src/components/ui/badge-variants.ts`, shared by
`Badge.astro` and a React `Badge`.
