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

Every file in this repository — source code, tests, reports, prompts, UI, and docs —
was produced by IBM Bob 2.0 operating as the sole coding agent.

> **All source in this repository was produced in IBM Bob 2.0. No other coding
> agent authored files in this repo.**

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
rebuild step.

---

## How to Run the Demo Locally

**Prerequisites:** Node.js >=18, npm >=7

```bash
# 1. Install dependencies
npm install              # root workspace — installs app/ and patient/ together

# 2. Run the TriRepo UI (port 4000)
cd app && npm start
# Open http://localhost:4000

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

Screenshots of Bob task sessions are in `bob_sessions/`. See `bob_sessions/README.md`
for the full index and capture instructions.

Key shots to capture:

| File | What to show |
|------|-------------|
| `pass1_lies_analysis.png` | Bob's parallel subagents in the same task turn |
| `pass2_crash_test.png` | The failing CRASH-001 test being written from the stack trace |
| `pass2_crash_fix.png` | `35/35` green after the fix |
| `pass3_bump_callsites.png` | The scratch_express5 test harness output showing 4 confirmed breaks |
| `ui_demo.png` | Browser at http://localhost:4000 — all three tabs |

---

## Authorship Statement

All source in this repository was produced in IBM Bob 2.0. No other coding agent
authored files in this repo. The operator approved edits, ran commands in the
terminal, and captured screenshots — no code or analysis was written by hand.

---

## License

MIT — see `LICENSE`.
