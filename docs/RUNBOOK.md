# Runbook

## Routine operation

The **Update podcast feeds** workflow runs Mondays 07:15 UTC. No manual action is needed. To run
out-of-band: Actions → *Update podcast feeds* → *Run workflow*.

## The weekly run failed

1. Open the failed run and find which step failed.
2. **Validate remaining 2026 schedule** failed — a future week can't be resolved. Reproduce locally:
   `node scripts/generate-podcast.js --date <date from the log>`. Typical causes:
   - Upstream API shape or URL change (check `meta.audio` in the response).
   - A `reading` string the parser doesn't support (fix the schedule or `expandReading`).
   - A topical week that needs generator support.
3. **Generate current feeds** failed — same investigation for the current date.
4. **Publish** failed on push — usually a non-fast-forward race; re-run the workflow.
5. Fix on a branch via PR. Do not hand-edit feeds. Re-run the workflow after merge.

Existing feeds stay in place while a run is failing, so subscribers see the previous week's content.

## WEB feed is stale

Expected when eBible.org denies or changes its directory listing; the workflow log shows
`WEB audio unavailable`. The official feeds are unaffected. Investigate `resolveWebAudio` when convenient.

## Yearly rollover (new manual / year)

1. Add a new `data/cfm-<year>-<volume>.json` from the official manual table of contents; set
   `"verified": false` until spot-checked against Gospel Library.
2. Parameterize the manual URL and schedule path in the generator (currently hard-coded to 2026).
3. Add any new books to `BOOKS`, `BOOK_CHAPTERS`, and, for WEB audio, the book-name map.
4. Update the validation date list in the workflow and the year-specific text in README and `index.html`.
5. Add tests, open a PR, confirm CI passes, and verify at least the first and last week locally.

## Testing a change safely

```bash
node --test "test/*.test.js"
node scripts/generate-podcast.js --date 2026-10-12
git diff --stat            # inspect the feed changes
git checkout -- podcast.xml liahona.xml web.xml
```
