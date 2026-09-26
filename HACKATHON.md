# TriRepo × IBM Bob 2.0

> **lablab.ai × IBM Bob 2.0 — 48-hour hackathon submission**

---

## What TriRepo Is

**TriRepo** is a three-check code-health clinic for any Node/Express codebase.
You drop in one repo and get three structured, evidence-backed truth reports back —
no dashboards, no cloud services, no configuration. Just Bob reading source.

| Report | Question answered |
|--------|------------------|
| `reports/lies.md` | Where do the docs lie about the code? |
| `reports/crash.md` | Given this stack trace, what is the root cause and the fix? |
| `reports/bump.md` | If we upgrade dependency X, which call sites break? |

### Why three checks belong in one product

Documentation rot, latent runtime crashes, and upgrade-blocking API debt are
not separate problems — they are three faces of the same failure mode: code
that has drifted from the understanding of the people who maintain it.
A tool that catches one without the others gives false confidence. TriRepo
treats them as a unit. Each check uses a different Bob capability (parallel
subagents, test-first debugging, sandboxed reproduction) and each check's
output informs the others — e.g. the BUMP report cross-references the same
route files that the LIES report already audited.

---

## The Patient App

`patient/` contains **Vaultline** — a realistic, runnable Express 4 invoice
management API with 35 passing tests. It was written with deliberate planted
issues for each check:

- **8 documentation contradictions** planted across README.md, CONTRIBUTING.md, CHANGELOG.md
- **1 null-dereference crash** planted in `src/services/dateService.js`, accompanied
  by a real captured stack trace in `patient/CRASH.txt`
- **4 Express 4→5 breaking API uses** planted across `src/app.js`, `src/routes/invoices.js`,
  `src/routes/clients.js`

Full ground truth is in `patient/PLANTED.md`.

---

## How IBM Bob 2.0 Drove This

IBM Bob 2.0 was the coding agent for the whole core of this project: the patient app,
its tests and planted issues, all three analysis passes and their reports, every fix and
patch in `patient/`, the prompts, the docs, the TriRepo UI and the live Lies check.

