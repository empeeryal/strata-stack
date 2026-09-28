---
'strata-stack': minor
---

Profile editing on the dashboard: a `ProfileForm` island changes the name and avatar through
Better Auth's `updateUser`, validated in the island and again in a `user.update` database hook
(`src/lib/profile.ts`: names of 2 to 80 characters, avatars as `https://` links only). A new
`Avatar` component (Astro and React) shows the image or the person's initials in the header,
the dashboard and the admin users list.
