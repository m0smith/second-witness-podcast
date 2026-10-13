# AGENTS.md

Instructions for AI coding agents (Codex, Claude Code, and others) working in this repository.
Humans: see [README.md](README.md). This file is the single source of truth for agent behavior;
`CLAUDE.md` imports it.

## What this repo is

Generates and publishes public RSS podcast feeds for the weekly *Come, Follow Me* (Old Testament 2026)
study. It is the public output of a separate, private "Second Witness" project.

- Feeds point at **official Church-hosted audio** (and World English Bible audio from eBible.org).
  This repo never stores or redistributes audio. Do not add audio files or re-host media.
- Zero dependencies. Plain Node.js (>= 22, uses built-in `fetch`), CommonJS. No `package.json`, no build step.
- The generator exports its pure helpers and only runs `main()` when executed directly; keep it that way.
- Feeds are served from the repository's `main` branch (static files; `index.html` at the root).

## Layout

| Path | Role | Hand-editable? |
|------|------|----------------|
| `scripts/generate-podcast.js` | Resolves audio URLs from the Church content API / eBible and writes the feeds | Yes |
| `data/cfm-2026-old-testament.json` | Week-by-week schedule (`start`, `end`, `reading`, optional `topic`) | Yes, with care |
| `.github/workflows/update-podcast-feeds.yml` | Weekly cron: validate remaining weeks, generate, commit feeds to `main` | Yes |
| `podcast.xml`, `liahona.xml`, `web.xml` | **Generated output**, committed by the bot | **No** |
| `index.html` | Static landing page linking the feeds | Yes |
| `test/*.test.js` | Offline unit tests (`node:test`) for the generator's pure helpers and the schedule | Yes |
| `.github/workflows/check.yml` | PR checks: syntax, tests, and "feeds not hand-edited" guard | Yes |
| `docs/` | `ARCHITECTURE.md`, `RUNBOOK.md`, `adr/` decision records | Yes |

## Commands

```bash
node --check scripts/generate-podcast.js                 # syntax check (no network)
node --test "test/*.test.js"                             # unit tests (no network)
node scripts/generate-podcast.js --date 2026-10-12       # generate for the week containing a date (network)
node scripts/generate-podcast.js                         # generate for today's week
```

The generator overwrites the three feed files in the repo root. When you run it for testing,
**discard the result before committing**: `git checkout -- podcast.xml liahona.xml web.xml`.
Feed changes are committed only by the scheduled workflow ("Update podcast feeds").

## Working agreements

- **Never commit directly to `main`.** Branch (`feat/…`, `fix/…`, `docs/…`, `chore/…`) and open a PR.
  The only direct pushes to `main` are the bot's feed commits.
- Never hand-edit generated feeds. Fix the generator or schedule and let the workflow regenerate.
- Keep the generator dependency-free. Adding a dependency needs an explicit reason in the PR.
- Keep commits small and focused; imperative subject line, body explains *why*.
- Do not push, merge, tag, or modify repo/Actions settings without being asked.
- Do not introduce secrets or tokens. None are required; the workflow uses the default `GITHUB_TOKEN`.

## Domain rules and known pitfalls

- **Dates are local-time `Date` objects** built from `YYYY-MM-DD` (`parseDate`). Weeks run Monday–Sunday and
  `end` is inclusive. Do not switch to UTC parsing without re-validating every week boundary.
- **Schedule edits** must keep weeks contiguous (no gaps/overlaps) and `reading` strings parseable by
  `expandReading`. Topical weeks use `topic`; any `topic` other than `christmas` currently throws
  ("Unsupported topical week"), so don't add one without adding generator support.
- **Whole-book readings** need an entry in `BOOK_CHAPTERS`; new books need entries in `BOOKS` and
  `WEB_AUDIO_BOOK_NAMES` as well.
- **The WEB feed is best-effort.** If eBible resolution fails, `web.xml` is intentionally left untouched
  (see commit "Keep official feeds publishing when WEB audio directory denies access"). Never let a WEB
  failure block `podcast.xml` or `liahona.xml`.
- **Do not fabricate media URLs.** Resolve them from the publisher's API or directory listing, as the
  existing code does.
- **Upstream is not under our control.** The Church content API is an undocumented endpoint; treat
  response-shape changes as the most likely cause of CI failures.
- `data/cfm-2026-old-testament.json` carries `"verified": false`. Spot-checking against Gospel Library is
  an open item; do not flip it without actually doing the check.
- The workflow's "Validate remaining 2026 schedule" step hard-codes dates. If you change the schedule,
  update that list in the same PR.

## Definition of done

A change is done when:

1. `node --check scripts/generate-podcast.js` and `node --test "test/*.test.js"` pass.
   Behavior changes come with tests; bug fixes come with a regression test.
2. For generator/schedule changes: `node scripts/generate-podcast.js --date <affected week>` succeeds,
   and you've looked at the resulting feed diff. Then revert the feeds (see Commands).
3. Docs are updated in the same PR when behavior, schedule, cadence, feeds, or workflow change
   (README, `index.html`, `docs/`, and the comments in the workflow). Cadence is **weekly**; don't write "daily".
4. The PR description states what changed, why, how it was verified, and any upstream/network assumptions.
5. You report honestly what was and wasn't verified (e.g. "not run: no network").

## Documentation standards

- Docs describe what is true now. If you notice a doc contradicting the code, fix it or flag it.
- Explain *why* in comments and commit messages; the code already says *what*.
- Prefer one canonical place per fact; link instead of duplicating. Architecture lives in
  `docs/ARCHITECTURE.md`, operations in `docs/RUNBOOK.md`.
- When a decision is non-obvious or hard to reverse, record it as an ADR in `docs/adr/`
  (`NNNN-title.md`: context, decision, consequences).
- Keep user-facing copy (README, `index.html`, feed titles/descriptions) plain and accurate about
  what the feeds are and where audio is hosted.
