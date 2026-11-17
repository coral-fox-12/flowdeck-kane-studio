# Flowdeck — Kane Flow Studio

**Author, organise and export Kane CLI flows — natural-language browser tests, verified by a real agent.**

Flowdeck is a dev-tool web app for teams that test with [Kane CLI](https://www.testmuai.com/kane-cli-agent/) (`@testmuai/kane-cli`, TestMu AI). Instead of hand-writing test scripts, you write plain-English objectives ("user logs in, adds an item to cart, checks out"), organise them into suites, export them as runnable `verify.sh` scripts, and import Kane's NDJSON results back into a pass/fail dashboard.

Built with an AI coding agent for the **Kane CLI Online Hackathon** (TestMu AI, 12–19 Nov 2026).

**Live app:** https://flowdeck-kane-studio.surge.sh

## Who it's for

- Developers and QA engineers who verify web apps with Kane CLI and are tired of keeping objectives in scattered docs and shell history.
- AI-coding-agent users: Flowdeck's `kane-flows.json` export is a machine-readable spec your agent can turn into Kane runs, and the results import closes the loop (agent reads NDJSON → fixes → re-runs).

## What it does

- **Flow CRUD** — each flow has a name, target URL, plain-English objective, tags, timeout (10–600s) and status. Search by text, filter by tag/status.
- **Draft from description** — type a feature description; a deterministic local pattern engine (keyword → template, no network, no AI call) proposes 1–3 candidate objectives, each with a verify clause. Edit any draft, then save it as a flow. Handles login, search, cart/checkout, forms, filter, sort, pagination, navigation, responsive, and list/dashboard flows; anything else gets a generic template.
- **Suites & export** — group flows into suites; export a suite as `kane-flows.json` (machine-readable) and as `verify.sh` (one `kane-cli run "<objective>" --agent --headless --timeout <n>` line per flow).
- **Results import** — paste Kane CLI NDJSON (or a single JSON run result); Flowdeck parses `run_end` lines (`status`, `summary`, `credits_consumed`, `test_url`) and step lines into a pass/fail dashboard with status badges, duration, credits and evidence links.
- **Persistence** — flows, suites and results live in `localStorage`. Nothing leaves your browser. First load seeds 3 sample flows + 1 sample result, all clearly marked `SAMPLE`.
- **Printed-ledger UI** — warm paper, ink, hairline rules, one vermillion accent; Fraunces + Space Grotesk + IBM Plex Mono, self-hosted in `fonts/` (no external requests). Responsive, no build step, no backend, no secrets.

## Setup

```bash
npx serve .
# or just open index.html in a browser
# or visit the live app: https://flowdeck-kane-studio.surge.sh
```

No dependencies, no build, no account. Requires only a static file server (or none at all).

## The Kane loop

```
Agent builds  →  Kane verifies  →  fix  →  re-verify
```

1. Draft a flow in Flowdeck (or write one by hand).
2. Export the suite as `verify.sh` and run it — or copy a single flow's command.
3. Paste Kane's NDJSON output into **Results import** and watch the dashboard.
4. Fix what failed, re-run, re-import. Ship when green.

Install Kane CLI and claim free credits first:

```bash
npm install -g @testmuai/kane-cli
# sign up at https://www.testmuai.com/register — 10,000 free credits, no card
```

## Verify Flowdeck itself with Kane CLI

The app's own flows (also in `verify.sh` and `kane-flows.json` at the repo root):

```bash
kane-cli run "On https://flowdeck-kane-studio.surge.sh: open the app and verify the header \"Flowdeck\" is visible, the flow list shows the 3 sample flows, and the results dashboard shows the sample result. Verify that no JavaScript error appears and every button on the page does what it says." --agent --headless --timeout 120

kane-cli run "On https://flowdeck-kane-studio.surge.sh: type \"user logs in with valid credentials and sees the dashboard\" into the Draft from description box and click Generate drafts. Verify that at least one candidate objective appears, it mentions login and a verify clause, and saving it adds a new flow to the flow list." --agent --headless --timeout 120

kane-cli run "On https://flowdeck-kane-studio.surge.sh: open the Default suite and click Export kane-flows.json and Export verify.sh. Verify that both files download, the JSON lists the sample flows, and the shell script contains one kane-cli run line per flow with --agent --headless --timeout 120." --agent --headless --timeout 120
```

Or run the whole suite at once:

```bash
bash verify.sh
```

Then paste the NDJSON output into the app's **Results import** box.

## Tests

```bash
node tests/test.js        # 38 assertions: draft engine, NDJSON parsing, exports, validation
```

See [TESTS.md](TESTS.md) for the checklist and what was verified by hand (local serve + live URL).

## Repo layout

| File | What it is |
|---|---|
| `index.html` | The whole UI (loads `app.js` + `ui.js`) |
| `styles.css` | Printed-ledger theme (paper, ink, vermillion accent; self-hosted fonts) |
| `app.js` | Core logic: draft engine, Kane NDJSON parser, export builders (also used by Node tests) |
| `ui.js` | Browser UI: CRUD, suites, import, localStorage |
| `tests/test.js` | Node self-tests (38 assertions) |
| `verify.sh` | The app's own Kane suite, generated from the seed flows |
| `kane-flows.json` | Same suite as machine-readable JSON |
| `AGENTS.md` | Kane CLI agent instructions (appended from TestMu AI) |

## Note

Flowdeck stores everything in your browser's `localStorage`. The sample flows and sample result are demo data — delete them with **Delete everything** or replace them with your own flows. No data is sent to any server.
