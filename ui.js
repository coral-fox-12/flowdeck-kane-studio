/* Flowdeck — Kane Flow Studio: browser UI. State in localStorage. */
(function () {
  'use strict';
  var F = window.Flowdeck;
  var LS = { flows: 'flowdeck.flows.v1', suites: 'flowdeck.suites.v1', results: 'flowdeck.results.v1', seeded: 'flowdeck.seeded.v1' };

  function $(id) { return document.getElementById(id); }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  var state = { flows: [], suites: [], results: [], drafts: [] };

  function seedIfNeeded() {
    if (localStorage.getItem(LS.seeded)) return;
    state.flows = F.SEED_FLOWS.map(function (f) { return Object.assign({}, f, { tags: f.tags.slice() }); });
    state.suites = [{ id: 'suite-default', name: 'Default suite', flowIds: state.flows.map(function (f) { return f.id; }) }];
    state.results = [Object.assign({}, F.SEED_RESULT, { steps: F.SEED_RESULT.steps.slice() })];
    persist();
    localStorage.setItem(LS.seeded, '1');
  }
  function persist() {
    save(LS.flows, state.flows); save(LS.suites, state.suites); save(LS.results, state.results);
  }
  function loadAll() {
    state.flows = load(LS.flows, []);
    state.suites = load(LS.suites, []);
    state.results = load(LS.results, []);
    if (!state.flows.length && !localStorage.getItem(LS.seeded)) seedIfNeeded();
  }
  function flowById(id) { return state.flows.find(function (f) { return f.id === id; }); }
  function allTags() {
    var t = {};
    state.flows.forEach(function (f) { (f.tags || []).forEach(function (x) { t[x] = 1; }); });
    return Object.keys(t).sort();
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function notice(el, msg, ok) {
    el.innerHTML = '<div class="notice ' + (ok ? 'ok' : 'err') + '">' + escHtml(msg) + '</div>';
  }

  /* ---------- Flows ---------- */
  function renderFlows() {
    var q = $('search').value, tag = $('filter-tag').value, status = $('filter-status').value;
    var list = F.filterFlows(state.flows, { q: q, tag: tag, status: status });
    var tagSel = $('filter-tag');
    var cur = tagSel.value;
    tagSel.innerHTML = '<option value="">All tags</option>' + allTags().map(function (t) {
      return '<option value="' + escHtml(t) + '"' + (t === cur ? ' selected' : '') + '>' + escHtml(t) + '</option>';
    }).join('');
    $('flow-count').textContent = list.length + ' of ' + state.flows.length + ' flows';
    if (!list.length) {
      $('flow-list').innerHTML = '<p class="muted">No flows match. Clear the filters or add a flow.</p>';
      return;
    }
    $('flow-list').innerHTML = list.map(function (f) {
      var result = state.results.filter(function (r) { return r.flowId === f.id; }).slice(-1)[0];
      var statusBadge = result ? result.status : f.status;
      return '<article class="flow" data-id="' + escHtml(f.id) + '">' +
        '<h3>' + escHtml(f.name) + ' ' + (f.sample ? '<span class="badge sample">SAMPLE</span>' : '') + '</h3>' +
        '<div><span class="badge ' + escHtml(statusBadge) + '">' + escHtml(statusBadge.toUpperCase()) + '</span>' +
        (f.tags || []).map(function (t) { return '<span class="badge tag">' + escHtml(t) + '</span>'; }).join('') + '</div>' +
        '<p class="obj">' + escHtml(f.objective) + '</p>' +
        '<div class="meta">' + escHtml(f.url) + ' · timeout ' + escHtml(f.timeout) + 's</div>' +
        '<div class="toolbar">' +
        '<button class="small" data-act="edit">Edit</button>' +
        '<button class="small" data-act="copy-cmd">Copy kane-cli command</button>' +
        '<button class="small" data-act="duplicate">Duplicate</button>' +
        '<button class="small danger" data-act="delete">Delete</button>' +
        '</div></article>';
    }).join('');
  }

  function readFlowForm() {
    return {
      name: $('f-name').value.trim(),
      url: $('f-url').value.trim(),
      objective: $('f-objective').value.trim(),
      tags: $('f-tags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      timeout: parseInt($('f-timeout').value, 10) || 120,
      status: $('f-status').value
    };
  }
  function fillFlowForm(f) {
    $('f-id').value = f ? f.id : '';
    $('f-name').value = f ? f.name : '';
    $('f-url').value = f ? f.url : F.DEFAULT_URL;
    $('f-objective').value = f ? f.objective : '';
    $('f-tags').value = f ? (f.tags || []).join(', ') : '';
    $('f-timeout').value = f ? f.timeout : 120;
    $('f-status').value = f ? f.status : 'ready';
    $('form-title').textContent = f ? 'Edit flow' : 'New flow';
    $('cancel-edit').style.display = f ? '' : 'none';
  }

  function saveFlow(e) {
    e.preventDefault();
    var data = readFlowForm();
    var errs = F.validateFlow(data);
    if (errs.length) { notice($('form-msg'), errs.join(' '), false); return; }
    var id = $('f-id').value;
    if (id) {
      var f = flowById(id);
      if (f) Object.assign(f, data, { sample: false });
    } else {
      state.flows.push(Object.assign({ id: F.uid(), sample: false }, data));
    }
    persist(); fillFlowForm(null); renderFlows(); renderSuites();
    notice($('form-msg'), id ? 'Flow updated.' : 'Flow added.', true);
  }

  /* ---------- Drafts ---------- */
  function renderDrafts() {
    if (!state.drafts.length) { $('draft-list').innerHTML = ''; return; }
    $('draft-list').innerHTML = '<h3>Candidate objectives (' + state.drafts.length + ')</h3>' +
      state.drafts.map(function (d, i) {
        return '<div class="draft-card"><strong>' + escHtml(d.title) + '</strong> ' +
          (d.matched.length ? '<span class="muted">matched: ' + escHtml(d.matched.join(', ')) + '</span>' : '') +
          '<div class="toolbar"><span class="badge tag">' + escHtml(d.tags.join(', ')) + '</span></div>' +
          '<textarea id="draft-obj-' + i + '">' + escHtml(d.objective) + '</textarea>' +
          '<div class="toolbar"><button data-draft="' + i + '" data-act="save-draft">Save as flow</button>' +
          '<button class="small" data-draft="' + i + '" data-act="copy-draft">Copy objective</button></div></div>';
      }).join('');
  }
  function generateDrafts() {
    var desc = $('draft-desc').value.trim();
    var url = $('draft-url').value.trim() || F.DEFAULT_URL;
    if (!desc) { notice($('draft-msg'), 'Describe the feature first — e.g. "user logs in, adds an item to cart, checks out".', false); return; }
    state.drafts = F.draftObjectives(desc, url);
    renderDrafts();
    notice($('draft-msg'), state.drafts.length + ' candidate objective(s) generated from "' + desc.slice(0, 60) + (desc.length > 60 ? '…' : '') + '". Edit any draft, then save it as a flow.', true);
  }

  /* ---------- Suites ---------- */
  function renderSuites() {
    if (!state.suites.length) {
      $('suite-list').innerHTML = '<p class="muted">No suites yet. Create one below.</p>';
      return;
    }
    $('suite-list').innerHTML = state.suites.map(function (s) {
      var flows = s.flowIds.map(flowById).filter(Boolean);
      return '<article class="flow"><h3>' + escHtml(s.name) + ' <span class="muted">(' + flows.length + ' flows)</span></h3>' +
        '<p class="muted">' + flows.map(function (f) { return escHtml(f.name); }).join(' · ') + '</p>' +
        '<div class="toolbar">' +
        '<button class="small" data-suite="' + escHtml(s.id) + '" data-act="export-json">Export kane-flows.json</button>' +
        '<button class="small" data-suite="' + escHtml(s.id) + '" data-act="export-sh">Export verify.sh</button>' +
        '<button class="small" data-suite="' + escHtml(s.id) + '" data-act="edit-suite">Edit flows</button>' +
        '<button class="small danger" data-suite="' + escHtml(s.id) + '" data-act="delete-suite">Delete suite</button>' +
        '</div></article>';
    }).join('');
    var sel = $('suite-edit-select');
    sel.innerHTML = state.suites.map(function (s) {
      return '<option value="' + escHtml(s.id) + '">' + escHtml(s.name) + '</option>';
    }).join('');
    renderSuiteEditor();
  }
  function renderSuiteEditor() {
    var id = $('suite-edit-select').value;
    var s = state.suites.find(function (x) { return x.id === id; });
    if (!s) { $('suite-edit-box').innerHTML = ''; return; }
    $('suite-edit-box').innerHTML = state.flows.map(function (f) {
      var checked = s.flowIds.includes(f.id) ? ' checked' : '';
      return '<label style="display:block;margin:4px 0;color:var(--text)"><input type="checkbox" value="' + escHtml(f.id) + '"' + checked + '> ' + escHtml(f.name) + (f.sample ? ' <span class="badge sample">SAMPLE</span>' : '') + '</label>';
    }).join('') || '<p class="muted">No flows yet.</p>';
  }
  function saveSuiteEdit() {
    var id = $('suite-edit-select').value;
    var s = state.suites.find(function (x) { return x.id === id; });
    if (!s) return;
    s.flowIds = Array.from(document.querySelectorAll('#suite-edit-box input[type=checkbox]:checked')).map(function (c) { return c.value; });
    persist(); renderSuites();
    notice($('suite-msg'), 'Suite "' + s.name + '" updated (' + s.flowIds.length + ' flows).', true);
  }
  function createSuite() {
    var name = $('suite-name').value.trim();
    if (!name) { notice($('suite-msg'), 'Give the suite a name.', false); return; }
    state.suites.push({ id: F.uid(), name: name, flowIds: state.flows.map(function (f) { return f.id; }) });
    $('suite-name').value = '';
    persist(); renderSuites();
    notice($('suite-msg'), 'Suite "' + name + '" created with all current flows — edit its flow list below.', true);
  }

  /* ---------- Results ---------- */
  function renderResults() {
    var passed = state.results.filter(function (r) { return r.status === 'passed'; }).length;
    var failed = state.results.filter(function (r) { return r.status === 'failed'; }).length;
    var credits = state.results.reduce(function (sum, r) { return sum + (parseInt(r.credits, 10) || 0); }, 0);
    $('result-stats').innerHTML =
      '<div class="stat"><b>' + state.results.length + '</b><span>runs imported</span></div>' +
      '<div class="stat"><b>' + passed + '</b><span>passed</span></div>' +
      '<div class="stat"><b>' + failed + '</b><span>failed</span></div>' +
      '<div class="stat"><b>' + credits + '</b><span>credits consumed</span></div>';
    if (!state.results.length) {
      $('result-list').innerHTML = '<p class="muted">No results yet. Paste Kane CLI NDJSON output above and click Import results.</p>';
      return;
    }
    $('result-list').innerHTML = '<table><thead><tr><th>Flow / summary</th><th>Status</th><th>Duration</th><th>Credits</th><th>Evidence</th><th></th></tr></thead><tbody>' +
      state.results.map(function (r) {
        var f = r.flowId ? flowById(r.flowId) : null;
        var label = f ? f.name : (r.objective ? r.objective.slice(0, 60) : (r.summary || 'Unnamed run'));
        var dur = r.durationMs != null ? (Math.round(r.durationMs / 100) / 10) + 's' : '—';
        return '<tr><td>' + escHtml(label) + (r.sample ? ' <span class="badge sample">SAMPLE</span>' : '') +
          '<br><span class="muted">' + escHtml(r.summary || '') + '</span>' +
          (r.steps && r.steps.length ? '<br><span class="muted">' + r.steps.length + ' steps: ' +
            r.steps.map(function (s) { return escHtml((s.name || s.step || 'step') + ' (' + (s.status || '?') + ')'); }).join(', ') + '</span>' : '') +
          '</td><td><span class="badge ' + escHtml(r.status) + '">' + escHtml(String(r.status).toUpperCase()) + '</span></td>' +
          '<td class="mono">' + dur + '</td><td class="mono">' + (r.credits != null ? escHtml(r.credits) : '—') + '</td>' +
          '<td>' + (r.testUrl ? '<a href="' + escHtml(r.testUrl) + '" target="_blank" rel="noopener">evidence ↗</a>' : '—') + '</td>' +
          '<td><button class="small danger" data-result="' + escHtml(r.id) + '" data-act="delete-result">Delete</button></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function importResults() {
    var text = $('import-box').value.trim();
    var flowId = $('import-flow').value || null;
    var parsed = F.parseKaneInput(text);
    var msgs = [];
    if (parsed.errors.length) msgs.push(parsed.errors.join(' '));
    if (!parsed.runs.length) { notice($('import-msg'), msgs.join(' ') || 'No run result found.', false); return; }
    parsed.runs.forEach(function (r) {
      var match = flowId;
      if (!match && r.objective) {
        var hit = state.flows.find(function (f) { return r.objective.indexOf(f.name) !== -1 || f.objective.indexOf(r.objective.slice(0, 40)) !== -1; });
        if (hit) match = hit.id;
      }
      state.results.push({
        id: F.uid(), flowId: match, status: r.status, summary: r.summary,
        objective: r.objective, credits: r.credits, testUrl: r.testUrl,
        durationMs: r.durationMs, steps: r.steps, importedAt: new Date().toISOString(),
        raw: text.slice(0, 4000)
      });
    });
    $('import-box').value = '';
    persist(); renderResults(); renderFlows();
    notice($('import-msg'), 'Imported ' + parsed.runs.length + ' run(s).' + (msgs.length ? ' Notes: ' + msgs.join(' ') : ''), true);
  }
  function renderImportFlowSelect() {
    $('import-flow').innerHTML = '<option value="">Auto-match by objective (or none)</option>' +
      state.flows.map(function (f) { return '<option value="' + escHtml(f.id) + '">' + escHtml(f.name) + '</option>'; }).join('');
  }

  /* ---------- Global actions ---------- */
  function resetSamples() {
    if (!confirm('Reset everything to the 3 sample flows + 1 sample result? Your flows, suites and results will be replaced.')) return;
    localStorage.removeItem(LS.seeded);
    localStorage.removeItem(LS.flows); localStorage.removeItem(LS.suites); localStorage.removeItem(LS.results);
    seedIfNeeded(); loadAll();
    fillFlowForm(null); renderAll();
    notice($('form-msg'), 'Reset to samples.', true);
  }
  function clearAll() {
    if (!confirm('Delete ALL flows, suites and results (including samples)? This cannot be undone.')) return;
    state.flows = []; state.suites = []; state.results = [];
    localStorage.removeItem(LS.seeded);
    persist(); fillFlowForm(null); renderAll();
  }

  function renderAll() {
    renderFlows(); renderSuites(); renderResults(); renderImportFlowSelect(); renderDrafts();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadAll();
    fillFlowForm(null);
    renderAll();
    $('flow-form').addEventListener('submit', saveFlow);
    $('cancel-edit').addEventListener('click', function () { fillFlowForm(null); $('form-msg').innerHTML = ''; });
    $('search').addEventListener('input', renderFlows);
    $('filter-tag').addEventListener('change', renderFlows);
    $('filter-status').addEventListener('change', renderFlows);
    $('generate-drafts').addEventListener('click', generateDrafts);
    $('draft-desc').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generateDrafts(); });
    $('create-suite').addEventListener('click', createSuite);
    $('suite-edit-select').addEventListener('change', renderSuiteEditor);
    $('save-suite-edit').addEventListener('click', saveSuiteEdit);
    $('import-results').addEventListener('click', importResults);
    $('load-sample-import').addEventListener('click', function () {
      $('import-box').value = '{"type":"run_end","status":"passed","summary":"Sample run: app loaded, 3 sample flows visible, no JS errors.","credits_consumed":42,"test_url":"https://example.com/kane-sample-evidence","duration_ms":18400}';
    });
    $('reset-samples').addEventListener('click', resetSamples);
    $('clear-all').addEventListener('click', clearAll);
    $('export-all-json').addEventListener('click', function () {
      var suite = { name: 'All flows' };
      download('kane-flows.json', JSON.stringify(F.buildFlowsExport(suite, state.flows), null, 2), 'application/json');
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var card = btn.closest('.flow');
      if (act === 'edit' && card) fillFlowForm(flowById(card.getAttribute('data-id')));
      if (act === 'delete' && card) {
        var f = flowById(card.getAttribute('data-id'));
        if (f && confirm('Delete flow "' + f.name + '"?')) {
          state.flows = state.flows.filter(function (x) { return x.id !== f.id; });
          state.suites.forEach(function (s) { s.flowIds = s.flowIds.filter(function (id) { return id !== f.id; }); });
          persist(); renderAll();
        }
      }
      if (act === 'duplicate' && card) {
        var src = flowById(card.getAttribute('data-id'));
        if (src) {
          var copy = Object.assign({}, src, { id: F.uid(), name: src.name + ' (copy)', sample: false });
          state.flows.push(copy); persist(); renderAll();
        }
      }
      if (act === 'copy-cmd' && card) {
        var fl = flowById(card.getAttribute('data-id'));
        if (fl && navigator.clipboard) navigator.clipboard.writeText(F.kaneCommand(fl)).then(function () {
          btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy kane-cli command'; }, 1500);
        });
      }
      if (act === 'save-draft') {
        var i = parseInt(btn.getAttribute('data-draft'), 10);
        var d = state.drafts[i];
        var obj = $('draft-obj-' + i).value.trim();
        if (!d || !obj) return;
        var errs = F.validateFlow({ name: d.title, url: $('draft-url').value.trim() || F.DEFAULT_URL, objective: obj, timeout: 120 });
        if (errs.length) { notice($('draft-msg'), errs.join(' '), false); return; }
        state.flows.push({ id: F.uid(), name: d.title, url: $('draft-url').value.trim() || F.DEFAULT_URL, objective: obj, tags: d.tags.slice(), timeout: 120, status: 'ready', sample: false });
        persist(); renderAll();
        notice($('draft-msg'), 'Saved "' + d.title + '" as a flow.', true);
      }
      if (act === 'copy-draft') {
        var j = parseInt(btn.getAttribute('data-draft'), 10);
        var txt = $('draft-obj-' + j).value;
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () {
          btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy objective'; }, 1500);
        });
      }
      if (act === 'export-json' || act === 'export-sh') {
        var s = state.suites.find(function (x) { return x.id === btn.getAttribute('data-suite'); });
        if (!s) return;
        var flows = s.flowIds.map(flowById).filter(Boolean);
        if (!flows.length) { notice($('suite-msg'), 'Suite "' + s.name + '" has no flows to export.', false); return; }
        if (act === 'export-json') download('kane-flows.json', JSON.stringify(F.buildFlowsExport(s, flows), null, 2), 'application/json');
        else download('verify.sh', F.buildVerifyScript(s.name, flows), 'text/x-sh');
      }
      if (act === 'delete-suite') {
        var sid = btn.getAttribute('data-suite');
        var su = state.suites.find(function (x) { return x.id === sid; });
        if (su && confirm('Delete suite "' + su.name + '"? (Flows are kept.)')) {
          state.suites = state.suites.filter(function (x) { return x.id !== sid; });
          persist(); renderSuites();
        }
      }
      if (act === 'edit-suite') {
        $('suite-edit-select').value = btn.getAttribute('data-suite');
        renderSuiteEditor();
        $('suite-edit-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (act === 'delete-result') {
        var rid = btn.getAttribute('data-result');
        state.results = state.results.filter(function (r) { return r.id !== rid; });
        persist(); renderResults(); renderFlows();
      }
    });
  });
})();
