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

    /* ── Header ─────────────────────────────────────────── */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    header .logo { font-family: var(--font); font-size: 18px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
    header .logo span { color: var(--accent-active); }
    header .patient { font-family: var(--font); font-size: 12px; color: var(--muted); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; }
    header .tagline { font-size: 12px; color: var(--muted); }

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

  <header>
    <div class="logo">Tri<span>Repo</span></div>
    <div class="patient">patient/</div>
    <div class="tagline">one repo in · three truths out</div>
  </header>

  <nav class="tab-bar">
    <button class="tab-btn lies-tab active" onclick="showTab('lies', this)">
      <span class="badge">LIES</span> Documentation vs Code
    </button>
    <button class="tab-btn crash-tab" onclick="showTab('crash', this)">
      <span class="badge">CRASH</span> Stack Trace → Fix
    </button>
    <button class="tab-btn bump-tab" onclick="showTab('bump', this)">
      <span class="badge">BUMP</span> Upgrade Impact
    </button>
  </nav>

  <div id="lies" class="tab-panel lies-panel active">
    <div class="md-body">${lies}</div>
  </div>

  <div id="crash" class="tab-panel crash-panel">
    <div class="md-body">${crash}</div>
  </div>

  <div id="bump" class="tab-panel bump-panel">
    <div class="md-body">${bump}</div>
  </div>

  <footer>
    Analysis and code changes produced with IBM Bob 2.0
  </footer>

  <script>
    function showTab(name, btn) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(name).classList.add('active');
      btn.classList.add('active');
    }
  </script>

</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`TriRepo UI listening on http://localhost:${PORT}`);
});
