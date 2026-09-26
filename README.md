# TriRepo

> **One repo in. Three truths out.**

TriRepo is a three-check clinic for one codebase.

| Check | What it finds |
|-------|--------------|
| **LIES** | Where docs disagree with code |
| **CRASH** | Stack trace → failing test → fix plan |
| **BUMP** | What breaks in THIS repo if you upgrade X |

---

## Using TriRepo in 4 steps

1. **Open the UI** — go to `http://localhost:4000` (or the deployed URL).
2. **Try any public GitHub repo** — paste a `https://github.com/owner/repo` URL
   into the top bar and click **Run checks**. Everything runs in your browser,
   with no AI and no signup:
   - **Lies** fetches the README, CONTRIBUTING.md and package.json and checks for
     script-name lies, wrong Node version claims, and port mismatches.
   - **Crash**: paste a stack trace. TriRepo separates your code from dependency
     frames, opens the failing line on GitHub, and applies simple pattern rules to
     the error. Click **Use the patient/ crash** for a one-click example.
   - **Bump** compares every dependency (including workspaces) with the latest
     version on npm, flags major-version gaps, and **Find usages** lists every file
     and line that imports a package.
3. **See what a deep Bob analysis looks like** — click **Load demo**. This loads
   the full IBM Bob 2.0 analysis of the `patient/` repo: 11 documentation
   contradictions found (LIES tab), a real crash diagnosed from a stack trace
   alone (CRASH tab), and 4 Express 5 breaking changes mapped with verified
   reproduction output (BUMP tab).
4. **Run it yourself locally** — see Quick Start below.

> **Judges:** click **Load demo** to see the full Bob-backed analysis. The live
> checks work on any public repo. Try them on this one:
> `https://github.com/TeevincsCrypt/TriRepo`.

---

## Quick Start

### 1. Run the patient app

```bash
cd patient
npm install
npm start
```

The patient app runs on **http://localhost:3000**.

### 2. Run patient app tests

```bash
cd patient
npm test
```

### 3. Run the TriRepo UI

```bash
cd app
npm install
npm start
```

The UI runs on **http://localhost:4000**.

---

## Project Structure

```
trirepo/
  README.md                  ← you are here
  LICENSE                    ← MIT
  HACKATHON.md               ← hackathon context and judging notes
  package.json               ← root workspace config
  app/                       ← TriRepo UI (one page, three tabs)
    public/                  ← live Crash + Bump tools (browser-side)
  patient/                   ← sample app being analyzed
  reports/
    lies.md                  ← LIES analysis output
    crash.md                 ← CRASH analysis output
    bump.md                  ← BUMP analysis output
  prompts/
    00_bootstrap.md          ← Pass 0 bootstrap prompt
    01_lies.md               ← Pass 1 LIES analysis prompt
    02_crash.md              ← Pass 2 CRASH analysis prompt
    03_bump.md               ← Pass 3 BUMP analysis prompt
  bob_sessions/
    README.md                ← session screenshot index
  demo/
    RECORDING_CHECKLIST.md   ← 3-minute demo script
```

---

## The Three Checks

### LIES — Stale Documentation Detector

Compares every claim in README, CONTRIBUTING, API docs, and inline comments
against actual source code, scripts, routes, env vars, and ports.

Outputs `reports/lies.md` listing each discrepancy with file + line references.

### CRASH — Stack Trace to Fix

Takes a real stack trace from `patient/CRASH.txt`, writes a failing test that
reproduces it from that trace alone, traces the bug to root cause, and writes a
targeted fix.

Outputs `reports/crash.md` with: root cause, failing test, fix diff, verification steps.

### BUMP — Upgrade Impact Map

Given one dependency upgrade (e.g. Express 4 → 5), finds every call site in the
patient repo that uses a changed or removed API, classifies each as breaking/warning/safe,
and proposes the minimal migration.

Outputs `reports/bump.md` with: breaking changes table, call sites, migration plan.

---

## Patient App

The patient app in `patient/` is a small but realistic Node/Express service used
as the analysis subject. It has intentionally planted documentation issues, one
real crash bug, and upgrade-incompatible API patterns.

See `patient/README.md` for its own documentation (which contains some deliberate errors).

---

## Built with IBM Bob 2.0

All analysis reports, patient/ code fixes, tests, and documentation in this
repository were produced by IBM Bob 2.0 during a 48-hour lablab.ai hackathon,
along with the TriRepo UI and its live Lies check. After the Bob usage allowance
ran out, the live Crash and Bump tools (`app/public/`) were added with Claude Code.
The details are in [HACKATHON.md](HACKATHON.md#after-bob-live-crash-and-bump-tools).
