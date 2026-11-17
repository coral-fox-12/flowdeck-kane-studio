# Flowdeck — test checklist

Run the automated suite:

```bash
node tests/test.js
```

## Automated (38 assertions, all passing as of 2026-11-17)

- **Draft engine** — "user logs in, adds an item to cart, checks out" yields login first + checkout candidate, each with a verify clause and the target URL embedded; search descriptions extract the query ("red shoes"); multi-keyword descriptions yield up to 3 candidates in description order (filter → sort → pagination); unknown descriptions fall back to a generic template; empty input yields nothing.
- **Kane NDJSON parsing** — 2 runs from mixed NDJSON (run_start/step_end/run_end + one bad line): statuses, `credits_consumed`, `test_url`, `duration_ms`, and step counts all correct; the bad line is reported, not fatal. Single JSON object also parses; garbage/empty input yields errors and no runs.
- **Exports** — `kaneCommand` produces the exact `kane-cli run "<objective>" --agent --headless --timeout <n>` shape, prepends the URL when the objective lacks one, and escapes `"`/`$`/backticks. `buildVerifyScript` emits one run line per flow plus shebang + install hint. `buildFlowsExport` emits `flowdeck/kane-flows@1` JSON.
- **Validation & filtering** — bad URL, short objective, and out-of-range timeout are rejected; tag/status/text filters each return the right subset.
- **Seed data** — exactly 3 sample flows, all valid, all with a verify clause; sample result is `passed` with 42 credits.

Bugs the tests caught and fixed: "logs in" didn't match the `log in` keyword; "adds an item to cart" missed the checkout pattern; the `list` keyword fired on the word "list" in any description; one test counted a comment line as a run line.

## Manual checks (done 2026-11-17)

- [x] `node --check app.js && node --check ui.js` — syntax OK.
- [x] Served locally (`python3 -m http.server`): `index.html`, `app.js`, `ui.js`, `styles.css` all HTTP 200; page contains the Flowdeck header and Kane commands.
- [x] Live Surge URL returns HTTP 200 and serves the app (see deploy step).
- [ ] Full click-through in a real browser (CRUD, draft → save, suite export downloads, NDJSON import → dashboard) — exercised by the Kane CLI verification run instead; see `verify.sh`.
- [ ] Kane CLI run against the live URL — separate verification step (needs TestMu account + credits).

## How to re-run

```bash
node tests/test.js            # unit tests (exit 0 = pass)
python3 -m http.server 8123   # then open http://localhost:8123
bash verify.sh                # needs Kane CLI + TestMu account; paste output into Results import
```
