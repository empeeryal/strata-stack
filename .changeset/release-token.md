---
'strata-stack': patch
---

The Release workflow opens the version pull request with a `RELEASE_TOKEN` secret when one
exists, so CI, CodeQL and the branch rules apply to that pull request too; without the secret it
falls back to the built-in token as before. The CI and operating guides explain the token's
permissions and expiry.
