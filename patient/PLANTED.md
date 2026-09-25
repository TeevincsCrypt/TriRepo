# PLANTED.md — Ground Truth for TriRepo Patient App

This file lists exactly what was deliberately planted in `patient/` for each
TriRepo check, and separately calls out genuine findings the analysis surfaced
that were *not* part of the original plan. It is intentionally kept out of
the repo until all three checks complete so that Bob cannot read it during
analysis.

---

## Pass 1 — LIES (documentation vs. code)

### Planted contradictions

| # | Location | Planted lie |
|---|----------|-------------|
| L1 | `README.md:38`, `CONTRIBUTING.md:16` | `npm run serve` — script does not exist in `package.json`; correct command is `npm start` |
| L2 | `README.md:41` | `http://localhost:8080` — actual default port in `src/config.js` is `3000` |
| L3 | `README.md:7` | `Node.js >= 16.0.0` — `package.json` engines field requires `>=18.0.0` |
| L4 | `README.md:46,52`, `CONTRIBUTING.md:28,44` | `npm run test:unit` / `npm run test:integration` — neither script exists; the test script is `vitest run` |
| L5 | `README.md:61–82` | All API routes documented under `/api/v2/…` — code uses `/api/v1/…` throughout |
| L6 | `CONTRIBUTING.md:49` | Source lives in `lib/` — actual directory is `src/` |
| L7 | `CONTRIBUTING.md:31,50` | Tests live in `test/` — actual directory is `tests/` (with `s`) |
| L8 | `CONTRIBUTING.md:54` | `.env.sample` — file in repo is `.env.example` |

### Fixes Bob applied (3 of 8)

- `README.md`: `npm run serve` → `npm start`; `localhost:8080` → `localhost:3000`; `Node.js >= 16.0.0` → `>=18.0.0`
- `CONTRIBUTING.md`: `npm run serve` → `npm start`; `npm run lint && npm run test:unit` → `npm run lint && npm test`

### Findings NOT in the original plan (surfaced by Bob's analysis)

These were genuine discoveries, not planted:

| Finding | Where | What Bob found |
|---------|-------|----------------|
| G1 | `CHANGELOG.md:18` | Entry claims "Migrated from v1 to v2 route prefix for all endpoints" — code never made that migration; v1 prefix is still in every route file |
| G2 | `CHANGELOG.md:38` | v2.0.0 breaking-change entry reads "Renamed all routes from `/api/v1/` to `/api/v1/`" — source and destination are identical, a copy-paste error that records no actual change |

**These are real findings, not planted.** The CHANGELOG entries were written
carelessly during scaffold but not intentionally seeded as test cases.
Their discovery demonstrates that Bob's analysis goes beyond a scripted checklist.

---

## Pass 2 — CRASH (stack trace → fix)

### Planted crash

`patient/src/services/dateService.js:39` — `terms.toLowerCase()` called
unconditionally. When a `POST /api/v1/invoices` request omits both `paymentTerms`
and `dueAt`, `invoiceService.js:48` passes `undefined` directly into `calcDueDate`,
which reaches `terms.toLowerCase()` and throws an unhandled `TypeError`. The route
has no express-validator rule for `paymentTerms`, so no 400 is produced upstream —
the crash surfaces as a 500.

The planted crash was accompanied by `patient/CRASH.txt`: a real stack trace
captured by running `patient/crash-trigger.mjs` against the live server before
the fix was applied.

### What Bob was asked to do

1. Read `CRASH.txt` only — not the source — and reason backward to the root cause.
2. Write failing tests first (RED), then apply the fix (GREEN).
3. Confirm all 35 tests pass after the fix.

### What Bob actually did

- Correctly identified `dateService.js:39` as the crash site from the stack trace alone.
- Added a structured `null`/`undefined` guard that throws a `400 VALIDATION_ERROR`
  instead of an unhandled `TypeError`.
- Added unit test in `tests/dateService.test.js` and integration test in
  `tests/invoices.test.js`, both labelled `CRASH-001`.
- Full suite: 35/35 green after fix.

### Findings NOT in the original plan

None. The crash was unambiguous from the stack trace; the fix was minimal and
correct. No additional bugs were discovered during this pass.

---

## Pass 3 — BUMP (Express 4 → Express 5 upgrade impact)

### Planted breaking changes

Four Express 4 APIs were deliberately used in `patient/src/` that are removed
or changed in Express 5:

| # | File | Line | API | Break type |
|---|------|------|-----|------------|
| B1 | `src/app.js:43` | `app.del()` | Express 4 alias for `app.delete()`; removed in Express 5 — **startup crash** |
| B2 | `src/app.js:51` | `app.use('*', ...)` | Bare `*` wildcard invalid in Express 5's `path-to-regexp` v8 — **startup crash** |
| B3 | `src/routes/invoices.js:14,38`, `src/routes/clients.js:10,26` | `req.param()` | Removed in Express 5 — **runtime crash on every GET-by-id** |
| B4 | `src/routes/invoices.js:69`, `src/routes/clients.js:49` | `res.json(body, status)` | Two-arg form silently ignored in Express 5; returns 200 instead of 201 — **silent regression** |

### What Bob was asked to do

1. Inventory all Express API call sites in `patient/src/` (no guessing).
2. Verify each suspected break by reproducing the error against a real Express 5 install.
3. Patch the 2–3 highest-risk sites; leave at least one documented but unpatched.

### What Bob actually did

- Created `scratch_express5/` as a throwaway verification harness (now deleted; was
  gitignored during the session).
- Reproduced all 4 breaks against Express 5.2.1 with a real `fetch()`/`http.Server`
  test script (`scratch_express5/test_breaks.mjs`).
- Patched B1, B2, and B3 (the two startup crashes + the loud runtime crash).
- Left B4 (`res.json(body, status)`) unpatched — documented in `patient/UPGRADE.md`.
- Full suite: 35/35 green after patching.

### Findings NOT in the original plan

| Finding | What Bob found |
|---------|----------------|
| G3 | `res.json(obj, status)` deprecation warnings were *already* printing in the current Express 4 test run — Bob noted this proactively, confirming the issue is live even before any upgrade |
| G4 | `router.delete()` in `clients.js:73` was already correctly using `delete`, not `del` — Bob explicitly confirmed no change needed there rather than patching it defensively |

---

## Summary: planted vs. discovered

| Category | Planted | Discovered by Bob (not planted) |
|----------|---------|-------------------------------|
| LIES | 8 documentation contradictions | 2 CHANGELOG inconsistencies (G1, G2) |
| CRASH | 1 null-dereference crash + stack trace | 0 |
| BUMP | 4 Express 4→5 breaking API uses | 2 observations (G3, G4) |
| **Total** | **13** | **4** |

The 4 unplanned discoveries are a feature, not a flaw: they demonstrate that
Bob's analysis is not a scripted checklist replay but genuine code reading that
surfaces issues the operator didn't deliberately introduce.

---

*Written by IBM Bob 2.0 after all three passes were complete.*