> **The exception, stated plainly:** after the Bob usage allowance ran out, the live
> Crash and Bump tools, the landing page, and the white-and-green redesign of the UI
> were written with Claude Code (Anthropic). They are listed file by file under
> [After Bob: live Crash and Bump tools](#after-bob-live-crash-and-bump-tools).
> Nothing in `reports/` or `patient/` was touched by them.

### Pass 0 — Scaffold (Plan + Agent modes)

**Prompt:** `prompts/00_bootstrap.md`

Bob used **Plan mode** to design the full repo structure, the Vaultline app schema,
and the complete planted-issues list. It then switched to **Agent mode** to write
every file: the Express app (`patient/src/`), 35 Vitest tests (`patient/tests/`),
the documentation files with planted lies, the `patient/CRASH.txt` stack trace
(captured by running `patient/crash-trigger.mjs` against the live server),
the UI (`app/server.js`), the prompts, and the demo scripts.

Bob **changed in the codebase:** everything — created from scratch.  
Bob **did not** write `patient/PLANTED.md` (intentionally deferred until Pass 3).

### Pass 1 — LIES (Ask + Plan + Agent modes, 2 parallel subagents)

**Prompt:** `prompts/01_lies.md`

**Ask mode / 2 parallel subagents running simultaneously:**
- Subagent A read only documentation files (README.md, CONTRIBUTING.md, CHANGELOG.md,
  .env.example) and produced a structured claim list with file:line provenance.
- Subagent B read only code/config files (package.json, all of src/, all of tests/,
  vitest.config.js) and produced a ground-truth catalog.
- Both subagents ran independently in the same turn with no shared state — this is the
  parallel-tasks capability.

**Plan mode (parent agent):** Cross-referenced every doc claim against the
ground-truth catalog. Identified 11 contradictions across 6 categories, including
2 CHANGELOG inconsistencies that were not part of the original planted plan (genuine
discoveries).

**Agent mode:** Applied 3 targeted fixes — the three highest-signal, safest changes.
Left 8 contradictions intact and documented with explicit reasoning.

Bob **changed in the codebase:** `patient/README.md` (3 lines), `patient/CONTRIBUTING.md`
(2 lines). Wrote `reports/lies.md`.

### Pass 2 — CRASH (Ask + Plan + Agent modes)

**Prompt:** `prompts/02_crash.md`

**Ask mode:** Read `patient/CRASH.txt` only. Reasoned backward from the stack trace
to identify `dateService.js:39` as the crash site without reading source yet.
Wrote a failing test (`tests/dateService.test.js` — CRASH-001) from the trace alone.

**Plan mode:** Designed the minimal fix — a null/undefined guard before the
`.toLowerCase()` call that throws a structured `400 VALIDATION_ERROR` matching the
existing error pattern in the file.

**Agent mode:** Applied the fix, added the integration test to `tests/invoices.test.js`
(CRASH-001), ran the full suite — 35/35 green.

Bob used **full-repo context**: it read the crash trace, traced it to the service, read
the service, confirmed the call chain through `invoiceService.js`, checked the route's
validator chain — all without being told which files to look at.

Bob **changed in the codebase:** `patient/src/services/dateService.js` (5 lines added),
`patient/tests/dateService.test.js` (1 new test), `patient/tests/invoices.test.js`
(1 new integration test). Wrote `reports/crash.md`.

### Pass 3 — BUMP (Ask / explore subagent + Plan + Agent modes)

**Prompt:** `prompts/03_bump.md`

**Ask mode / explore subagent:** Exhaustive grep of `patient/src/` — ~60 call sites
catalogued. Four candidate breaking changes identified.

**Plan mode (sandboxed verification):** Created `scratch_express5/` as a throwaway
harness. Copied `patient/src/` verbatim, swapped in `"express": "^5.0.0"`, installed
Express 5.2.1. Wrote `scratch_express5/test_breaks.mjs` — a Node ESM runner that spins
up real Express apps and issues real `fetch()` calls to prove each break. All 4
suspected breaks reproduced; 0 false positives. This is Bob using **full-repo context**
plus a live sandbox to verify findings rather than relying on assumed behaviour.

**Agent mode:** Patched the 3 highest-risk breaks (2 startup crashes + 1 loud
runtime crash). Left Break 4 (silent wrong status code) documented but unpatched,
with explicit reasoning. Ran full suite — 35/35 green.

Bob **changed in the codebase:** `patient/src/app.js` (2 lines), `patient/src/routes/invoices.js`
(inline expansion of `req.param()`), `patient/src/routes/clients.js` (same).
Wrote `reports/bump.md` and `patient/UPGRADE.md`.

---

## What Bob Changed vs. What the UI Only Displays

| Category | Bob changed the code | Bob only displays/reports |
|----------|---------------------|--------------------------|
| Pass 0 | Created all files (app, patient, tests, docs, UI, prompts) | — |
| Pass 1 — LIES | `patient/README.md`, `patient/CONTRIBUTING.md` (5 lines) | `reports/lies.md` (the other 8 contradictions are documented, not fixed) |
| Pass 2 — CRASH | `patient/src/services/dateService.js`, two test files | `reports/crash.md` |
| Pass 3 — BUMP | `patient/src/app.js`, `patient/src/routes/invoices.js`, `patient/src/routes/clients.js` | `reports/bump.md`, `patient/UPGRADE.md` (Break 4 documented but intentionally not patched) |

The UI (`app/server.js`) is a server-rendered Express app that reads `reports/*.md`
at request time, converts them to HTML with `marked`, and presents them in three
tabs. Bob wrote the UI in Pass 0 and it renders the live report files with no
rebuild step. The live Crash and Bump tools on top of it, the landing page and the
current visual design came later; see [After Bob](#after-bob-live-crash-and-bump-tools).

---

## How to Run the Demo Locally

**Prerequisites:** Node.js >=18, npm >=7

```bash
# 1. Install dependencies
npm install              # root workspace — installs app/ and patient/ together

# 2. Run the TriRepo UI (port 4000)
cd app && npm start
# Open http://localhost:4000 for the landing page; the three-tab tool is at /app

# 3. (Optional) Run the patient app itself (port 3000)
cd patient && npm start

# 4. (Optional) Run patient tests
cd patient && npm test
# Expected: 35/35 passing

# 5. (Optional) Reproduce all four Express 5 breaks
#    (requires scratch_express5/ to be recreated — see reports/bump.md)
```

The UI reads `reports/lies.md`, `reports/crash.md`, `reports/bump.md` directly
from disk at each page load — no build step, no hot reload required. Editing a
report file and refreshing the browser shows the updated content immediately.

---

## Bob Features Used — Specific Accounting

| Feature | Pass | How it was used |
|---------|------|-----------------|
| **Plan mode** | 0, 1, 2, 3 | System design (Pass 0), contradiction diff (Pass 1), fix design (Pass 2), break prioritisation (Pass 3) |
| **Ask mode** | 1, 2, 3 | Parallel doc + code reads (Pass 1), stack-trace-only reasoning (Pass 2), call-site inventory (Pass 3) |
| **Agent mode** | 0, 1, 2, 3 | All file writes and code edits across every pass |
| **Parallel subagents** | 1 | Two subagents ran simultaneously in Pass 1 (docs subagent + code subagent) — neither could see the other's output |
| **Explore subagent** | 3 | Catalogued ~60 Express call sites in Pass 3 without loading all source into the parent context |
| **Full-repo context** | 2, 3 | Pass 2: traced crash through three source files without being told which to read; Pass 3: verified break patterns across the full src/ tree |
| **Sandboxed reproduction** | 3 | Bob created a live Express 5 test harness, ran real HTTP requests, and verified all 4 breaks empirically |
| **Test-first debugging** | 2 | Failing test written from stack trace before source was read — confirmed RED, then GREEN after fix |

---

## Session Screenshots

All 13 screenshots are in `bob_sessions/`, grouped by pass with a caption for each in
[bob_sessions/README.md](bob_sessions/README.md). The key ones:

| File | What it shows |
|------|-------------|
| [`pass0_scaffold.PNG`](bob_sessions/pass0_scaffold.PNG) | Pass 0 finished: 13/13 tasks, 43 files changed, PLANTED.md held back |
| [`pass1_lies_todo.PNG`](bob_sessions/pass1_lies_todo.PNG) | Pass 1's two parallel subagents, one for docs and one for code |
| [`pass2_crash_red.PNG`](bob_sessions/pass2_crash_red.PNG) | The CRASH-001 tests failing before the fix (RED) |
| [`pass2_crash_green.PNG`](bob_sessions/pass2_crash_green.PNG) | Both tests passing after the fix, then the full suite at 35/35 |
| [`pass3_bump_proof.PNG`](bob_sessions/pass3_bump_proof.PNG) | Four Express 5 breaks reproduced with real error output |

---

## After Bob: live Crash and Bump tools

Bob built the live Lies check. Its first attempt at live Crash and Bump tools broke the
page and was reverted (commit `a11a8f0`), and the Bob usage allowance ran out before it
could be fixed. The replacements were then written with Claude Code:

| File | What it is |
|------|-----------|
| `app/public/live-tools.js` | **Crash:** parses a pasted stack trace (Node, Python, Java, Go, Ruby), matches frames to files in a public GitHub repo, shows the code at the failing line, and applies simple pattern rules to the error message. **Bump:** reads `package.json` (including workspaces), compares every dependency with the latest version on npm, flags major-version gaps, and finds where a package is imported and used. |
| `app/public/live-tools.css` | Styles for the two tools, plus a small-screen fix for wide report tables. |
| `app/server.js` (small edits) | Serves `app/public/`, adds `/api/sample-trace`, lets the existing proxy also reach `registry.npmjs.org`, adds the two tool placeholders, and updates the top-bar hint, button label and footer. |

Both tools are deterministic (no AI) and are labelled **LIVE** in the UI. Bob's deep
passes remain the **DEMO** sections under each tab, unchanged.

### Landing page and redesign

Also written with Claude Code, after the tools above:

| File | What it is |
|------|-----------|
| `app/public/landing.html`, `app/public/landing.css` | The landing page at `/`: what TriRepo is, the three checks, how the live checks and Bob's deep pass differ, and a repo box that runs the checks. Every number on it comes from Bob's reports. |
| `app/public/site.css`, `app/public/app.css`, `app/public/favicon.svg` | The white-and-green design shared by both pages. It replaces the dark inline styles Bob wrote in Pass 0 and keeps every id and class the page's script uses. |
| `app/server.js` (small edits) | Serves the landing page at `/` and moves the three-tab tool to `/app`, with the new navigation and footer around it. Bob's inline script, including the live Lies check, is unchanged. |

---

## Authorship Statement

IBM Bob 2.0 produced all the analysis and every code change in `patient/`, plus the
reports, prompts, docs, the original TriRepo UI and the live Lies check. The live Crash
and Bump tools, the landing page and the current visual design (`app/public/` and the
`app/server.js` edits listed above) were written with Claude Code after the Bob
allowance ran out. The operator approved edits, ran commands in the terminal, and
captured screenshots. No code or analysis was written by hand.

---

## License

MIT — see `LICENSE`.
