---
'strata-stack': minor
---

Passkeys and email change.

- **Passkeys.** Better Auth's passkey plugin (`@better-auth/passkey`) is configured with the site's hostname as the relying party and the trusted origins as the accepted origins. The dashboard gets a **Passkeys** card (`PasskeyList`) to add, rename and remove passkeys, with the authenticator's maker as the default label; the login page gets **Sign in with a passkey** (`PasskeyButton`) plus the saved passkeys in the email field's autofill. A passkey signs in without a password or a second step. Adding and removing are recorded in the audit log, the export lists each passkey's name, kind and date, and the `passkey` table comes with migration `0005`. The end-to-end suite runs the flow with a virtual authenticator.
- **Email change.** The dashboard's **Email address** card (`ChangeEmailForm`) submits a new address to Better Auth's `changeEmail`. A verified address confirms from the current inbox and then verifies the new one; without email delivery an unverified account changes directly and a verified one is told the change is unavailable. Password accounts confirm with the password (a `before` hook checks it), and the link that performs the change only works in a browser signed in to the account, so it cannot hand a session to whoever opens it. Completed changes are recorded in the audit log.
- Analytics events `Passkey added`, `Passkey removed`, `Email change requested`; `Signed in` carries `method: 'passkey'`. Documentation: passkeys and email change in the authentication guide, a passkey list component page, privacy policy and data guide updates.
