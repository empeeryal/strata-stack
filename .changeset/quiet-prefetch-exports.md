---
'strata-stack': patch
---

Opening the dashboard no longer records an account export. Astro's `prefetchAll` fetched the "Download my data" link as soon as it scrolled into view, which ran the export and wrote an `account.export` audit entry without a click. Both audited downloads, the account export and the admin's subscriber CSV, are now POST forms; a GET to either answers 405. The guides and the agent guidance state the rule: a GET endpoint with a side effect fires without a click on a site that prefetches its links.
