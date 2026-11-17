/* Flowdeck self-tests — run: node tests/test.js (exit 0 = all pass). */
const F = require('../app.js');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// --- Draft engine ---
const login = F.draftObjectives('user logs in, adds an item to cart, checks out', 'https://example.com');
t('draft: login desc yields >=2 candidates', login.length >= 2, 'got ' + login.length);
t('draft: first candidate is login', login[0].id === 'login', 'got ' + login[0].id);
t('draft: login objective has verify clause', /verify that/i.test(login[0].objective));
t('draft: checkout candidate present', login.some(d => d.id === 'checkout'));
t('draft: objective embeds target URL', login[0].objective.includes('https://example.com'));

const search = F.draftObjectives('search for red shoes and open the first result', 'https://example.com');
t('draft: search candidate first', search[0].id === 'search');
t('draft: search extracts query', search[0].objective.includes('red shoes'), search[0].objective);

const unknown = F.draftObjectives('the widget should frobnicate the gizmo', 'https://example.com');
t('draft: unknown desc falls back to generic', unknown.length === 1 && unknown[0].id === 'generic');
t('draft: generic still has verify clause', /verify that/i.test(unknown[0].objective));
t('draft: empty desc yields no candidates', F.draftObjectives('  ', 'https://example.com').length === 0);

const multi = F.draftObjectives('filter the list, then sort by price, then go to the next page', 'https://example.com');
t('draft: multi-keyword desc yields 3 candidates', multi.length === 3, 'got ' + multi.length);
t('draft: multi order follows description order', eq(multi.map(d => d.id), ['filter', 'sort', 'pagination']), multi.map(d => d.id).join(','));

// --- Kane NDJSON parsing ---
const ndjson = [
  '{"type":"run_start","objective":"On https://example.com: login"}',
  '{"type":"step_end","name":"open login page","status":"passed"}',
  '{"type":"step_end","name":"submit credentials","status":"passed"}',
  '{"type":"run_end","status":"passed","summary":"Login succeeded, dashboard visible.","credits_consumed":42,"test_url":"https://example.com/evidence/1","duration_ms":18400}',
  'not json at all',
  '{"type":"run_end","status":"failed","summary":"Checkout button not found.","credits_consumed":17,"test_url":"https://example.com/evidence/2"}'
].join('\n');
const parsed = F.parseKaneInput(ndjson);
t('parse: 2 runs found', parsed.runs.length === 2, 'got ' + parsed.runs.length);
t('parse: first run passed, credits 42', parsed.runs[0].status === 'passed' && parsed.runs[0].credits === 42);
t('parse: first run test_url kept', parsed.runs[0].testUrl === 'https://example.com/evidence/1');
t('parse: first run has 2 steps', parsed.runs[0].steps.length === 2, 'got ' + parsed.runs[0].steps.length);
t('parse: second run failed', parsed.runs[1].status === 'failed');
t('parse: bad line reported, not fatal', parsed.errors.length === 1, JSON.stringify(parsed.errors));

const single = F.parseKaneInput('{"status":"passed","summary":"ok","credits_consumed":5,"test_url":"https://x.test/r"}');
t('parse: single JSON object works', single.runs.length === 1 && single.runs[0].status === 'passed');
const bad = F.parseKaneInput('hello world');
t('parse: garbage input yields errors, no runs', bad.runs.length === 0 && bad.errors.length > 0);
const empty = F.parseKaneInput('   ');
t('parse: empty input errors', empty.runs.length === 0 && empty.errors.length > 0);

// --- kane-cli command + exports ---
const flow = { name: 'Login', url: 'https://example.com', objective: 'On https://example.com: log in. Verify that the dashboard appears.', timeout: 90 };
const cmd = F.kaneCommand(flow);
t('cmd: exact shape', cmd === 'kane-cli run "On https://example.com: log in. Verify that the dashboard appears." --agent --headless --timeout 90', cmd);
const flowNoUrl = { name: 'X', url: 'https://example.com', objective: 'do the thing. Verify that it works.', timeout: 120 };
t('cmd: URL prepended when objective lacks it', F.kaneCommand(flowNoUrl).includes('On https://example.com: do the thing'));
const tricky = { name: 'X', url: 'https://example.com', objective: 'On https://example.com: click "Buy" and pay $5. Verify that it works.', timeout: 60 };
t('cmd: quotes and $ escaped', F.kaneCommand(tricky).includes('\\"Buy\\"') && F.kaneCommand(tricky).includes('\\$5'), F.kaneCommand(tricky));

const sh = F.buildVerifyScript('Smoke', [flow, flowNoUrl]);
t('verify.sh: one kane-cli run line per flow', (sh.match(/^kane-cli run /gm) || []).length === 2);
t('verify.sh: has shebang + install hint', sh.startsWith('#!/usr/bin/env bash') && sh.includes('npm install -g @testmuai/kane-cli'));
const exp = F.buildFlowsExport({ name: 'Smoke' }, [flow]);
t('export json: format + suite + flow fields', exp.format === 'flowdeck/kane-flows@1' && exp.suite === 'Smoke' && exp.flows[0].name === 'Login');

// --- Validation + filtering ---
t('validate: good flow passes', F.validateFlow(flow).length === 0);
t('validate: bad URL rejected', F.validateFlow({ name: 'x', url: 'not a url', objective: 'long enough objective here', timeout: 60 }).length > 0);
t('validate: short objective rejected', F.validateFlow({ name: 'x', url: 'https://example.com', objective: 'short', timeout: 60 }).length > 0);
t('validate: timeout out of range rejected', F.validateFlow({ name: 'x', url: 'https://example.com', objective: 'long enough objective here', timeout: 5 }).length > 0);
const flows = [
  { name: 'Login', url: 'https://a.test', objective: 'log in', tags: ['auth'], status: 'ready' },
  { name: 'Search', url: 'https://a.test', objective: 'search things', tags: ['search'], status: 'draft' }
];
t('filter: by tag', F.filterFlows(flows, { tag: 'auth' }).length === 1);
t('filter: by status', F.filterFlows(flows, { status: 'draft' }).length === 1);
t('filter: by text', F.filterFlows(flows, { q: 'search' }).length === 1);

// --- Seed data ---
t('seed: 3 sample flows', F.SEED_FLOWS.length === 3);
t('seed: all sample flows marked sample + valid', F.SEED_FLOWS.every(f => f.sample && F.validateFlow(f).length === 0));
t('seed: sample result is passed with credits', F.SEED_RESULT.status === 'passed' && F.SEED_RESULT.credits === 42);
t('seed: every sample flow has a verify clause', F.SEED_FLOWS.every(f => /verify that/i.test(f.objective)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
