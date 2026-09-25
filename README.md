# TriRepo

> **One repo in. Three truths out.**

TriRepo is a three-check clinic for one codebase.

| Check | What it finds |
|-------|--------------|
| **LIES** | Where docs disagree with code |
| **CRASH** | Stack trace → failing test → fix plan |
| **BUMP** | What breaks in THIS repo if you upgrade X |

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

## Analysis produced with IBM Bob 2.0

All analysis reports, code fixes, tests, and documentation in this repository
were produced by IBM Bob 2.0 during a 48-hour lablab.ai hackathon.
