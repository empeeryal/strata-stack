---
'strata-stack': patch
---

Test hardening. A test that passes only on a retry now fails the CI run (`failOnFlakyTests`); the admin spec runs as its own Playwright project after every other spec, because making one account the last administrator demotes the one the accessibility suite uses, and it restores its two accounts' roles at the start of the block so a retry begins from a known state. The avatar test serves its image itself instead of fetching it from github.com. The contact and newsletter per-IP throttles allow fifty submissions in test runs so a retried block is not refused. Every island that talks to the server gets a test for a dropped connection, with the mock rejecting from a plain function so Vitest does not count the rejection against the test; the testing guide documents the pattern.
