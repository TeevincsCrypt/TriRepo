/*
 * TriRepo live tools: Crash (stack trace → source) and Bump (dependency radar).
 *
 * Deterministic, no AI. Runs in the visitor's browser against public GitHub
 * repos (raw.githubusercontent.com, api.github.com) and the npm registry.
 *
 * This lives in its own file, outside the server.js template literal, so the
 * regexes below need no double-escaping, and an error here cannot stop the
 * tabs or the Lies check from working.
 */
(() => {
  'use strict';

  const SAMPLE_REPO_URL = 'https://github.com/TeevincsCrypt/TriRepo';
  const SAMPLE_REPO = { owner: 'TeevincsCrypt', repo: 'TriRepo', branch: 'main' };
  const SOURCE_FILE = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|vue|svelte)$/i;
  const SKIP_PATH = /(?:^|\/)(?:node_modules|dist|build|out|coverage|vendor|\.next|\.nuxt|\.git)\/|\.min\.js$/i;
  const MAX_SCAN_FILES = 300;
  const MAX_HITS_SHOWN = 200;
  const CONCURRENCY = 6;
  const SPINNER = '<span class="spinner"></span>';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const h = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const slug = (r) => `${r.owner}/${r.repo}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function blobUrl(repo, path, line) {
    return `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}` +
      `/blob/${encPath(repo.branch)}/${encPath(path)}${line ? `#L${line}` : ''}`;
  }

  function link(href, text) {
    return `<a href="${h(href)}" target="_blank" rel="noopener">${text}</a>`;
  }

  function parseRepoUrl(raw) {
    const m = String(raw || '').trim()
      .match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(\/[^\s?#]*)?/i);
    if (!m) return null;
    const tree = (m[3] || '').match(/^\/tree\/(.+?)\/?$/);
    let branchHint = null;
    if (tree) {
      try { branchHint = decodeURIComponent(tree[1]); } catch (_) { branchHint = tree[1]; }
    }
    return { owner: m[1], repo: m[2].replace(/\.git$/i, ''), branchHint };
  }

  // The repo the Lies check found (a `let` in the page's inline script).
  function currentLiveRepo() {
    try {
      // eslint-disable-next-line no-undef
      return typeof _liveRepo !== 'undefined' && _liveRepo ? _liveRepo : null;
    } catch (_) {
      return null;
    }
  }

  function topBarRepo() {
    const input = $('gh-url');
    return input ? parseRepoUrl(input.value) : null;
  }

  function safeJson(text) {
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  async function mapPool(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        try { out[i] = await fn(items[i], i); } catch (error) { out[i] = { error }; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  // ── Fetching (cached per session) ────────────────────────────────────────
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // fetch() that retries once on a network-level failure (not on HTTP errors).
  async function fetchRetry(url, init) {
    try {
      return await fetch(url, init);
    } catch (_) {
      await sleep(400);
      return fetch(url, init);
    }
  }

  async function fetchText(url, init) {
    const res = await fetchRetry(url, init);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.text();
  }

  // Direct first; on a network/CORS failure, go through the same-origin proxy,
  // which only forwards raw.githubusercontent.com and registry.npmjs.org.
  function fetchViaProxyOnFailure(url) {
    return fetchText(url).catch((err) => {
      if (err.status) throw err; // a real HTTP answer, e.g. 404
      return fetchText(`/api/proxy?url=${encodeURIComponent(url)}`);
    });
  }

  function cached(map, key, make) {
    if (!map.has(key)) {
      const p = make();
      map.set(key, p);
      p.catch(() => map.delete(key));
    }
    return map.get(key);
  }

  const rawCache = new Map();
  function getRaw(repo, path) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(repo.owner)}/` +
      `${encodeURIComponent(repo.repo)}/${encPath(repo.branch)}/${encPath(path)}`;
    return cached(rawCache, url, () => fetchViaProxyOnFailure(url));
  }

  const treeCache = new Map();
  function getTree(repo) {
    const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/` +
      `${encodeURIComponent(repo.repo)}/git/trees/${encodeURIComponent(repo.branch)}?recursive=1`;
    return cached(treeCache, url, async () => {
      let res;
      try {
        res = await fetchRetry(url, { headers: { Accept: 'application/vnd.github+json' } });
      } catch (_) {
        const err = new Error("Couldn't reach the GitHub API (api.github.com)");
        err.network = true;
        throw err;
      }
      if (res.status === 403 || res.status === 429) {
        const err = new Error('GitHub API rate limit reached (60 requests an hour without login)');
        err.rateLimited = true;
        err.status = res.status;
        throw err;
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return {
        paths: (data.tree || []).filter((t) => t.type === 'blob').map((t) => t.path),
        truncated: Boolean(data.truncated),
      };
    });
  }

  // Pick the branch: an explicit /tree/<branch>, the one the Lies check found,
  // else main then master. Resolves to { repo, tree, treeError }.
  async function resolveRepo(parsed) {
    const live = currentLiveRepo();
    const same = live && live.owner.toLowerCase() === parsed.owner.toLowerCase() &&
      live.repo.toLowerCase() === parsed.repo.toLowerCase();
    const branches = parsed.branchHint ? [parsed.branchHint] : same ? [live.branch] : ['main', 'master'];

    for (const branch of branches) {
      const repo = { owner: parsed.owner, repo: parsed.repo, branch };
      try {
        return { repo, tree: await getTree(repo) };
      } catch (err) {
        if (err.status === 404 || err.status === 409) continue; // no such branch / empty repo
        if (!err.rateLimited && !err.network) throw err;
        // No API (rate limit or unreachable): confirm a branch with a raw file and carry on without the tree.
        for (const b of branches) {
          const r = { owner: parsed.owner, repo: parsed.repo, branch: b };
          for (const file of ['package.json', 'README.md']) {
            try {
              await getRaw(r, file);
              return { repo: r, tree: null, treeError: err };
            } catch (_) { /* try the next one */ }
          }
        }
        throw err;
      }
    }
    const err = new Error('not found');
    err.notFound = true;
    throw err;
  }

  function repoProblem(err, parsed) {
    const name = `${parsed.owner}/${parsed.repo}`;
    if (err.notFound) {
      return `Couldn't find ${name} on GitHub. It may be private, misspelled, or have no main/master branch.`;
    }
    if (err.rateLimited) return `${err.message}. Try again later.`;
    if (err.network) return `${err.message}. Check your connection and try again.`;
    return `Couldn't reach ${name} (${err.message}).`;
  }

  // ── CRASH: parse a stack trace ───────────────────────────────────────────
  const ERROR_LINE = /^\s*(?:\[[A-Za-z]+\]\s*)?(?:Uncaught\s+)?(?:\(in promise\)\s*)?((?:[A-Za-z_$][\w$]*\.)*(?:[A-Z][\w$]*?)?(?:Error|Exception))(?:\s*\[[\w-]+\])?\s*:\s*(.*\S)\s*$/;
  const JAVA_FRAME = /^\s*at\s+([\w$.<>]+)\(([^():\s]+):(\d+)\)\s*$/;
  const NODE_FRAME = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::(\d+))?\)?\s*$/;
  const PY_FRAME = /^\s*File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(.+?))?\s*$/;
  const GENERIC_FRAME = /([\w@~.\/\\:-]*[\w@~-]+\.(?:js|jsx|mjs|cjs|ts|tsx|py|rb|go|java|kt|php|cs|rs|swift|scala|exs?|c|cc|cpp|h|hpp)):(\d+)(?::(\d+))?/;

  function normalisePath(file) {
    let s = String(file).trim();
    if (/^(?:node:|internal\/)/.test(s)) return s;
    s = s.replace(/^file:\/\//i, '');
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, ''); // http(s)://host, webpack://app
    try { s = decodeURIComponent(s); } catch (_) { /* keep as is */ }
    return s.replace(/\\/g, '/').replace(/^\/?[A-Za-z]:\//, '/').replace(/[?#].*$/, '');
  }

  function frameKind(raw, path) {
    if (/^(?:node:|internal\/|<)/.test(raw) || /^(?:node:|internal\/)/.test(path)) return 'runtime';
    if (/(?:^|\/)(?:node_modules|site-packages|dist-packages|\.yarn|vendor\/bundle)\//.test(path)) return 'dependency';
    if (/(?:^|\/)(?:lib\/python\d[\d.]*|go\/src|usr\/lib|usr\/local\/lib)\//.test(path)) return 'runtime';
    return 'app';
  }

  function parseTrace(text) {
    const frames = [];
    const seen = new Set();
    let error = null;
    for (const line of String(text).split(/\r?\n/)) {
      if (!error) {
        const em = line.match(ERROR_LINE);
        if (em) {
          error = { type: em[1], message: em[2] };
          continue;
        }
      }
      let m;
      let fn = null;
      let file = null;
      let lineNo = null;
      if ((m = line.match(JAVA_FRAME))) [, fn, file, lineNo] = m;
      else if ((m = line.match(NODE_FRAME))) [, fn, file, lineNo] = m;
      else if ((m = line.match(PY_FRAME))) [, file, lineNo, fn] = m;
      else if ((m = line.match(GENERIC_FRAME))) [, file, lineNo] = m;
      else continue;

      const path = normalisePath(file);
      if (!path) continue;
      fn = fn ? fn.replace(/^async\s+/, '') : null;
      const key = `${path}:${lineNo}:${fn || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      frames.push({ fn, raw: file, path, line: Number(lineNo), kind: frameKind(file, path) });
    }
    return { error, frames };
  }

  // Match a trace path to a repo path by the longest run of shared trailing segments,
  // so /srv/app/src/x.js and C:/Users/me/proj/pkg/src/x.js both find pkg/src/x.js.
  function buildIndex(paths) {
    const byName = new Map();
    for (const p of paths) {
      const name = p.slice(p.lastIndexOf('/') + 1).toLowerCase();
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(p);
    }
    return byName;
  }

  function matchPath(framePath, index) {
    const fsegs = framePath.split('/').filter((s) => s && s !== '.');
    if (!fsegs.length) return null;
    let best = null;
    let ambiguous = false;
    for (const p of index.get(fsegs[fsegs.length - 1].toLowerCase()) || []) {
      const tsegs = p.split('/');
      let k = 0;
      while (k < tsegs.length && k < fsegs.length &&
        tsegs[tsegs.length - 1 - k].toLowerCase() === fsegs[fsegs.length - 1 - k].toLowerCase()) k++;
      if (!k) continue;
      if (!best || k > best.score) {
        best = { path: p, score: k };
        ambiguous = false;
      } else if (k === best.score) {
        ambiguous = true;
        if (p.length < best.path.length) best = { path: p, score: k };
      }
    }
    return best ? { ...best, ambiguous } : null;
  }

  // Without the tree (API rate limit or unreachable), probe raw URLs for every
  // trailing-segment suffix at once and keep the longest one that exists.
  async function probePath(repo, framePath) {
    const segs = framePath.split('/').filter((s) => s && s !== '.');
    const candidates = [];
    for (let n = Math.min(segs.length, 6); n >= 1; n--) {
      candidates.push({ path: segs.slice(segs.length - n).join('/'), score: n });
    }
    const exists = await Promise.all(candidates.map((c) => getRaw(repo, c.path).then(() => true, () => false)));
    const i = exists.indexOf(true);
    return i === -1 ? null : { ...candidates[i], ambiguous: candidates[i].score === 1 };
  }

  function findNear(lines, lineNo, re) {
    for (const d of [0, 1, -1, 2, -2, 3, -3]) {
      const n = lineNo + d;
      if (n < 1 || n > lines.length) continue;
      const m = lines[n - 1].match(re);
      if (m) return { line: n, match: m };
    }
    return null;
  }

  // Plain pattern rules on the error message (and the code, when we have it).
  function explain(error, lines, lineNo) {
    const msg = error ? error.message : '';
    let m;
    let value = null;
    let prop = null;
    if ((m = msg.match(/Cannot read propert(?:y|ies) of (undefined|null) \(reading '([^']+)'\)/))) [, value, prop] = m;
    else if ((m = msg.match(/Cannot read property '([^']+)' of (undefined|null)/))) [, prop, value] = m;
    else if ((m = msg.match(/Cannot (?:read|set) propert(?:y|ies) of (undefined|null)/))) [, value] = m;
    else if ((m = msg.match(/'NoneType' object has no attribute '([^']+)'/))) { value = 'None'; prop = m[1]; }

    if (value) {
      const hint = { kind: 'nullish', value, prop };
      if (prop && lines && lineNo) {
        const re = new RegExp(`([A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*|\\[[^\\]]*\\])*)\\s*\\??\\.\\s*${reEscape(prop)}\\b`);
        const found = findNear(lines, lineNo, re);
        if (found) {
          hint.receiver = found.match[1];
          hint.foundLine = found.line;
        }
      }
      return hint;
    }
    if ((m = msg.match(/^(.+?) is not a function\b/))) {
      const hint = { kind: 'not-fn', name: m[1] };
      if (lines && lineNo) {
        const found = findNear(lines, lineNo, new RegExp(reEscape(m[1].replace(/^\(.*\)\s*/, ''))));
        if (found) hint.foundLine = found.line;
      }
      return hint;
    }
    if ((m = msg.match(/^(\S+) is not defined\b/))) return { kind: 'not-defined', name: m[1] };
    if ((m = msg.match(/Cannot find (?:module|package) '([^']+)'/))) return { kind: 'no-module', name: m[1] };
    if (/Missing parameter name at|Unexpected [?*+(] at|pathToRegexpError/i.test(msg)) return { kind: 'path-to-regexp' };
    if (/ECONNREFUSED/.test(msg)) return { kind: 'econnrefused' };
    if (/EADDRINUSE/.test(msg)) return { kind: 'eaddrinuse' };
    if (/Unexpected token .* JSON|is not valid JSON/.test(msg)) return { kind: 'json' };
    return null;
  }

  function hintHtml(hint, origin) {
    switch (hint.kind) {
      case 'nullish': {
        let s = hint.prop
          ? `The code read <code>.${h(hint.prop)}</code> from a value that was <code>${h(hint.value)}</code>.`
          : `The code used a property of a value that was <code>${h(hint.value)}</code>.`;
        if (hint.receiver) {
          s += ` On line ${hint.foundLine} that value is <code>${h(hint.receiver)}</code>, so ` +
            `<code>${h(hint.receiver)}</code> was ${h(hint.value)} when this ran. ` +
            'Look at where it comes from: a missing argument, request field or config value.';
          if (origin && hint.foundLine !== origin.line) {
            s += `<br><span class="lt-muted">The trace points at line ${origin.line}, but that code is now on line ` +
              `${hint.foundLine}, so the file has changed since the trace was captured.</span>`;
          }
        }
        return s;
      }
      case 'not-fn':
        return `<code>${h(hint.name)}</code> was called but isn't a function. Usual causes: a wrong import or export, ` +
          'a typo, or an API removed by a dependency upgrade. The Bump tab shows which dependencies are a major version behind.';
      case 'not-defined':
        return `<code>${h(hint.name)}</code> is used but never declared or imported in that scope.`;
      case 'no-module':
        return `The module <code>${h(hint.name)}</code> couldn't be loaded: it isn't installed, the path is wrong, ` +
          'or an ES module is being loaded with require (or the reverse).';
      case 'path-to-regexp':
        return "The router's path parser rejected a route pattern. This typically appears after upgrading to Express 5 " +
          '(path-to-regexp v8): bare <code>*</code> wildcards and <code>:param?</code> optionals must be rewritten.';
      case 'econnrefused':
        return "A connection was refused: the service it calls (database, API, cache) isn't running, or the host or port in config is wrong.";
      case 'eaddrinuse':
        return 'The port is already in use: another process is listening on it, or the app was started twice.';
      case 'json':
        return "A JSON parse failed: the input (request body, file or upstream response) isn't valid JSON. Often it's an HTML error page.";
      default:
        return '';
    }
  }

  const crash = { token: 0 };

  function setCrashStatus(html, type) {
    const el = $('lt-crash-status');
    el.className = `lt-status ${type || ''}`;
    el.innerHTML = html;
  }

  async function runCrash() {
    const text = $('lt-crash-trace').value;
    const out = $('lt-crash-out');
    if (!text.trim()) {
      setCrashStatus('Paste a stack trace first.', 'error');
      return;
    }
    const trace = parseTrace(text);
    if (!trace.frames.length && !trace.error) {
      out.innerHTML = '';
      setCrashStatus("Couldn't find an error line or any file:line frames in that text.", 'error');
      return;
    }

    const token = ++crash.token;
    const button = $('lt-crash-run');
    button.disabled = true;
    const ctx = { repo: null, tree: null, notes: [] };
    try {
      const field = $('lt-crash-repo').value.trim();
      const parsed = field ? parseRepoUrl(field) : null;
      if (field && !parsed) ctx.notes.push("The repo URL doesn't look like https://github.com/owner/repo, so no code was fetched.");
      if (parsed) {
        setCrashStatus(`${SPINNER}Looking up ${h(parsed.owner)}/${h(parsed.repo)} on GitHub…`, 'info');
        try {
          const r = await resolveRepo(parsed);
          ctx.repo = r.repo;
          ctx.tree = r.tree;
          if (r.treeError) ctx.notes.push(`${r.treeError.message}; file paths were matched by probing instead.`);
          if (r.tree && r.tree.truncated) ctx.notes.push('This repo is very large; GitHub returned a partial file list.');
        } catch (err) {
          ctx.notes.push(`${repoProblem(err, parsed)} Showing the parsed frames without code.`);
        }
      }
      if (token !== crash.token) return;

      const appFrames = trace.frames.filter((f) => f.kind === 'app');
      if (ctx.repo) {
        setCrashStatus(`${SPINNER}Matching frames to files in ${h(slug(ctx.repo))}…`, 'info');
        const index = ctx.tree ? buildIndex(ctx.tree.paths) : null;
        await mapPool(appFrames.slice(0, 12), 4, async (f) => {
          f.match = index ? matchPath(f.path, index) : await probePath(ctx.repo, f.path);
        });
      }
      if (token !== crash.token) return;

      const origin = appFrames.find((f) => f.match) || appFrames[0] || null;
      let hint = explain(trace.error, null, null);
      let snippet = null;
      if (origin && origin.match && ctx.repo) {
        setCrashStatus(`${SPINNER}Fetching ${h(origin.match.path)}…`, 'info');
        try {
          const lines = (await getRaw(ctx.repo, origin.match.path)).split(/\r?\n/);
          hint = explain(trace.error, lines, origin.line) || hint;
          snippet = { lines, path: origin.match.path, line: origin.line };
        } catch (err) {
          ctx.notes.push(`Couldn't fetch ${origin.match.path} (${err.message}).`);
        }
      }
      if (token !== crash.token) return;

      out.innerHTML = renderCrash(trace, ctx, origin, snippet, hint);
      const resolved = appFrames.filter((f) => f.match).length;
      setCrashStatus(
        `${plural(trace.frames.length, 'frame')} · ${appFrames.length} in your code` +
        (ctx.repo ? ` · ${resolved} found in ${h(slug(ctx.repo))}` : ' · add a repo URL to see the code'),
        'ok'
      );
    } catch (err) {
      if (token === crash.token) setCrashStatus(`Something went wrong: ${h(err.message)}`, 'error');
      console.error('[TriRepo crash]', err);
    } finally {
      if (token === crash.token) button.disabled = false;
    }
  }

  function renderCrash(trace, ctx, origin, snippet, hint) {
    let html = '';
    if (trace.error) {
      html += `<div class="lt-card"><h4>Error</h4><div class="lt-error">${h(trace.error.type)}: ${h(trace.error.message)}</div></div>`;
    }
    const hintText = hint ? hintHtml(hint, origin) : '';
    if (hintText) {
      html += `<div class="lt-card lt-hint"><h4>What the pattern rules say <span class="lt-tag">heuristic</span></h4><p>${hintText}</p></div>`;
    }
    if (snippet) html += renderSnippet(ctx.repo, snippet, hint);
    html += renderFrames(trace.frames, ctx.repo, origin);
    for (const note of ctx.notes) html += `<p class="lt-note">${h(note)}</p>`;
    html += '<p class="lt-note">Deterministic parser, no AI. It locates the failing line and applies simple pattern rules; ' +
      "it doesn't prove the root cause. For a full diagnosis with a failing test and a fix, see IBM Bob's pass below.</p>";
    return html;
  }

  function renderSnippet(repo, snip, hint) {
    const found = hint && hint.foundLine ? hint.foundLine : null;
    const total = snip.lines.length;
    const loc = link(blobUrl(repo, snip.path, snip.line), `${h(snip.path)}:${snip.line}`);
    let html = `<div class="lt-card"><h4>Likely origin · ${loc}</h4>`;
    if (snip.line > total) {
      html += `<p class="lt-muted">Line ${snip.line} is past the end of the file (${total} lines), so it has changed since the trace was captured.</p></div>`;
      return html;
    }
    const lo = Math.max(1, Math.min(snip.line, found || snip.line) - 4);
    const hi = Math.min(total, Math.max(snip.line, found || snip.line) + 4);
    html += '<div class="lt-code">';
    for (let n = lo; n <= hi; n++) {
      const cls = n === snip.line ? ' hit' : n === found ? ' near' : '';
      html += `<div class="ln${cls}">${link(blobUrl(repo, snip.path, n), String(n)).replace('<a ', '<a class="no" ')}` +
        `<span class="src">${h(snip.lines[n - 1]) || ' '}</span></div>`;
    }
    html += `</div><p class="lt-note">Current code on <code>${h(repo.branch)}</code>. ` +
      'Red is the line in the trace' + (found && found !== snip.line ? ', amber is where the pattern rule found the call.' : '.') + '</p></div>';
    return html;
  }

  function renderFrames(frames, repo, origin) {
    if (!frames.length) return '';
    let html = '<div class="lt-card"><h4>Stack frames</h4><div class="lt-table-wrap"><table class="lt-table">' +
      '<thead><tr><th>#</th><th>Function</th><th>Location</th><th>Where</th></tr></thead><tbody>';
    frames.forEach((f, i) => {
      const segs = f.path.split('/').filter(Boolean);
      const short = segs.length > 3 ? `…/${segs.slice(-3).join('/')}` : f.path;
      let loc = `<span title="${h(f.path)}">${h(short)}:${f.line}</span>`;
      if (f.match && repo) {
        loc = link(blobUrl(repo, f.match.path, f.line), `${h(f.match.path)}:${f.line}`) +
          (f.match.ambiguous ? ' <span class="lt-muted">(best guess)</span>' : '');
      }
      const kind = f.kind === 'app' ? 'your code' : f.kind;
      const isOrigin = f === origin;
      html += `<tr class="${f.kind === 'app' ? '' : 'lt-dim'}${isOrigin ? ' lt-origin' : ''}">` +
        `<td>${i + 1}</td><td><code>${h(f.fn || '(anonymous)')}</code></td><td>${loc}</td>` +
        `<td><span class="lt-kind lt-kind-${f.kind}">${kind}</span>${isOrigin ? ' <span class="lt-tag">origin</span>' : ''}</td></tr>`;
    });
    return `${html}</tbody></table></div></div>`;
  }

  async function loadSampleCrash() {
    setCrashStatus(`${SPINNER}Loading patient/CRASH.txt…`, 'info');
    let text = null;
    try {
      text = await fetchText('/api/sample-trace');
    } catch (_) {
      try { text = await getRaw(SAMPLE_REPO, 'patient/CRASH.txt'); } catch (__) { /* handled below */ }
    }
    if (!text) {
      setCrashStatus("Couldn't load the sample trace.", 'error');
      return;
    }
    $('lt-crash-trace').value = text;
    const field = $('lt-crash-repo');
    field.value = SAMPLE_REPO_URL;
    field.dataset.auto = '0';
    runCrash();
  }

  // ── BUMP: dependency radar ───────────────────────────────────────────────
  const DEP_FIELDS = [
    ['dependencies', 'dep'],
    ['devDependencies', 'dev'],
    ['peerDependencies', 'peer'],
    ['optionalDependencies', 'optional'],
  ];
  const GAP_ORDER = { major: 0, minor: 1, patch: 2, current: 3, unknown: 4, na: 5 };
  const GAP_LABEL = { major: 'MAJOR', minor: 'minor', patch: 'patch', current: 'current', unknown: '?', na: 'n/a' };

  const bump = { token: 0, key: null, status: 'idle', repo: null, tree: null, rows: [], manifests: 0 };

  function setBumpStatus(html, type) {
    const el = $('lt-bump-status');
    el.className = `lt-status ${type || ''}`;
    el.innerHTML = html;
  }

  function isRegistrySpec(spec) {
    return !/^(?:workspace:|file:|link:|portal:|patch:|npm:|git\+|git:|github:|gitlab:|bitbucket:|https?:)/i.test(spec) &&
      !/^[\w.-]+\/[\w.-]+(?:#.*)?$/.test(spec);
  }

  function parseSpec(spec) {
    const s = spec.trim();
    if (!s || s === '*' || /^(?:x|latest|next)$/i.test(s)) return null;
    const m = s.match(/(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/i);
    if (!m) return null;
    const num = (v) => (v === undefined || /^[x*]$/i.test(v) ? null : Number(v));
    return { major: Number(m[1]), minor: num(m[2]), patch: num(m[3]) };
  }

  function parseVersion(v) {
    const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
  }

  function versionGap(d, l) {
    if (!d || !l) return 'unknown';
    if (l.major > d.major) return 'major';
    if (l.major < d.major) return 'current';
    // Under semver, a minor bump on 0.x is a breaking change.
    if (d.major === 0 && d.minor != null && l.minor > d.minor) return 'major';
    if (d.minor == null || l.minor < d.minor) return 'current';
    if (l.minor > d.minor) return 'minor';
    if (d.patch == null || l.patch <= d.patch) return 'current';
    return 'patch';
  }

  const latestCache = new Map();
  function getLatest(name) {
    const url = `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`;
    return cached(latestCache, url, async () => {
      const data = safeJson(await fetchViaProxyOnFailure(url));
      if (!data || !data.version) throw new Error('no version in registry response');
      return data.version;
    });
  }

  function globToRe(glob) {
    const body = glob.split('/')
      .map((seg) => (seg === '**' ? '.*' : reEscape(seg).replace(/\\\*/g, '[^/]*').replace(/\\\?/g, '[^/]')))
      .join('/');
    return new RegExp(`^${body}$`);
  }

  async function loadManifests(repo, tree) {
    let rootText;
    try {
      rootText = await getRaw(repo, 'package.json');
    } catch (err) {
      if (err.status === 404) {
        const e = new Error(`No package.json at the root of ${slug(repo)}. The dependency radar supports npm projects.`);
        e.friendly = true;
        throw e;
      }
      throw err;
    }
    const root = safeJson(rootText);
    if (!root) {
      const e = new Error("The root package.json isn't valid JSON.");
      e.friendly = true;
      throw e;
    }
    const manifests = [{ dir: '', pkg: root }];

    // Monorepos: follow "workspaces" (array, or { packages: [...] }).
    let ws = root.workspaces;
    if (ws && !Array.isArray(ws)) ws = Array.isArray(ws.packages) ? ws.packages : [];
    const dirs = new Set();
    for (const pattern of (ws || []).slice(0, 30)) {
      if (typeof pattern !== 'string' || pattern.startsWith('!')) continue;
      const clean = pattern.replace(/^\.\//, '').replace(/\/+$/, '');
      if (/[*?]/.test(clean)) {
        if (!tree) continue;
        const re = globToRe(clean);
        for (const p of tree.paths) {
          if (!p.endsWith('/package.json') || SKIP_PATH.test(p)) continue;
          const dir = p.slice(0, -'/package.json'.length);
          if (re.test(dir)) dirs.add(dir);
        }
      } else if (clean) {
        dirs.add(clean);
      }
    }
    const loaded = await mapPool(Array.from(dirs).slice(0, 25), CONCURRENCY, async (dir) => {
      const pkg = safeJson(await getRaw(repo, `${dir}/package.json`));
      return pkg ? { dir, pkg } : null;
    });
    for (const m of loaded) if (m && m.pkg) manifests.push(m);
    return manifests;
  }

  function buildRows(manifests) {
    const rows = [];
    for (const m of manifests) {
      for (const [field, type] of DEP_FIELDS) {
        const deps = m.pkg[field];
        if (!deps || typeof deps !== 'object') continue;
        for (const name of Object.keys(deps)) {
          rows.push({ dir: m.dir, name, type, spec: String(deps[name]), latest: null, gap: 'na' });
        }
      }
    }
    return rows;
  }

  async function runBump(userInitiated) {
    const live = currentLiveRepo();
    const parsed = topBarRepo() || (live ? { owner: live.owner, repo: live.repo, branchHint: live.branch } : null);
    if (!parsed) {
      if (userInitiated) setBumpStatus('Enter a GitHub URL in the top bar first.', 'error');
      return;
    }
    const key = `${parsed.owner}/${parsed.repo}@${parsed.branchHint || ''}`.toLowerCase();
    if (!userInitiated && bump.key === key && (bump.status === 'loading' || bump.status === 'done')) return;

    const token = ++bump.token;
    Object.assign(bump, { key, status: 'loading', repo: null, tree: null, rows: [], manifests: 0 });
    $('lt-bump-out').innerHTML = '';
    $('lt-bump-usages').innerHTML = '';
    const button = $('lt-bump-run');
    button.disabled = true;
    const stale = () => token !== bump.token;

    try {
      setBumpStatus(`${SPINNER}Looking up ${h(parsed.owner)}/${h(parsed.repo)} on GitHub…`, 'info');
      let resolved;
      try {
        resolved = await resolveRepo(parsed);
      } catch (err) {
        const e = new Error(repoProblem(err, parsed));
        e.friendly = true;
        throw e;
      }
      if (stale()) return;
      bump.repo = resolved.repo;
      bump.tree = resolved.tree;

      setBumpStatus(`${SPINNER}Reading package.json…`, 'info');
      const manifests = await loadManifests(resolved.repo, resolved.tree);
      if (stale()) return;
      bump.manifests = manifests.length;
      const rows = buildRows(manifests);
      bump.rows = rows;

      const names = Array.from(new Set(rows.filter((r) => isRegistrySpec(r.spec)).map((r) => r.name)));
      let done = 0;
      const latest = new Map();
      await mapPool(names, CONCURRENCY, async (name) => {
        try {
          latest.set(name, await getLatest(name));
        } finally {
          done++;
          if (!stale()) setBumpStatus(`${SPINNER}Checking npm: ${done}/${names.length} packages…`, 'info');
        }
      });
      if (stale()) return;

      for (const r of rows) {
        if (!isRegistrySpec(r.spec)) continue;
        r.latest = latest.get(r.name) || null;
        r.gap = r.latest ? versionGap(parseSpec(r.spec), parseVersion(r.latest)) : 'unknown';
      }
      rows.sort((a, b) => GAP_ORDER[a.gap] - GAP_ORDER[b.gap] || a.name.localeCompare(b.name) || a.dir.localeCompare(b.dir));

      bump.status = 'done';
      renderBump(resolved.treeError);
      const majors = rows.filter((r) => r.gap === 'major').length;
      setBumpStatus(
        rows.length
          ? `Scanned ${h(slug(resolved.repo))} @ ${h(resolved.repo.branch)} · ${plural(majors, 'package')} a major version behind`
          : `No dependencies declared in ${h(slug(resolved.repo))}.`,
        'ok'
      );
    } catch (err) {
      if (stale()) return;
      bump.status = 'error';
      setBumpStatus(err.friendly ? h(err.message) : `Something went wrong: ${h(err.message)}`, 'error');
      if (!err.friendly) console.error('[TriRepo bump]', err);
    } finally {
      if (!stale()) button.disabled = false;
    }
  }

  function renderBump(treeError) {
    const { rows } = bump;
    const out = $('lt-bump-out');
    if (!rows.length) {
      out.innerHTML = '';
      return;
    }
    const count = (g) => rows.filter((r) => r.gap === g).length;
    const multi = bump.manifests > 1;
    let html = '<div class="lt-summary">' +
      `<span><strong>${rows.length}</strong> dependencies${multi ? ` in <strong>${bump.manifests}</strong> package.json files` : ''}</span>` +
      `<span class="gap gap-major">${count('major')} major</span>` +
      `<span class="gap gap-minor">${count('minor')} minor</span>` +
      `<span class="gap gap-patch">${count('patch')} patch</span>` +
      `<span class="gap gap-current">${count('current')} current</span>` +
      '</div>';
    if (count('major')) {
      html += '<p class="lt-intro">Major-version gaps are where breaking changes live. Use <strong>Find usages</strong> ' +
        'to see exactly where a package is imported and used in this repo.</p>';
    }
    html += '<div class="lt-table-wrap"><table class="lt-table"><thead><tr><th>Package</th>' +
      (multi ? '<th>Workspace</th>' : '') +
      '<th>Declared</th><th>Latest</th><th>Gap</th><th></th></tr></thead><tbody>';
    rows.forEach((r, i) => {
      const npm = link(`https://www.npmjs.com/package/${encPath(r.name)}`, h(r.name));
      const action = bump.tree
        ? `<button class="btn lt-mini" data-usage="${i}">Find usages</button>`
        : '';
      html += `<tr class="${r.gap === 'current' || r.gap === 'na' ? 'lt-dim' : ''}">` +
        `<td>${npm} <span class="lt-muted">${h(r.type)}</span></td>` +
        (multi ? `<td><code>${h(r.dir || '(root)')}</code></td>` : '') +
        `<td><code>${h(r.spec)}</code></td>` +
        `<td>${r.latest ? `<code>${h(r.latest)}</code>` : '<span class="lt-muted">—</span>'}</td>` +
        `<td><span class="gap gap-${r.gap}">${GAP_LABEL[r.gap]}</span></td>` +
        `<td>${action}</td></tr>`;
    });
    html += '</tbody></table></div>';
    if (treeError) html += `<p class="lt-note">${h(treeError.message)}, so Find usages is unavailable for now.</p>`;
    html += '<p class="lt-note">Compares each declared range with the latest version on npm, using semver rules. ' +
      "It doesn't know which APIs changed. For a verified break analysis with reproduced errors, see IBM Bob's pass below.</p>";
    out.innerHTML = html;
  }

  // ── BUMP: where is a package used? ───────────────────────────────────────
  function collectBindings(line, set) {
    const addNamed = (list, sep) => {
      for (const part of list.split(',')) {
        const bits = part.trim().replace(/^type\s+/, '').split(sep);
        const local = (bits[1] || bits[0] || '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(local)) set.add(local);
      }
    };
    let m;
    if ((m = line.match(/\bimport\s+([A-Za-z_$][\w$]*)\s*(?:,|\bfrom\b)/)) && m[1] !== 'type') set.add(m[1]);
    if ((m = line.match(/\bimport\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\*\s*as\s+([A-Za-z_$][\w$]*)/))) set.add(m[1]);
    if ((m = line.match(/\bimport\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}/))) addNamed(m[1], /\s+as\s+/);
    if ((m = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:require|import)\s*\(/))) set.add(m[1]);
    if ((m = line.match(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:require|import)\s*\(/))) addNamed(m[1], /\s*:\s*/);
    if ((m = line.match(/\bimport\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(/))) set.add(m[1]);
  }

  function analyseFile(path, text, importRe) {
    const lines = text.split(/\r?\n/);
    const imports = [];
    const bindings = new Set();
    lines.forEach((ln, i) => {
      if (!importRe.test(ln)) return;
      imports.push({ line: i + 1, code: ln, kind: 'import' });
      collectBindings(ln, bindings);
    });
    if (!imports.length) return null;
    const refs = [];
    if (bindings.size) {
      const alt = Array.from(bindings).map(reEscape).join('|');
      const refRe = new RegExp(`(?:^|[^\\w$.])(?:${alt})\\s*(?:\\?\\.|[.(\\[])`);
      lines.forEach((ln, i) => {
        if (importRe.test(ln) || /^\s*(?:\/\/|\*|\/\*)/.test(ln)) return;
        if (refRe.test(ln)) refs.push({ line: i + 1, code: ln, kind: 'use' });
      });
    }
    return { path, imports, refs, bindings: Array.from(bindings) };
  }

  async function findUsages(index) {
    const row = bump.rows[index];
    const box = $('lt-bump-usages');
    if (!row || !bump.tree) return;
    const token = bump.token;
    const repo = bump.repo;
    const scope = row.dir ? `${row.dir}/` : '';
    const files = bump.tree.paths.filter((p) => SOURCE_FILE.test(p) && !SKIP_PATH.test(p) && p.startsWith(scope));
    const scan = files.slice(0, MAX_SCAN_FILES);
    const where = row.dir ? `${h(row.dir)}/` : 'this repo';
    box.innerHTML = `<div class="lt-card"><h4>Usages of <code>${h(row.name)}</code> in ${where}</h4>` +
      `<p class="lt-muted">${SPINNER}Scanning ${plural(scan.length, 'source file')}…</p></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const q = reEscape(row.name);
    const quote = '[\'"`]';
    const importRe = new RegExp(
      `(?:\\brequire\\s*\\(\\s*|\\bimport\\s*\\(\\s*|\\bfrom\\s*|^\\s*import\\s*)${quote}${q}(?:/[^'"\`]*)?${quote}`
    );
    const results = await mapPool(scan, CONCURRENCY, async (path) => analyseFile(path, await getRaw(repo, path), importRe));
    if (token !== bump.token) return;

    const hitFiles = results.filter((r) => r && r.path);
    const failed = results.filter((r) => r && r.error).length;
    const importCount = hitFiles.reduce((n, f) => n + f.imports.length, 0);
    const refCount = hitFiles.reduce((n, f) => n + f.refs.length, 0);

    let html = `<div class="lt-card"><h4>Usages of <code>${h(row.name)}</code> in ${where}</h4>`;
    html += `<p><strong>${plural(hitFiles.length, 'file')}</strong> · ${plural(importCount, 'import')} · ` +
      `${plural(refCount, 'direct use')} of the imported name <span class="lt-muted">(scanned ${plural(scan.length, 'source file')}` +
      `${files.length > scan.length ? ` of ${files.length}` : ''}${failed ? `, ${failed} couldn't be fetched` : ''})</span></p>`;
    if (!hitFiles.length) {
      html += '<p class="lt-muted">No imports found. It may only be used from config files, scripts or the CLI.</p>';
    }
    let shown = 0;
    for (const f of hitFiles) {
      if (shown >= MAX_HITS_SHOWN) break;
      html += `<div class="lt-hit-file">${link(blobUrl(repo, f.path), h(f.path))}` +
        (f.bindings.length ? ` <span class="lt-muted">as ${f.bindings.map((b) => `<code>${h(b)}</code>`).join(', ')}</span>` : '') +
        '</div><div class="lt-code">';
      for (const hit of [...f.imports, ...f.refs].sort((a, b) => a.line - b.line)) {
        if (shown++ >= MAX_HITS_SHOWN) break;
        html += `<div class="ln${hit.kind === 'import' ? ' near' : ''}">` +
          `${link(blobUrl(repo, f.path, hit.line), String(hit.line)).replace('<a ', '<a class="no" ')}` +
          `<span class="src">${h(hit.code.trim())}</span></div>`;
      }
      html += '</div>';
    }
    html += '<p class="lt-note">Finds where the package is imported and where the imported name is used directly. ' +
      "Calls through other variables (like <code>app.del()</code> on an Express app) aren't traced. " +
      "Upgrading means checking each of these against the package's changelog.</p></div>";
    box.innerHTML = html;
  }

  function onBumpClick(e) {
    const btn = e.target.closest('button[data-usage]');
    if (btn) findUsages(Number(btn.dataset.usage));
  }

  function renderBumpIdle() {
    const live = currentLiveRepo();
    const top = topBarRepo();
    const target = top || live;
    setBumpStatus(target
      ? `Will scan <strong>${h(target.owner)}/${h(target.repo)}</strong> from the top bar.`
      : 'Enter a GitHub URL in the top bar, then scan.', 'info');
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  const CRASH_HTML = `
    <div class="source-label live-label"><strong>LIVE</strong><span>Stack trace → source · any public GitHub repo · runs in your browser · no AI</span></div>
    <p class="lt-intro">Paste a stack trace. TriRepo separates your code from dependency and runtime frames, finds each file in the repo, and shows the code at the failing line.</p>
    <div class="lt-row">
      <label for="lt-crash-repo">Repo</label>
      <input id="lt-crash-repo" class="lt-input" type="url" autocomplete="off" spellcheck="false"
        placeholder="https://github.com/owner/repo (optional, enables the code lookup)">
    </div>
    <textarea id="lt-crash-trace" class="lt-textarea" spellcheck="false"
      placeholder="Paste a stack trace: Node.js, Python, Java, Go, Ruby…"></textarea>
    <div class="lt-actions">
      <button class="btn btn-primary" id="lt-crash-run">Trace it</button>
      <button class="btn" id="lt-crash-sample">Use the patient/ crash</button>
      <span id="lt-crash-status" class="lt-status"></span>
    </div>
    <div id="lt-crash-out"></div>
    <div class="lt-divider"><span>IBM Bob deep pass on patient/: root cause, failing test, fix</span></div>`;

  const BUMP_HTML = `
    <div class="source-label live-label"><strong>LIVE</strong><span>Dependency radar · npm registry + GitHub · runs in your browser · no AI</span></div>
    <p class="lt-intro">Checks every dependency in the repo's package.json (including workspaces) against npm, flags major-version gaps, and finds where each package is used.</p>
    <div class="lt-actions">
      <button class="btn btn-primary" id="lt-bump-run">Scan dependencies</button>
      <span id="lt-bump-status" class="lt-status"></span>
    </div>
    <div id="lt-bump-usages"></div>
    <div id="lt-bump-out"></div>
    <div class="lt-divider"><span>IBM Bob deep pass on patient/: Express 4 → 5, breaks reproduced and patched</span></div>`;

  function hook(name, after) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function hooked(...args) {
      const ret = original.apply(this, args);
      try { after(ret, args); } catch (err) { console.error('[TriRepo live tools]', err); }
      return ret;
    };
  }

  function onLiesFinished() {
    const bar = $('status-bar');
    if (bar && bar.classList.contains('error')) return;
    const live = currentLiveRepo();
    if (!live) return;
    const field = $('lt-crash-repo');
    if (!field.value.trim() || field.dataset.auto === '1') {
      field.value = `https://github.com/${live.owner}/${live.repo}`;
      field.dataset.auto = '1';
    }
    // Warm the dependency radar so it is ready when the Bump tab opens.
    runBump(false);
  }

  function onTabShown(name) {
    if (name === 'crash') {
      const field = $('lt-crash-repo');
      const top = topBarRepo();
      if (!field.value.trim() && top) {
        field.value = `https://github.com/${top.owner}/${top.repo}`;
        field.dataset.auto = '1';
      }
    } else if (name === 'bump' && bump.status === 'idle') {
      if (currentLiveRepo()) runBump(false);
      else renderBumpIdle();
    }
  }

  function resetAll() {
    crash.token++;
    bump.token++;
    Object.assign(bump, { key: null, status: 'idle', repo: null, tree: null, rows: [], manifests: 0 });
    $('lt-crash-trace').value = '';
    $('lt-crash-repo').value = '';
    $('lt-crash-out').innerHTML = '';
    $('lt-bump-out').innerHTML = '';
    $('lt-bump-usages').innerHTML = '';
    $('lt-crash-run').disabled = false;
    $('lt-bump-run').disabled = false;
    setCrashStatus('', '');
    renderBumpIdle();
  }

  function init() {
    const crashHost = $('crash-live');
    const bumpHost = $('bump-live');
    if (!crashHost || !bumpHost) return;
    crashHost.innerHTML = CRASH_HTML;
    bumpHost.innerHTML = BUMP_HTML;

    $('lt-crash-run').addEventListener('click', runCrash);
    $('lt-crash-sample').addEventListener('click', loadSampleCrash);
    $('lt-crash-repo').addEventListener('input', (e) => { e.target.dataset.auto = '0'; });
    $('lt-crash-trace').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runCrash();
    });
    $('lt-bump-run').addEventListener('click', () => runBump(true));
    $('lt-bump-out').addEventListener('click', onBumpClick);
    const topInput = $('gh-url');
    if (topInput) topInput.addEventListener('input', () => { if (bump.status === 'idle') renderBumpIdle(); });

    hook('showTab', (ret, args) => onTabShown(args[0]));
    hook('runLive', (ret) => {
      Promise.resolve(ret).then(onLiesFinished).catch((err) => console.error('[TriRepo live tools]', err));
    });
    hook('loadDemo', resetAll);
    renderBumpIdle();
    applyUrlParams();
  }

  // Deep links from the landing page: /app?repo=…, ?tab=crash&sample=crash, ?tab=bump&repo=…
  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const repo = (params.get('repo') || '').trim();
    const tab = params.get('tab');
    const open = (name) => {
      const btn = $(`tab-${name}`);
      if (btn && typeof window.showTab === 'function') window.showTab(name, btn);
    };
    if (repo) $('gh-url').value = repo;

    if (tab === 'bump' && repo) {
      open('bump');
      runBump(true);
    } else if (repo && typeof window.runLive === 'function') {
      window.runLive(); // runs Lies (and warms Bump), then shows the Lies tab
    } else if (tab === 'crash' || tab === 'bump' || tab === 'lies') {
      open(tab);
    }
    if (tab === 'crash' && params.get('sample') === 'crash') loadSampleCrash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
