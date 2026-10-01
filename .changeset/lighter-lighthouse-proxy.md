---
'strata-stack': patch
---

Lighthouse now audits the Node build through a small gzip proxy (`scripts/lhci-server.mjs`). The standalone Node server serves text uncompressed while every supported deployment compresses it, and the raw numbers put the mobile pages about ten points below what visitors see, close enough to the floors that a slow CI runner failed the release. The author avatar is requested at the size it is shown (`?size=112`) instead of the full 625 KB GitHub original.
