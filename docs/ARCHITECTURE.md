# Architecture

## Overview

```
data/cfm-2026-old-testament.json ──┐
                                   ▼
GitHub Actions (weekly) ──► scripts/generate-podcast.js ──► podcast.xml / liahona.xml / web.xml
                                   │                              │
          Church content API ◄─────┤                              ▼
          eBible.org listing ◄─────┘                 committed to main by the bot
```

## Components

- **Schedule** (`data/cfm-2026-old-testament.json`): one entry per week with inclusive `start`/`end`
  (Monday–Sunday), a `label`, a `reading` string, and optional `topic` for non-chapter weeks.
- **Generator** (`scripts/generate-podcast.js`): picks the week for a date, expands `reading` into
  chapters, resolves an audio URL per chapter, and writes three RSS 2.0 files to the repo root.
  Exports its pure helpers for testing; only runs `main()` when executed directly.
- **Workflow** (`update-podcast-feeds.yml`): validates every remaining week against the live API, generates
  the current week, and commits changed feeds to `main`.
- **Check workflow** (`check.yml`): offline syntax check and unit tests on every PR.

## Data sources

| Feed | Source | Resolution |
|------|--------|------------|
| `podcast.xml` | Church study content API (`/study/api/v3/language-pages/type/content`) | `meta.audio[].mediaUrl` for the lesson, each chapter, and each linked non-scripture page |
| `liahona.xml` | Same API | The subset of linked pages under `/general-conference/`, `/liahona/`, or `/magazines/` |
| `web.xml` | `ebible.org/eng-web/audio/` directory listings | Chapter N is the Nth unique `.mp3` in the book's listing |

## Failure behavior

- The validation step's output is discarded (`git checkout`) before the real generate step, so only the
  current week's feeds can be committed.
- A failed chapter or lesson fetch fails the run before any feed is written, so the previous feeds stay live.
- A failed WEB resolution is non-fatal: `web.xml` is left as-is and the official feeds still publish.
- A failed linked-asset fetch is skipped with a warning.

## Known limitations

- Pearl of Great Price readings (Moses, Abraham) are not supported; those weeks are all in the past.
- Topical weeks other than `christmas` are unsupported and throw.
- `enclosure length` is always `0` because file sizes are not fetched.
- The schedule, manual URL, and validation dates are specific to 2026.
- The Church content API is undocumented and may change shape without notice.
