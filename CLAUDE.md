@AGENTS.md

## Claude Code specifics

- `AGENTS.md` above is authoritative. Add only Claude-Code-specific guidance here; don't duplicate it.
- Generator runs hit the network and rewrite tracked feed files. After any test run, restore them with
  `git checkout -- podcast.xml liahona.xml web.xml` before staging.
- Use `git diff --stat` before committing to confirm no generated feed files are included in your change.
- Run `node --test "test/*.test.js"` before every commit.
- For non-trivial changes (new year/volume, new feed, API-shape changes), propose a short plan first.
- Before opening a PR, run `/code-review` on the branch.
