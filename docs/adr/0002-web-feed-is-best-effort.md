# 2. The World English Bible feed is best-effort

- Status: accepted

## Context

WEB audio is resolved by scraping eBible.org directory listings, which have returned 403s and contain
inconsistent historical filenames. The official feeds should not depend on it.

## Decision

A WEB resolution failure is logged and leaves `web.xml` unchanged. It never fails the run or blocks
`podcast.xml` and `liahona.xml`.

## Consequences

- `web.xml` can silently lag behind the other feeds; the workflow log is where this shows up.
- See commit cd2af81 for the original incident.
