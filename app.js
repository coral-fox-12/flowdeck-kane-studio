/* Flowdeck — Kane Flow Studio: core logic.
 * Pure functions, no DOM access: usable in the browser and in Node tests.
 * Draft engine is deterministic: keyword -> template, no network, no AI.
 */
(function (root) {
  'use strict';

  var DEFAULT_URL = 'https://flowdeck-kane-studio.surge.sh';

  function esc(s) { return String(s == null ? '' : s); }

  function extractQuoted(desc, re) {
    var m = desc.match(re);
    return m ? m[1].trim().replace(/[.,;]+$/, '') : null;
  }

  /* One pattern = one kind of user flow. Each build() returns a full
   * objective: "On <url>: <steps>. Verify that <assertion>." */
  var PATTERNS = [
    {
      id: 'login', title: 'Login / sign-in flow',
      keys: ['log in', 'logs in', 'logged in', 'login', 'sign in', 'signin', 'sign-in', 'auth'],
      tags: ['auth', 'login'],
      build: function (desc, url) {
        return 'On ' + url + ': open the login page, sign in with valid test ' +
          'credentials, and wait for the authenticated home or dashboard to load. ' +
          'Verify that the user sees a logout or profile control, no error message ' +
          'is shown, and the session persists after a page reload.';
      }
    },
    {
      id: 'search', title: 'Search flow',
      keys: ['search', 'find'],
      tags: ['search'],
      build: function (desc, url) {
        var q = extractQuoted(desc, /search (?:for )?["']?([^"'\n.,;]+)/i) ||
                extractQuoted(desc, /find ["']?([^"'\n.,;]+)/i) || 'test query';
        return 'On ' + url + ': use the search box to search for "' + q + '", wait ' +
          'for results to load, and open the first result. Verify that the results ' +
          'list is non-empty, every result relates to "' + q + '", and the opened ' +
          'result page loads without an error.';
      }
    },
    {
      id: 'checkout', title: 'Add to cart + checkout flow',
      keys: ['checkout', 'check out', 'add to cart', 'add item to cart', 'to cart', 'cart', 'buy', 'purchase', 'payment'],
      tags: ['checkout', 'ecommerce'],
      build: function (desc, url) {
        return 'On ' + url + ': browse the catalogue, add an item to the cart, open ' +
          'the cart, and complete checkout with test payment details. Verify that ' +
          'the cart total updates when the item is added, checkout accepts the test ' +
          'details, and an order confirmation page or number is shown at the end.';
      }
    },
    {
      id: 'form', title: 'Form submit flow',
      keys: ['form', 'submit', 'contact', 'sign up', 'signup', 'sign-up', 'register', 'subscribe', 'feedback'],
      tags: ['form'],
      build: function (desc, url) {
        return 'On ' + url + ': fill in the form with valid test data, submit it, ' +
          'and wait for the response. Verify that a success message or confirmation ' +
          'is shown, the form does not report validation errors for valid input, ' +
          'and submitting the same form empty shows a validation error.';
      }
    },
    {
      id: 'filter', title: 'Filter flow',
      keys: ['filter', 'filters', 'filtering'],
      tags: ['filter'],
      build: function (desc, url) {
        return 'On ' + url + ': apply a filter to the list and wait for the results ' +
          'to update. Verify that every visible item matches the applied filter, ' +
          'the result count changes, and clearing the filter restores the full list.';
      }
    },
    {
      id: 'sort', title: 'Sort flow',
      keys: ['sort', 'sorting', 'order by'],
      tags: ['sort'],
      build: function (desc, url) {
        return 'On ' + url + ': change the sort order of the list and wait for it to ' +
          'update. Verify that the items are in the selected order, the sort ' +
          'control reflects the selection, and switching back restores the ' +
          'original order.';
      }
    },
    {
      id: 'pagination', title: 'Pagination flow',
      keys: ['pagination', 'paginate', 'next page', 'page 2', 'load more'],
      tags: ['pagination'],
      build: function (desc, url) {
        return 'On ' + url + ': go to the next page of the list using pagination and ' +
          'wait for it to load. Verify that page 2 shows different items from page ' +
          '1, the page indicator updates, and going back returns to page 1.';
      }
    },
    {
      id: 'navigation', title: 'Navigation flow',
      keys: ['navigation', 'menu', 'nav', 'header', 'footer', 'sidebar'],
      tags: ['navigation'],
      build: function (desc, url) {
        return 'On ' + url + ': use the main navigation to visit each top-level ' +
          'section. Verify that every navigation link loads its page without an ' +
          'error, the current section is highlighted, and the navigation stays ' +
          'visible on every page.';
      }
    },
    {
      id: 'responsive', title: 'Mobile / responsive flow',
      keys: ['mobile', 'responsive', 'small screen', 'phone'],
      tags: ['responsive'],
      build: function (desc, url) {
        return 'On ' + url + ': resize the browser to a mobile viewport (390px wide) ' +
          'and reload the page. Verify that no horizontal scrolling appears, the ' +
          'main content and primary action remain reachable, and the navigation ' +
          'collapses into a usable mobile menu.';
      }
    },
    {
      id: 'list', title: 'List / dashboard renders data',
      keys: ['dashboard', 'table', 'data table', 'feed', 'items list'],
      tags: ['data'],
      build: function (desc, url) {
        return 'On ' + url + ': open the list or dashboard view and wait for the data ' +
          'to load. Verify that at least one row or card is rendered, the data ' +
          'matches what the page claims to show, and an empty state or loading ' +
          'state is shown instead of a blank page when there is no data.';
      }
    }
  ];

  function genericObjective(desc, url) {
    var short = desc.length > 140 ? desc.slice(0, 140).trim() + '…' : desc;
    return 'On ' + url + ': carry out the following — ' + short + '. Verify that ' +
      'each step completes without an error, the expected page or confirmation ' +
      'appears, and the app stays usable afterwards.';
  }

  /* description -> 1..3 candidate objectives, best keyword match first. */
  function draftObjectives(description, url) {
    var desc = esc(description).trim();
    var target = esc(url).trim() || DEFAULT_URL;
    if (!desc) return [];
    var lower = desc.toLowerCase();
    var hits = [];
    PATTERNS.forEach(function (p) {
      var best = -1; var matched = [];
      p.keys.forEach(function (k) {
        var i = lower.indexOf(k);
        if (i !== -1) { matched.push(k); if (best === -1 || i < best) best = i; }
      });
      if (best !== -1) hits.push({ pattern: p, at: best, matched: matched });
    });
    hits.sort(function (a, b) { return a.at - b.at; });
    var out = hits.slice(0, 3).map(function (h) {
      return {
        id: h.pattern.id, title: h.pattern.title, tags: h.pattern.tags.slice(),
        matched: h.matched, objective: h.pattern.build(desc, target)
      };
    });
    if (!out.length) {
      out.push({ id: 'generic', title: 'General flow', tags: ['general'],
        matched: [], objective: genericObjective(desc, target) });
    }
    return out;
  }

  /* ---- Kane CLI output parsing ---- */

  function normStatus(s) {
    s = esc(s).trim().toLowerCase();
    if (s === 'pass' || s === 'passed' || s === 'success' || s === 'successful') return 'passed';
    if (s === 'fail' || s === 'failed' || s === 'failure' || s === 'error' || s === 'errored') return 'failed';
    if (s === 'skipped' || s === 'skip') return 'skipped';
    return s || 'unknown';
  }

  function normRun(obj) {
    var r = (obj && typeof obj === 'object') ? obj : {};
    var run = r.run || r.result || r;
    return {
      status: normStatus(run.status || r.status),
      summary: esc(run.summary || run.message || run.name || r.summary || r.message || ''),
      objective: esc(run.objective || run.input || run.prompt || r.objective || r.input || ''),
      credits: (run.credits_consumed != null ? run.credits_consumed :
                (r.credits_consumed != null ? r.credits_consumed :
                (run.credits != null ? run.credits : null))),
      testUrl: esc(run.test_url || run.testUrl || run.video_url || run.evidence_url ||
                   r.test_url || r.testUrl || r.video_url || ''),
      durationMs: (run.duration_ms != null ? run.duration_ms :
                   (run.durationMs != null ? run.durationMs :
                   (r.duration_ms != null ? r.duration_ms : null))),
      steps: []
    };
  }

  function isRunLike(obj) {
    if (!obj || typeof obj !== 'object') return false;
    var t = esc(obj.type).toLowerCase();
    if (t === 'run_end' || t === 'run_result' || t === 'result') return true;
    if (obj.status && (obj.summary || obj.credits_consumed != null || obj.test_url)) return true;
    if (obj.run && typeof obj.run === 'object') return true;
    return false;
  }

  function isStepLike(obj) {
    if (!obj || typeof obj !== 'object') return false;
    var t = esc(obj.type).toLowerCase();
    return t.indexOf('step') === 0 || (obj.step != null && obj.name != null);
  }

  /* Accepts Kane CLI NDJSON (one JSON object per line) or a single JSON
   * object / array. Returns { runs: [...], errors: [...] }. */
  function parseKaneInput(text) {
    var input = esc(text).trim();
    if (!input) return { runs: [], errors: ['Paste Kane CLI output first.'] };
    var runs = []; var errors = []; var pendingSteps = [];
    function attachSteps(run) { run.steps = pendingSteps; pendingSteps = []; }

    var whole = null;
    try { whole = JSON.parse(input); } catch (e) { /* not single JSON */ }
    if (whole && typeof whole === 'object') {
      if (Array.isArray(whole)) {
        whole.forEach(function (o) {
          if (isRunLike(o)) runs.push(normRun(o));
          else if (isStepLike(o)) pendingSteps.push(o);
        });
      } else if (Array.isArray(whole.runs)) {
        whole.runs.forEach(function (o) { if (isRunLike(o)) runs.push(normRun(o)); });
      } else if (isRunLike(whole)) {
        runs.push(normRun(whole));
      } else {
        return { runs: [], errors: ['Could not recognise this JSON as a Kane CLI run result (no status / run_end found).'] };
      }
      runs.forEach(attachSteps);
      return { runs: runs, errors: errors };
    }

    var lines = input.split(/\r?\n/);
    lines.forEach(function (line, idx) {
      var l = line.trim();
      if (!l) return;
      var obj;
      try { obj = JSON.parse(l); } catch (e) {
        errors.push('Line ' + (idx + 1) + ': not valid JSON, skipped.');
        return;
      }
      if (isRunLike(obj)) {
        var run = normRun(obj);
        attachSteps(run);
        runs.push(run);
      } else if (isStepLike(obj)) {
        pendingSteps.push(obj);
      } else if (obj && typeof obj === 'object' && obj.type) {
        /* run_start / log / heartbeat lines: ignore silently. */
      } else {
        errors.push('Line ' + (idx + 1) + ': unrecognised object, skipped.');
      }
    });
    if (pendingSteps.length && runs.length) {
      runs[runs.length - 1].steps = runs[runs.length - 1].steps.concat(pendingSteps);
    }
    if (!runs.length && !errors.length) errors.push('No run result found — expected a run_end line or an object with a status.');
    return { runs: runs, errors: errors };
  }

  /* ---- Export builders ---- */

  function escapeDq(s) {
    return esc(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      .replace(/\$/g, '\\$').replace(/`/g, '\\`').replace(/\n/g, ' ');
  }

  function kaneCommand(flow) {
    var objective = esc(flow.objective).trim();
    if (!/^on\s+https?:\/\//i.test(objective) && flow.url) {
      objective = 'On ' + esc(flow.url).trim() + ': ' + objective;
    }
    var timeout = parseInt(flow.timeout, 10);
    if (!timeout || timeout < 1) timeout = 120;
    return 'kane-cli run "' + escapeDq(objective) + '" --agent --headless --timeout ' + timeout;
  }

  function buildVerifyScript(suiteName, flows) {
    var lines = [];
    lines.push('#!/usr/bin/env bash');
    lines.push('# Flowdeck export — suite: ' + esc(suiteName));
    lines.push('# Generated by Flowdeck (Kane Flow Studio). Requires Kane CLI:');
    lines.push('#   npm install -g @testmuai/kane-cli');
    lines.push('# Run: bash verify.sh   (one kane-cli run per flow, in order)');
    lines.push('set -euo pipefail');
    lines.push('');
    flows.forEach(function (f) {
      lines.push('# ' + esc(f.name) + (f.tags && f.tags.length ? ' [' + f.tags.join(', ') + ']' : ''));
      lines.push(kaneCommand(f));
      lines.push('');
    });
    return lines.join('\n');
  }

  function buildFlowsExport(suite, flows) {
    return {
      format: 'flowdeck/kane-flows@1',
      suite: esc(suite.name),
      exported_at: new Date().toISOString(),
      flows: flows.map(function (f) {
        return { name: f.name, url: f.url, objective: f.objective,
          tags: f.tags || [], timeout: parseInt(f.timeout, 10) || 120 };
      })
    };
  }

  /* ---- Flow helpers ---- */

  function validateFlow(f) {
    var errs = [];
    if (!esc(f.name).trim()) errs.push('Name is required.');
    if (!esc(f.url).trim()) errs.push('Target URL is required.');
    else {
      try {
        var u = new URL(esc(f.url).trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') errs.push('Target URL must start with http:// or https://.');
      } catch (e) { errs.push('Target URL is not a valid URL.'); }
    }
    if (esc(f.objective).trim().length < 10) errs.push('Objective must be at least 10 characters.');
    var t = parseInt(f.timeout, 10);
    if (isNaN(t) || t < 10 || t > 600) errs.push('Timeout must be between 10 and 600 seconds.');
    return errs;
  }

  function filterFlows(flows, opts) {
    opts = opts || {};
    var q = esc(opts.q).trim().toLowerCase();
    var tag = esc(opts.tag);
    var status = esc(opts.status);
    return flows.filter(function (f) {
      if (status && f.status !== status) return false;
      if (tag && !(f.tags || []).includes(tag)) return false;
      if (q) {
        var hay = [f.name, f.url, f.objective, (f.tags || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function uid() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---- Seed data (clearly marked samples) ---- */

  var SEED_FLOWS = [
    {
      id: 'sample-loads', name: 'Flowdeck loads and shows seeded flows',
      url: DEFAULT_URL, timeout: 120, status: 'ready',
      tags: ['smoke', 'sample'],
      objective: 'On ' + DEFAULT_URL + ': open the app and verify the header "Flowdeck" is visible, the flow list shows the 3 sample flows, and the results dashboard shows the sample result. Verify that no JavaScript error appears and every button on the page does what it says.',
      sample: true
    },
    {
      id: 'sample-draft', name: 'Draft from description generates login objectives',
      url: DEFAULT_URL, timeout: 120, status: 'ready',
      tags: ['draft', 'sample'],
      objective: 'On ' + DEFAULT_URL + ': type "user logs in with valid credentials and sees the dashboard" into the Draft from description box and click Generate drafts. Verify that at least one candidate objective appears, it mentions login and a verify clause, and saving it adds a new flow to the flow list.',
      sample: true
    },
    {
      id: 'sample-export', name: 'Export suite downloads kane-flows.json and verify.sh',
      url: DEFAULT_URL, timeout: 120, status: 'ready',
      tags: ['export', 'sample'],
      objective: 'On ' + DEFAULT_URL + ': open the Default suite and click Export kane-flows.json and Export verify.sh. Verify that both files download, the JSON lists the sample flows, and the shell script contains one kane-cli run line per flow with --agent --headless --timeout 120.',
      sample: true
    }
  ];

  var SEED_RESULT = {
    id: 'sample-result-1', flowId: 'sample-loads', sample: true,
    status: 'passed', summary: 'Sample run: app loaded, 3 sample flows visible, no JS errors.',
    objective: 'On ' + DEFAULT_URL + ': open the app and verify the header "Flowdeck" is visible…',
    credits: 42, testUrl: 'https://example.com/kane-sample-evidence',
    durationMs: 18400, steps: [
      { type: 'step_end', name: 'open app', status: 'passed' },
      { type: 'step_end', name: 'check flow list', status: 'passed' },
      { type: 'step_end', name: 'check dashboard', status: 'passed' }
    ],
    importedAt: new Date().toISOString(),
    raw: '{"type":"run_end","status":"passed","summary":"Sample run: app loaded, 3 sample flows visible, no JS errors.","credits_consumed":42,"test_url":"https://example.com/kane-sample-evidence","duration_ms":18400}'
  };

  var api = {
    DEFAULT_URL: DEFAULT_URL, PATTERNS: PATTERNS,
    draftObjectives: draftObjectives, parseKaneInput: parseKaneInput,
    kaneCommand: kaneCommand, buildVerifyScript: buildVerifyScript,
    buildFlowsExport: buildFlowsExport, validateFlow: validateFlow,
    filterFlows: filterFlows, uid: uid,
    SEED_FLOWS: SEED_FLOWS, SEED_RESULT: SEED_RESULT
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Flowdeck = api;
})(typeof self !== 'undefined' ? self : this);
