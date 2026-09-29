---
'strata-stack': minor
---

Newsletter: unsubscribes made through Resend now reach the site. A new endpoint,
`POST /api/newsletter/webhook`, verifies Resend's signed contact webhooks (`contact.updated`,
`contact.deleted`) with `RESEND_WEBHOOK_SECRET`, marks the address unsubscribed and records it
in the audit log; it never re-subscribes anyone. The provider mirror uses Resend's segments API
(`RESEND_AUDIENCE_ID` holds the segment ID; older dashboards call them audiences), and the admin
overview shows whether the webhook is configured. The roadmap drops the scheduled retention
item, which the Prune data workflow already delivers.
