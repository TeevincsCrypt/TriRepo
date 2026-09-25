'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 4000;
const REPORTS_DIR = path.resolve(__dirname, '../reports');

// Configure marked for safe rendering
marked.setOptions({ gfm: true, breaks: false });

function readReport(name) {
  const file = path.join(REPORTS_DIR, `${name}.md`);
  try {
    const md = fs.readFileSync(file, 'utf8');
    return marked(md);
  } catch {
    return `<p class="empty">Report not yet generated. Run Pass ${name === 'lies' ? '1' : name === 'crash' ? '2' : '3'} to populate this tab.</p>`;
  }
}

// ── Proxy route ──────────────────────────────────────────────────────────────
// Allows the browser to fetch raw.githubusercontent.com files when a direct
// fetch fails due to CORS or network restrictions. Only proxies that host.
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  let parsed;
  try { parsed = new URL(url); } catch {
    return res.status(400).json({ error: 'invalid url' });
  }
  if (parsed.hostname !== 'raw.githubusercontent.com') {
    return res.status(403).json({ error: 'only raw.githubusercontent.com is proxied' });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
    }
    const text = await upstream.text();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: 'proxy fetch failed', detail: err.message });
  }
});

// ── Main page ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const lies = readReport('lies');
  const crash = readReport('crash');
  const bump = readReport('bump');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TriRepo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent-lies: #f85149;
      --accent-crash: #e3b341;
      --accent-bump: #3fb950;
      --accent-active: #58a6ff;
      --font: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      --font-prose: -apple-system, 'Segoe UI', system-ui, sans-serif;
    }

    html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-prose); font-size: 14px; line-height: 1.6; }

    /* ── Top bar ─────────────────────────────────────────── */
    .top-bar {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
    }
    .top-bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 900px;
      margin: 0 auto;
    }
    .top-bar-row .logo { font-family: var(--font); font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; white-space: nowrap; }
    .top-bar-row .logo span { color: var(--accent-active); }
    #gh-url {
      flex: 1;
      min-width: 0;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-family: var(--font-prose);
      font-size: 13px;
      padding: 7px 10px;
      outline: none;
    }
    #gh-url:focus { border-color: var(--accent-active); }
    #gh-url::placeholder { color: var(--muted); }
    .btn {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-family: var(--font-prose);
      font-size: 13px;
      font-weight: 500;
      padding: 7px 14px;
      cursor: pointer;
      white-space: nowrap;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn:hover { border-color: var(--accent-active); color: var(--accent-active); }
    .btn-primary { background: var(--accent-active); border-color: var(--accent-active); color: #0d1117; font-weight: 600; }
    .btn-primary:hover { background: #79b8ff; border-color: #79b8ff; color: #0d1117; }
    .btn-primary:disabled { background: var(--border); border-color: var(--border); color: var(--muted); cursor: not-allowed; }
    .top-bar-hint {
      max-width: 900px;
      margin: 8px auto 0;
      font-size: 12px;
      color: var(--muted);
    }
    .top-bar-hint a { color: var(--muted); text-decoration: underline; }

    /* ── Status bar ──────────────────────────────────────── */
    #status-bar {
      max-width: 900px;
      margin: 10px auto 0;
      font-size: 12px;
      min-height: 18px;
      display: none;
    }
    #status-bar.visible { display: block; }
    #status-bar.error { color: var(--accent-lies); }
    #status-bar.info  { color: var(--muted); }
    #status-bar.ok    { color: var(--accent-bump); }

    /* ── Header ─────────────────────────────────────────── */
    header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 6px 24px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    header .tagline { font-size: 11px; color: var(--muted); }

    /* ── Mode badge ──────────────────────────────────────── */
    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font);
      font-size: 11px;
      padding: 3px 9px;
      border-radius: 4px;
      font-weight: 700;
      margin-right: 10px;
    }
    .mode-badge.demo { background: #1c2333; color: var(--accent-active); border: 1px solid #30363d; }
    .mode-badge.live { background: #0d2a14; color: var(--accent-bump); border: 1px solid #1e4620; }

    /* ── Tabs ────────────────────────────────────────────── */
    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      padding: 0 24px;
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--muted);
      font-family: var(--font-prose);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      padding: 12px 20px;
      border-bottom: 2px solid transparent;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: color 0.15s;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active { color: var(--text); border-bottom-color: var(--accent-active); }
    .tab-btn .badge { font-family: var(--font); font-size: 11px; padding: 2px 6px; border-radius: 3px; font-weight: 700; }
    .tab-btn.lies-tab .badge { background: #3d1a1a; color: var(--accent-lies); }
    .tab-btn.crash-tab .badge { background: #2d2200; color: var(--accent-crash); }
    .tab-btn.bump-tab .badge { background: #0d2a14; color: var(--accent-bump); }

    /* ── Content ─────────────────────────────────────────── */
    .tab-panel { display: none; padding: 32px 24px; max-width: 900px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    /* ── Source label ────────────────────────────────────── */
    .source-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      padding: 8px 12px;
      border-radius: 5px;
      font-size: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .source-label.demo-label { border-left: 3px solid var(--accent-active); }
    .source-label.live-label { border-left: 3px solid var(--accent-bump); }
    .source-label strong { font-size: 11px; font-family: var(--font); font-weight: 700; }
    .source-label.demo-label strong { color: var(--accent-active); }
    .source-label.live-label strong { color: var(--accent-bump); }
    .source-label span { color: var(--muted); }

    /* ── Markdown styles ─────────────────────────────────── */
    .md-body h1 { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    .md-body h2 { font-size: 17px; font-weight: 600; margin: 28px 0 10px; color: var(--text); }
    .md-body h3 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .md-body p { margin-bottom: 12px; color: var(--text); }
    .md-body blockquote { border-left: 3px solid var(--accent-active); padding: 8px 16px; margin: 16px 0; background: var(--surface); border-radius: 0 4px 4px 0; }
    .md-body blockquote p { color: var(--muted); margin: 0; }
    .md-body code { font-family: var(--font); font-size: 12px; background: var(--surface); border: 1px solid var(--border); padding: 2px 5px; border-radius: 3px; color: #79c0ff; }
    .md-body pre { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px; overflow-x: auto; margin: 16px 0; }
    .md-body pre code { background: none; border: none; padding: 0; color: #e6edf3; font-size: 12px; }
    .md-body table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .md-body th { background: var(--surface); border: 1px solid var(--border); padding: 8px 12px; text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .md-body td { border: 1px solid var(--border); padding: 8px 12px; }
    .md-body tr:hover td { background: rgba(88,166,255,0.04); }
    .md-body ul, .md-body ol { margin: 8px 0 12px 20px; }
    .md-body li { margin-bottom: 4px; }
    .md-body a { color: var(--accent-active); text-decoration: none; }
    .md-body a:hover { text-decoration: underline; }
    .md-body hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
    .md-body strong { color: var(--text); font-weight: 600; }

    .empty { color: var(--muted); font-style: italic; text-align: center; padding: 40px 0; }

    /* ── Crash live input ────────────────────────────────── */
    .crash-live-section { margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid var(--border); }
    .crash-live-section h3 { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    #crash-trace {
      width: 100%;
      min-height: 130px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-family: var(--font);
      font-size: 12px;
      line-height: 1.5;
      padding: 10px 12px;
      resize: vertical;
      outline: none;
    }
    #crash-trace:focus { border-color: var(--accent-crash); }
    #crash-trace::placeholder { color: var(--muted); }
    .crash-repo-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .crash-repo-row label { font-size: 12px; color: var(--muted); white-space: nowrap; }
    #crash-repo-url {
      flex: 1;
      min-width: 0;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-family: var(--font-prose);
      font-size: 12px;
      padding: 5px 9px;
      outline: none;
    }
    #crash-repo-url:focus { border-color: var(--accent-crash); }
    #crash-repo-url::placeholder { color: var(--muted); }
    .crash-frames-out { margin-top: 14px; }
    .crash-frames-out table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .crash-frames-out th { background: var(--surface); border: 1px solid var(--border); padding: 6px 10px; text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .crash-frames-out td { border: 1px solid var(--border); padding: 6px 10px; font-family: var(--font); font-size: 12px; vertical-align: middle; }
    .crash-frames-out tr:hover td { background: rgba(88,166,255,0.04); }
    .crash-frames-out a { color: var(--accent-active); text-decoration: none; }
    .crash-frames-out a:hover { text-decoration: underline; }
    .frame-num { color: var(--muted); font-size: 11px; }
    .frame-file { color: #e6edf3; }
    .frame-line { color: var(--accent-crash); font-weight: 600; }
    .frame-fn   { color: var(--muted); font-size: 11px; }
    .crash-parse-empty { color: var(--muted); font-size: 12px; font-style: italic; padding: 12px 0; }

    /* ── Live results table ───────────────────────────────── */
    .live-results { margin-top: 4px; }
    .live-results table { width: 100%; border-collapse: collapse; margin: 0; font-size: 13px; }
    .live-results th { background: var(--surface); border: 1px solid var(--border); padding: 8px 12px; text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .live-results td { border: 1px solid var(--border); padding: 8px 12px; vertical-align: top; }
    .live-results tr:hover td { background: rgba(88,166,255,0.04); }
    .live-results code { font-family: var(--font); font-size: 12px; background: var(--surface); border: 1px solid var(--border); padding: 2px 5px; border-radius: 3px; color: #79c0ff; }
    .verdict-lie { color: var(--accent-lies); font-weight: 700; font-family: var(--font); font-size: 11px; }
    .verdict-ok  { color: var(--accent-bump); font-weight: 700; font-family: var(--font); font-size: 11px; }
    .verdict-skip { color: var(--muted); font-family: var(--font); font-size: 11px; }

    .no-findings { padding: 20px 0; color: var(--accent-bump); font-size: 13px; }
    .no-findings::before { content: "✓ "; }

    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--border); border-top-color: var(--accent-active); border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Tab accent stripe ───────────────────────────────── */
    .tab-panel.lies-panel { border-top: 3px solid var(--accent-lies); }
    .tab-panel.crash-panel { border-top: 3px solid var(--accent-crash); }
    .tab-panel.bump-panel { border-top: 3px solid var(--accent-bump); }

    /* ── Footer ──────────────────────────────────────────── */
    footer {
      text-align: center;
      padding: 20px;
      color: var(--muted);
      font-size: 11px;
      border-top: 1px solid var(--border);
      margin-top: 40px;
    }
  </style>
</head>
<body>

  <!-- ── Top bar ──────────────────────────────────────────────────────── -->
  <div class="top-bar">
    <div class="top-bar-row">
      <div class="logo">Tri<span>Repo</span></div>
      <input id="gh-url" type="url" placeholder="https://github.com/owner/repo — public repos only" autocomplete="off" spellcheck="false" />
      <button class="btn btn-primary" id="run-btn" onclick="runLive()">Run Lies check</button>
      <button class="btn" onclick="loadDemo()">Load demo</button>
    </div>
    <p class="top-bar-hint">
      Instant check runs in the browser on README + package.json (pattern-matching, no AI).
      Deep Crash/Bump analysis is IBM Bob on the full repo — see <a href="#" onclick="loadDemo();return false;">Load demo</a>.
    </p>
    <div id="status-bar"></div>
  </div>

  <!-- ── Sub-header ───────────────────────────────────────────────────── -->
  <header>
    <div class="tagline">one repo in · three truths out</div>
  </header>

  <!-- ── Tabs ─────────────────────────────────────────────────────────── -->
  <nav class="tab-bar">
    <button class="tab-btn lies-tab active" id="tab-lies" onclick="showTab('lies', this)">
      <span class="badge">LIES</span> Documentation vs Code
    </button>
    <button class="tab-btn crash-tab" id="tab-crash" onclick="showTab('crash', this)">
      <span class="badge">CRASH</span> Stack Trace → Fix
    </button>
    <button class="tab-btn bump-tab" id="tab-bump" onclick="showTab('bump', this)">
      <span class="badge">BUMP</span> Upgrade Impact
    </button>
  </nav>

  <!-- ── LIES panel ───────────────────────────────────────────────────── -->
  <div id="lies" class="tab-panel lies-panel active">
    <!-- source label, swapped by JS -->
    <div id="lies-label" class="source-label demo-label">
      <strong>DEMO</strong>
      <span>Bob deep pass · patient/ · full repo analysis by IBM Bob 2.0</span>
    </div>
    <!-- live results injected here -->
    <div id="lies-live" class="live-results" style="display:none;"></div>
    <!-- demo content always present, toggled by JS -->
    <div id="lies-demo" class="md-body">${lies}</div>
  </div>

  <!-- ── CRASH panel ──────────────────────────────────────────────────── -->
  <div id="crash" class="tab-panel crash-panel">

    <!-- ── LIVE: stack trace parser ── -->
    <div class="crash-live-section">
      <div class="source-label live-label" style="margin-bottom:14px;">
        <strong>LIVE</strong>
        <span>Parses your pasted trace, locates frames, links to source — does not diagnose the cause</span>
      </div>
      <h3>Paste a stack trace</h3>
      <textarea id="crash-trace" placeholder="Paste a Node.js (or any) stack trace here…
at calcDueDate (/app/src/services/dateService.js:39:20)
at createInvoice (/app/src/services/invoiceService.js:48:18)
TypeError: Cannot read properties of undefined"></textarea>
      <div class="crash-repo-row">
        <label for="crash-repo-url">GitHub repo (optional, for source links):</label>
        <input id="crash-repo-url" type="url" placeholder="https://github.com/owner/repo  — leave blank if you ran a Lies check above" autocomplete="off" spellcheck="false" />
        <button class="btn" style="border-color:var(--accent-crash);color:var(--accent-crash);" onclick="parseCrash()">Parse</button>
      </div>
      <div id="crash-frames-out" class="crash-frames-out"></div>
    </div>

    <!-- ── DEMO: Bob full analysis ── -->
    <div id="crash-label" class="source-label demo-label">
      <strong>DEMO</strong>
      <span>Bob deep pass · patient/ · root-cause diagnosis + fix by IBM Bob 2.0</span>
    </div>
    <div id="crash-demo" class="md-body">${crash}</div>
  </div>

  <!-- ── BUMP panel ───────────────────────────────────────────────────── -->
  <div id="bump" class="tab-panel bump-panel">

    <!-- ── LIVE: dependency inventory ── -->
    <div id="bump-live" class="live-results" style="display:none;"></div>

    <!-- ── DEMO: Bob full analysis ── -->
    <div id="bump-label" class="source-label demo-label">
      <strong>DEMO</strong>
      <span>Bob deep pass · patient/ · verified Express 4→5 breaking-change analysis by IBM Bob 2.0</span>
    </div>
    <div id="bump-demo" class="md-body">${bump}</div>
  </div>

  <footer>
    Analysis and code changes produced with IBM Bob 2.0
  </footer>

  <script>
    // ── Tab switching ────────────────────────────────────────────────────
    function showTab(name, btn) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(name).classList.add('active');
      btn.classList.add('active');
    }

    // ── Mode state ───────────────────────────────────────────────────────
    // 'demo' = server-rendered Bob reports shown, live results hidden
    // 'live' = live results shown in lies tab, demo still accessible
    let _mode = 'demo';
    let _liveRepo = null;    // { owner, repo, branch }
    let _livePkgData = null; // parsed package.json from last Lies check

    function setStatus(msg, type) {
      const el = document.getElementById('status-bar');
      el.className = 'visible ' + type;
      el.innerHTML = msg;
    }
    function clearStatus() {
      const el = document.getElementById('status-bar');
      el.className = '';
      el.textContent = '';
    }

    // ── Load demo (restore server-rendered reports) ──────────────────────
    function loadDemo() {
      _mode = 'demo';
      _liveRepo = null;
      _livePkgData = null;

      // Lies tab: hide live, show demo
      document.getElementById('lies-live').style.display = 'none';
      document.getElementById('lies-demo').style.display = '';
      setDemoLabel('lies-label');
      setDemoLabel('crash-label');
      setDemoLabel('bump-label');

      // Reset crash live area
      document.getElementById('crash-trace').value = '';
      document.getElementById('crash-repo-url').value = '';
      document.getElementById('crash-frames-out').innerHTML = '';

      // Reset bump live area
      document.getElementById('bump-live').innerHTML = '';
      document.getElementById('bump-live').style.display = 'none';
      document.getElementById('bump-demo').style.display = '';

      clearStatus();
      document.getElementById('gh-url').value = '';
      document.getElementById('run-btn').disabled = false;
    }

    function setDemoLabel(id) {
      const el = document.getElementById(id);
      el.className = 'source-label demo-label';
      el.innerHTML = '<strong>DEMO</strong><span>Bob deep pass · patient/ · full repo analysis by IBM Bob 2.0</span>';
    }

    function setLiveLabel(id, repoSlug, branch) {
      const el = document.getElementById(id);
      el.className = 'source-label live-label';
      el.innerHTML = '<strong>LIVE</strong><span>Pattern-matching check · <code>' + esc(repoSlug) + '</code> @ ' + esc(branch) + ' · no AI involved</span>';
    }

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Parse GitHub URL ─────────────────────────────────────────────────
    function parseGitHubUrl(raw) {
      raw = raw.trim();
      // Accept: https://github.com/owner/repo or github.com/owner/repo
      const m = raw.match(/(?:https?:\\/\\/)?github\\.com\\/([^\\/]+)\\/([^\\/\\s#?]+)/);
      if (!m) return null;
      return { owner: m[1], repo: m[2].replace(/\\.git$/, '') };
    }

    // ── Fetch with proxy fallback ─────────────────────────────────────────
    async function fetchRaw(owner, repo, branch, file) {
      const rawUrl = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + branch + '/' + file;
      // Try direct first
      try {
        const r = await fetch(rawUrl);
        if (r.ok) return { text: await r.text(), branch };
        if (r.status === 404) return { notFound: true, status: r.status };
      } catch (_) {
        // CORS or network — fall through to proxy
      }
      // Proxy fallback
      try {
        const r = await fetch('/api/proxy?url=' + encodeURIComponent(rawUrl));
        if (r.ok) return { text: await r.text(), branch, viaProxy: true };
        if (r.status === 404) return { notFound: true, status: r.status };
        return { error: 'proxy returned ' + r.status };
      } catch (e) {
        return { error: e.message };
      }
    }

    // Try main then master branch; return { text, branch, viaProxy? } or { error }
    async function fetchFile(owner, repo, file) {
      for (const branch of ['main', 'master']) {
        const result = await fetchRaw(owner, repo, branch, file);
        if (result.text !== undefined) return result;
        if (result.error) return result;
        // notFound on this branch → try next
      }
      return { notFound: true };
    }

    // ── Deterministic checks ─────────────────────────────────────────────
    // Returns array of { check, claim, reality, verdict }
    function runChecks(readmeText, contributingText, pkgText) {
      const findings = [];

      let pkg;
      try { pkg = JSON.parse(pkgText); } catch (e) {
        findings.push({ check: 'package.json', claim: '(parse error)', reality: e.message, verdict: 'SKIP' });
        return findings;
      }

      const scripts = pkg.scripts || {};
      const engines = pkg.engines || {};

      // ── Check 1: script names mentioned in docs vs package.json.scripts ──
      // Collect all "npm run <name>" patterns from README + CONTRIBUTING
      const docSources = [];
      if (readmeText) docSources.push({ file: 'README.md', text: readmeText });
      if (contributingText) docSources.push({ file: 'CONTRIBUTING.md', text: contributingText });

      const seenScripts = new Set();
      for (const { file, text } of docSources) {
        // Match: npm run foo, yarn foo (non-standard), pnpm run foo
        const patterns = [
          /npm\\s+run\\s+([\\w:.-]+)/g,
          /yarn\\s+run\\s+([\\w:.-]+)/g,
          /pnpm\\s+run\\s+([\\w:.-]+)/g,
        ];
        for (const re of patterns) {
          let m;
          while ((m = re.exec(text)) !== null) {
            const name = m[1];
            // skip built-ins: install, test (bare), start, publish, etc. that npm handles without a scripts entry
            if (['install','publish','pack','version','init'].includes(name)) continue;
            const key = name + '|' + file;
            if (seenScripts.has(key)) continue;
            seenScripts.add(key);
            const exists = Object.prototype.hasOwnProperty.call(scripts, name);
            findings.push({
              check: 'npm script',
              claim: file + ': <code>npm run ' + esc(name) + '</code>',
              reality: exists
                ? '<code>' + esc(name) + '</code> exists in package.json'
                : 'No <code>' + esc(name) + '</code> script in package.json — available: ' + Object.keys(scripts).map(s=>'<code>'+esc(s)+'</code>').join(', '),
              verdict: exists ? 'OK' : 'LIE',
            });
          }
        }
      }

      // Also check bare "npm start", "npm test" (no "run") — these don't need a scripts entry to work
      // but if docs say "npm serve" that's wrong; only flag "npm run X" patterns

      // ── Check 2: Node version ──────────────────────────────────────────
      const nodeEngines = engines.node || '';
      if (nodeEngines) {
        for (const { file, text } of docSources) {
          // Match: Node.js >= X, Node >= X, node >= X, requires Node X
          const vRe = /[Nn]ode(?:\\.js)?\\s*[>= ]+([\\d]+(?:\\.[\\d]+)*)/g;
          let m;
          const seenVers = new Set();
          while ((m = vRe.exec(text)) !== null) {
            const docVer = m[1];
            if (seenVers.has(docVer + file)) continue;
            seenVers.add(docVer + file);
            // Normalise: strip leading >=/<= from engines for comparison
            const engMatch = nodeEngines.match(/([\\d]+(?:\\.[\\d]+)*)/);
            const engVer = engMatch ? engMatch[1] : '';
            const matches = engVer && docVer === engVer;
            findings.push({
              check: 'Node version',
              claim: file + ': Node.js >= ' + esc(docVer),
              reality: 'package.json engines.node: <code>' + esc(nodeEngines) + '</code>',
              verdict: matches ? 'OK' : 'LIE',
            });
          }
        }
      }

      // ── Check 3: Port references ───────────────────────────────────────
      // Only if package.json has a "port" or "PORT" key at top level, or
      // a "config" object — skip if not straightforward as specified
      const pkgPort = pkg.config && pkg.config.port ? String(pkg.config.port) : null;
      if (pkgPort) {
        for (const { file, text } of docSources) {
          const portRe = /localhost:(\\d{3,5})/g;
          let m;
          while ((m = portRe.exec(text)) !== null) {
            const docPort = m[1];
            findings.push({
              check: 'port (config)',
              claim: file + ': <code>localhost:' + esc(docPort) + '</code>',
              reality: 'package.json config.port: <code>' + esc(pkgPort) + '</code>',
              verdict: docPort === pkgPort ? 'OK' : 'LIE',
            });
          }
        }
      }

      return findings;
    }

    // ── Render live results ──────────────────────────────────────────────
    function renderLiveResults(findings, owner, repo, branch) {
      const container = document.getElementById('lies-live');

      if (findings.length === 0) {
        container.innerHTML = '<p class="no-findings">No contradictions found between docs and package.json for this repo.</p><p style="color:var(--muted);font-size:12px;margin-top:8px;">Note: this is a fast pattern-matching check on README + CONTRIBUTING + package.json only. It does not read source code. Use IBM Bob for a deep analysis.</p>';
        return;
      }

      const lies   = findings.filter(f => f.verdict === 'LIE');
      const oks    = findings.filter(f => f.verdict === 'OK');
      const skips  = findings.filter(f => f.verdict === 'SKIP');

      let html = '';

      // Summary
      html += '<p style="margin-bottom:16px;font-size:13px;color:var(--muted);">';
      html += '<strong style="color:var(--text);">' + findings.length + ' check' + (findings.length===1?'':'s') + ' run</strong> — ';
      html += '<span style="color:var(--accent-lies);">' + lies.length + ' contradiction' + (lies.length===1?'':'s') + '</span>, ';
      html += '<span style="color:var(--accent-bump);">' + oks.length + ' confirmed</span>';
      if (skips.length) html += ', <span style="color:var(--muted);">' + skips.length + ' skipped</span>';
      html += '.</p>';

      html += '<table><thead><tr><th>#</th><th>Check</th><th>Claim (docs say…)</th><th>Reality (package.json)</th><th>Verdict</th></tr></thead><tbody>';

      findings.forEach((f, i) => {
        const verdictHtml = f.verdict === 'LIE'
          ? '<span class="verdict-lie">LIE</span>'
          : f.verdict === 'OK'
          ? '<span class="verdict-ok">OK</span>'
          : '<span class="verdict-skip">SKIP</span>';
        html += '<tr>';
        html += '<td style="color:var(--muted);font-family:var(--font);font-size:11px;">' + (i+1) + '</td>';
        html += '<td><code>' + esc(f.check) + '</code></td>';
        html += '<td>' + f.claim + '</td>';
        html += '<td>' + f.reality + '</td>';
        html += '<td>' + verdictHtml + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      html += '<p style="margin-top:16px;font-size:11px;color:var(--muted);">Pattern-matching only — no AI. Checks: npm script names, Node version, port (if in package.json config). For full analysis including source code, use IBM Bob — see Load demo.</p>';

      container.innerHTML = html;
    }

    // ── Run live check ───────────────────────────────────────────────────
    async function runLive() {
      const rawUrl = document.getElementById('gh-url').value.trim();
      if (!rawUrl) {
        setStatus('Enter a GitHub repository URL first.', 'error');
        return;
      }
      const parsed = parseGitHubUrl(rawUrl);
      if (!parsed) {
        setStatus('Could not parse owner/repo from that URL. Expected: https://github.com/owner/repo', 'error');
        return;
      }

      const { owner, repo } = parsed;
      const repoSlug = owner + '/' + repo;

      document.getElementById('run-btn').disabled = true;
      setStatus('<span class="spinner"></span>Fetching ' + esc(repoSlug) + '…', 'info');

      // Fetch package.json first to determine branch
      const pkgResult = await fetchFile(owner, repo, 'package.json');
      if (pkgResult.notFound || pkgResult.error) {
        setStatus('Could not fetch package.json for <strong>' + esc(repoSlug) + '</strong>. Is this a public repo with package.json at the root?', 'error');
        document.getElementById('run-btn').disabled = false;
        return;
      }

      const branch = pkgResult.branch;
      _liveRepo = { owner, repo, branch };
      // Cache parsed package.json for Bump tab
      try { _livePkgData = JSON.parse(pkgResult.text); } catch (_) { _livePkgData = null; }

      setStatus('<span class="spinner"></span>Fetching README + CONTRIBUTING…', 'info');

      // Fetch README and CONTRIBUTING (best-effort — missing is OK)
      const [readmeResult, contribResult] = await Promise.all([
        fetchRaw(owner, repo, branch, 'README.md'),
        fetchRaw(owner, repo, branch, 'CONTRIBUTING.md'),
      ]);

      const readmeText   = readmeResult.text   || '';
      const contributingText = contribResult.text || '';
      const pkgText      = pkgResult.text;

      if (!readmeText) {
        setStatus('Note: README.md not found — checking package.json scripts only.', 'info');
      }

      // Run checks
      const findings = runChecks(readmeText, contributingText, pkgText);

      // Switch to live mode
      _mode = 'live';
      renderLiveResults(findings, owner, repo, branch);
      document.getElementById('lies-live').style.display = '';
      document.getElementById('lies-demo').style.display = 'none';
      setLiveLabel('lies-label', repoSlug, branch);
      // Crash label stays demo (trace parser is always live, but Bob demo is below)
      setDemoLabel('crash-label');
      // Bump: render live dep list
      renderBumpLive(repoSlug, branch);

      // Activate lies tab
      showTab('lies', document.getElementById('tab-lies'));

      const viaProxy = pkgResult.viaProxy || readmeResult.viaProxy || contribResult.viaProxy;
      const lies = findings.filter(f => f.verdict === 'LIE').length;
      setStatus(
        (viaProxy ? '(via server proxy) ' : '') +
        'Check complete for <strong>' + esc(repoSlug) + '</strong> @ ' + esc(branch) + '. ' +
        (lies > 0
          ? '<span style="color:var(--accent-lies);">' + lies + ' contradiction' + (lies===1?'':'s') + ' found.</span>'
          : '<span style="color:var(--accent-bump);">No contradictions found.</span>'),
        'ok'
      );
      document.getElementById('run-btn').disabled = false;
    }

    // ── Render Bump live: dependency inventory ───────────────────────────
    function renderBumpLive(repoSlug, branch) {
      const container = document.getElementById('bump-live');
      const demoEl    = document.getElementById('bump-demo');

      if (!_livePkgData) {
        container.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px 0;">Run a Lies check first to load a repo\'s dependencies here.</p>';
        container.style.display = '';
        demoEl.style.display = 'none';
        // Label
        const lbl = document.getElementById('bump-label');
        lbl.className = 'source-label live-label';
        lbl.innerHTML = '<strong>LIVE</strong><span>Dependency list only — no breaking-change analysis · <code>' + esc(repoSlug) + '</code> · no AI involved</span>';
        return;
      }

      const deps    = _livePkgData.dependencies    || {};
      const devDeps = _livePkgData.devDependencies  || {};
      const peerDeps = _livePkgData.peerDependencies || {};
      const allDeps = [
        ...Object.entries(deps).map(([n,v])    => ({ name: n, version: v, kind: 'dep' })),
        ...Object.entries(devDeps).map(([n,v]) => ({ name: n, version: v, kind: 'dev' })),
        ...Object.entries(peerDeps).map(([n,v])=> ({ name: n, version: v, kind: 'peer' })),
      ];

      let html = '';

      // Label
      const lbl = document.getElementById('bump-label');
      lbl.className = 'source-label live-label';
      lbl.innerHTML = '<strong>LIVE</strong><span>Dependency list only — no breaking-change analysis · <code>' + esc(repoSlug) + '</code> · no AI involved</span>';

      if (allDeps.length === 0) {
        html = '<p style="color:var(--muted);font-size:13px;padding:16px 0;">No dependencies declared in package.json.</p>';
      } else {
        html += '<p style="font-size:13px;color:var(--muted);margin-bottom:14px;">';
        html += '<strong style="color:var(--text);">' + allDeps.length + ' package' + (allDeps.length===1?'':'s') + '</strong>';
        html += ' declared in <code>' + esc(repoSlug) + '</code>';
        if (_livePkgData.name)    html += ' · <code>' + esc(_livePkgData.name) + '</code>';
        if (_livePkgData.version) html += ' v' + esc(_livePkgData.version);
        html += '. No upgrade analysis — see Demo for Bob\'s verified Express 4→5 report.</p>';

        html += '<table><thead><tr><th>Package</th><th>Declared range</th><th>Type</th></tr></thead><tbody>';
        allDeps.forEach(d => {
          const kindLabel = d.kind === 'dep' ? 'dependency' : d.kind === 'dev' ? 'devDependency' : 'peerDependency';
          const kindColor = d.kind === 'dep' ? 'var(--text)' : 'var(--muted)';
          html += '<tr>';
          html += '<td><code>' + esc(d.name) + '</code></td>';
          html += '<td><code style="color:var(--accent-bump);">' + esc(d.version) + '</code></td>';
          html += '<td style="color:' + kindColor + ';font-size:12px;">' + kindLabel + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
        html += '<p style="margin-top:14px;font-size:11px;color:var(--muted);">Dependency inventory only — declared ranges, not installed versions. No breaking-change analysis. For full upgrade-impact analysis using IBM Bob, see the Demo report below.</p>';
      }

      container.innerHTML = html;
      container.style.display = '';
      demoEl.style.display = '';  // keep demo visible below the live section
    }

    // ── Parse stack trace ────────────────────────────────────────────────
    // Extracts { fn, file, line, col } from Node.js-style and generic frames.
    function parseStackTrace(raw) {
      const frames = [];
      const seen = new Set();
      const lines = raw.split('\\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Node.js style: "at functionName (path/to/file.js:42:15)"
        // or:            "at path/to/file.js:42:15"
        const nodeStyle = trimmed.match(
          /^at\\s+(?:([^(]+?)\\s+\\()?([^()\\s]+?\\.(?:js|ts|mjs|cjs|jsx|tsx|py|rb|go|java|cs|cpp|c|rs|php|swift|kt)(?::[\\d]+)*)/i
        );
        if (nodeStyle) {
          const fn   = (nodeStyle[1] || '').trim() || null;
          const rest = nodeStyle[2];
          const parts = rest.split(':');
          // Last two numeric segments are line:col; file is everything before
          let filePath = rest, lineNum = null, colNum = null;
          if (parts.length >= 2 && /^\\d+$/.test(parts[parts.length - 1])) {
            colNum = parts.pop();
          }
          if (parts.length >= 2 && /^\\d+$/.test(parts[parts.length - 1])) {
            lineNum = parts.pop();
            filePath = parts.join(':');
          }
          if (filePath && lineNum) {
            // Strip leading internal paths like /app/ or /home/runner/...
            const cleanPath = filePath.replace(/^.*?(?:src\\/|lib\\/|app\\/|home\\/[^/]+\\/[^/]+\\/)/, '').replace(/^\\//,'');
            const key = cleanPath + ':' + lineNum;
            if (!seen.has(key)) { seen.add(key); frames.push({ fn, file: cleanPath, rawFile: filePath, line: lineNum }); }
          }
          continue;
        }

        // Generic fallback: any "path/to/file.ext:NUMBER" anywhere in the line
        const generic = trimmed.match(/([\\w./\\\\-]+\\.(?:js|ts|mjs|cjs|jsx|tsx|py|rb|go|java|cs|cpp|c|rs|php|swift|kt)):(\\d+)/i);
        if (generic) {
          const filePath = generic[1].replace(/^\\//,'');
          const lineNum  = generic[2];
          const key = filePath + ':' + lineNum;
          if (!seen.has(key)) { seen.add(key); frames.push({ fn: null, file: filePath, rawFile: filePath, line: lineNum }); }
        }
      }
      return frames;
    }

    function parseCrash() {
      const raw = document.getElementById('crash-trace').value;
      const out = document.getElementById('crash-frames-out');

      if (!raw.trim()) {
        out.innerHTML = '';
        return;
      }

      const frames = parseStackTrace(raw);

      if (frames.length === 0) {
        out.innerHTML = '<p class="crash-parse-empty">No file:line references found. Paste a stack trace with frame lines like:<br><code>at functionName (/path/to/file.js:42:15)</code></p>';
        return;
      }

      // Determine repo context: use _liveRepo if set, else try the local crash-repo-url field
      let repoCtx = _liveRepo;
      if (!repoCtx) {
        const localUrl = document.getElementById('crash-repo-url').value.trim();
        if (localUrl) {
          const p = parseGitHubUrl(localUrl);
          if (p) repoCtx = { owner: p.owner, repo: p.repo, branch: 'main' };
        }
      }

      let html = '<p style="font-size:12px;color:var(--muted);margin-bottom:10px;">';
      html += frames.length + ' frame' + (frames.length===1?'':'s') + ' found';
      if (repoCtx) html += ' — linked to <code>' + esc(repoCtx.owner+'/'+repoCtx.repo) + '</code> @ ' + esc(repoCtx.branch);
      else html += ' — no repo URL set, showing paths only';
      html += '.</p>';

      html += '<table><thead><tr><th>#</th><th>Function</th><th>File</th><th>Line</th></tr></thead><tbody>';
      frames.forEach((f, i) => {
        let fileCell;
        if (repoCtx) {
          const ghUrl = 'https://github.com/' + repoCtx.owner + '/' + repoCtx.repo
            + '/blob/' + repoCtx.branch + '/' + f.file + '#L' + f.line;
          fileCell = '<a href="' + esc(ghUrl) + '" target="_blank" rel="noopener" class="frame-file">' + esc(f.file) + '</a>';
        } else {
          fileCell = '<span class="frame-file">' + esc(f.file) + '</span>';
        }
        html += '<tr>';
        html += '<td class="frame-num">' + (i+1) + '</td>';
        html += '<td class="frame-fn">' + (f.fn ? esc(f.fn) : '<span style="color:var(--border)">—</span>') + '</td>';
        html += '<td>' + fileCell + '</td>';
        html += '<td class="frame-line">' + esc(f.line) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';

      out.innerHTML = html;
    }

    // ── Enter key on URL input ───────────────────────────────────────────
    document.getElementById('gh-url').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') runLive();
    });

    // Enter key in crash repo url field
    document.getElementById('crash-repo-url').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') parseCrash();
    });
  </script>

</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`TriRepo UI listening on http://localhost:${PORT}`);
});
