---
'strata-stack': minor
---

Vercel Web Analytics custom events. `src/lib/analytics.ts` declares one typed catalogue of events (newsletter sign-ups, contact messages, sign-up, sign-in, magic links, social sign-in, sign-out, two-factor changes, account deletion, command palette selections, code copies, theme changes, deploy-target tabs and the repository link) and `trackEvent()` sends them when `PUBLIC_ANALYTICS=vercel`; elsewhere it is a no-op. Properties describe what happened, never who did it. The new analytics guide lists the events and how to add one.
