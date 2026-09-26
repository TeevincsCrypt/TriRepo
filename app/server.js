'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 4000;
const REPORTS_DIR = path.resolve(__dirname, '../reports');
const PATIENT_DIR = path.resolve(__dirname, '../patient');

// Live Crash/Bump tools: plain static files, kept out of the page template
// below so their regexes need no double-escaping.
app.use('/static', express.static(path.join(__dirname, 'public')));

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
// Allows the browser to fetch public GitHub files and npm registry metadata
// when a direct fetch fails due to CORS or network restrictions. Only proxies
// these exact hosts, over https.
const PROXY_HOSTS = new Set(['raw.githubusercontent.com', 'registry.npmjs.org']);

app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  let parsed;
  try { parsed = new URL(url); } catch {
    return res.status(400).json({ error: 'invalid url' });
  }
  if (parsed.protocol !== 'https:' || !PROXY_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ error: 'only raw.githubusercontent.com and registry.npmjs.org are proxied' });
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

// ── Sample trace for the live Crash tool ──────────────────────────────────────
app.get('/api/sample-trace', (req, res) => {
  fs.readFile(path.join(PATIENT_DIR, 'CRASH.txt'), 'utf8', (err, text) => {
    if (err) return res.status(404).json({ error: 'sample trace not found' });
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  });
});

// ── Landing page ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ── The clinic (three tabs) ───────────────────────────────────────────────────
app.get('/app', (req, res) => {
  const lies = readReport('lies');
  const crash = readReport('crash');
  const bump = readReport('bump');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TriRepo · Clinic</title>
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="/static/site.css">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/live-tools.css">
</head>
<body class="app-page">

  <!-- ── Navigation ───────────────────────────────────────────────────── -->
  <header class="site-nav">
    <a class="brand" href="/" aria-label="TriRepo home">
      <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 6 6.5 20.5h15z" fill="none" stroke="#b8ead0" stroke-width="2.2" stroke-linejoin="round"/><circle cx="14" cy="6.5" r="4.2" fill="#16a34a"/><circle cx="6.5" cy="20.5" r="4.2" fill="#0f3d24"/><circle cx="21.5" cy="20.5" r="4.2" fill="#22c55e"/></svg>
      TriRepo
    </a>
    <nav class="nav-links" aria-label="Main">
      <a href="/#checks">Checks</a>
      <a href="/#how">How it works</a>
      <a href="https://github.com/TeevincsCrypt/TriRepo/tree/main/bob_sessions">Evidence</a>
    </nav>
    <div class="nav-actions">
      <a class="btn btn-sm" href="https://github.com/TeevincsCrypt/TriRepo">GitHub</a>
    </div>
  </header>

  <main class="app-shell">
    <div class="app-intro">
      <h1>The clinic</h1>
      <p>Check any public GitHub repo live, or read IBM Bob's deep pass on <code>patient/</code>.</p>
    </div>

    <!-- ── Repo bar (ids used by the page script) ─────────────────────── -->
    <div class="top-bar">
      <div class="top-bar-row">
        <input id="gh-url" type="url" placeholder="https://github.com/owner/repo (public repos only)" autocomplete="off" spellcheck="false" />
        <button class="btn btn-primary" id="run-btn" onclick="runLive()">Run checks</button>
        <button class="btn" onclick="loadDemo()">Load demo</button>
      </div>
      <p class="top-bar-hint">
        Live checks run in your browser, no AI: Lies compares README + package.json, Crash turns a pasted stack trace into the failing line,
        Bump flags dependencies a major version behind and finds where they're used.
        The deep analysis of patient/ is IBM Bob. See <a href="#" onclick="loadDemo();return false;">Load demo</a>.
      </p>
      <div id="status-bar"></div>
    </div>

  <!-- ── Tabs ─────────────────────────────────────────────────────────── -->
  <nav class="tab-bar" aria-label="Checks">
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
    <section id="crash-live" class="live-tool"></section>
    <div id="crash-label" class="source-label demo-label">
      <strong>DEMO</strong>
      <span>Bob deep pass · patient/ · full repo analysis by IBM Bob 2.0</span>
    </div>
    <div class="md-body">${crash}</div>
  </div>

  <!-- ── BUMP panel ───────────────────────────────────────────────────── -->
  <div id="bump" class="tab-panel bump-panel">
    <section id="bump-live" class="live-tool"></section>
    <div id="bump-label" class="source-label demo-label">
      <strong>DEMO</strong>
      <span>Bob deep pass · patient/ · full repo analysis by IBM Bob 2.0</span>
    </div>
    <div class="md-body">${bump}</div>
  </div>

  </main>

  <footer class="site-footer">
    <div>
      <a class="brand" href="/" aria-label="TriRepo home">
        <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 6 6.5 20.5h15z" fill="none" stroke="#b8ead0" stroke-width="2.2" stroke-linejoin="round"/><circle cx="14" cy="6.5" r="4.2" fill="#16a34a"/><circle cx="6.5" cy="20.5" r="4.2" fill="#0f3d24"/><circle cx="21.5" cy="20.5" r="4.2" fill="#22c55e"/></svg>
        TriRepo
      </a>
      <div class="footer-links">
        <a href="https://github.com/TeevincsCrypt/TriRepo">GitHub</a>
        <a href="https://github.com/TeevincsCrypt/TriRepo/blob/main/HACKATHON.md">HACKATHON.md</a>
        <a href="https://github.com/TeevincsCrypt/TriRepo/tree/main/bob_sessions">Bob sessions</a>
      </div>
    </div>
    <p class="credit">
      Deep analysis of patient/ and every patient/ code change: IBM Bob 2.0.
      The live Crash and Bump tools and this design were added with Claude Code after the Bob allowance ran out
      (see <a href="https://github.com/TeevincsCrypt/TriRepo/blob/main/HACKATHON.md#after-bob-live-crash-and-bump-tools">HACKATHON.md</a>).
    </p>
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
    let _liveRepo = null; // { owner, repo, branch }

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

      // Lies tab: hide live, show demo
      document.getElementById('lies-live').style.display = 'none';
      document.getElementById('lies-demo').style.display = '';
      setDemoLabel('lies-label');
      setDemoLabel('crash-label');
      setDemoLabel('bump-label');

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
      // Crash and Bump still show demo — label them clearly
      setDemoLabel('crash-label');
      setDemoLabel('bump-label');

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

    // ── Enter key on URL input ───────────────────────────────────────────
    document.getElementById('gh-url').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') runLive();
    });
  </script>
  <script src="/static/live-tools.js"></script>

</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`TriRepo UI listening on http://localhost:${PORT}`);
});
