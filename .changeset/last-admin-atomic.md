---
'strata-stack': patch
---

The last-administrator rule for the admin actions is now enforced inside the SQL statement
that changes the role, bans or deletes the account, so two administrators acting on each
other at the same moment cannot leave the site without an administrator. Those three changes
write their audit entry in the same transaction.
