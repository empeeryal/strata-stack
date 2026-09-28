---
'strata-stack': minor
---

Newsletter with double opt-in: a `NewsletterForm` island in the footer, after blog posts and on
`/newsletter` (which also handles the form without JavaScript), `newsletter.subscribe` and
`newsletter.unsubscribe` actions with the contact form's honeypot and throttles, confirmation and
unsubscribe pages, a `newsletter_subscriber` table (migration `0003`), an optional Resend
audience mirror through `RESEND_AUDIENCE_ID`, an `/admin/subscribers` page with a CSV export
of confirmed addresses and their unsubscribe links, the subscription in the account data export,
and pruning of unconfirmed and unsubscribed addresses after `NEWSLETTER_RETENTION_DAYS`. The
home page code block gets a copy button, shared with the Markdown code blocks.
