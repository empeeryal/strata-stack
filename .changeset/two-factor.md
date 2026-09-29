---
'strata-stack': minor
---

Two-factor authentication through Better Auth's plugin: a dashboard card (`TwoFactorSetup`) that
turns time-based one-time passwords on with the password, a QR code and the first code from the
app, shows ten backup codes, regenerates them and turns the factor off; a `/two-factor` page
(`TwoFactorForm`) after a password sign-in for the code or a backup code, with a 30-day trusted
device option; an admin badge and a **Reset 2FA** action for people who lost both; audit entries
when it is turned on, off or reset; migration `0004` (the `two_factor` table and
`user.two_factor_enabled`). The TOTP secret and backup codes are stored encrypted with
`BETTER_AUTH_SECRET`.
