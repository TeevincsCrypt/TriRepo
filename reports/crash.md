# TriRepo / CRASH
Repo: patient/
Bob modes used: Ask, Plan, Agent
Subagents used: none (investigation was direct; root cause was unambiguous from the stack trace)

## Problem

`POST /api/v1/invoices` returns `500 Internal Server Error` with
`"Cannot read properties of undefined (reading 'toLowerCase')"` whenever the
request body omits both `paymentTerms` and `dueAt`.

## Method

1. **Ask — trace the stack**: Read `patient/CRASH.txt`. The stack trace
   pinpoints `dateService.js:39` as the crash site, called from
   `invoiceService.js:48`. Both source files were read immediately.

2. **Plan — design the test**: Added two tests that reproduce the exact
   failing conditions from CRASH.txt before touching any production code.
   Ran them first to confirm **RED** (both failed as expected).

3. **Agent — apply the fix**: Added a `null`/`undefined` guard at the top of
   `calcDueDate`. Ran the new tests to confirm **GREEN**, then ran the full
   test suite (35/35) to confirm nothing regressed.

## Findings

| Layer | File | Line | Finding |
|---|---|---|---|
| Service | `patient/src/services/dateService.js` | 39 | `terms.toLowerCase()` called unconditionally — crashes when `terms` is `undefined` or `null` |
| Service | `patient/src/services/invoiceService.js` | 48 | Passes `body.paymentTerms` directly to `calcDueDate` with no guard; if request omits `paymentTerms` and `dueAt`, `undefined` is forwarded |
| Route | `patient/src/routes/invoices.js` | 59 | `paymentTerms` is intentionally absent from the express-validator chain — no 400 is produced upstream, so the crash reaches `calcDueDate` |

**Root cause (one sentence):**
`calcDueDate` in `dateService.js` calls `terms.toLowerCase()` at line 39
without first checking whether `terms` is `null`/`undefined`, and the
invoice POST route neither validates nor defaults `paymentTerms`, so any
request that omits both `paymentTerms` and `dueAt` passes `undefined`
directly into `calcDueDate` and causes an unhandled `TypeError` that
surfaces as a 500.

## Changes applied

### `patient/src/services/dateService.js`

Added a `null`/`undefined` guard immediately before the `.toLowerCase()` call.
When `terms` is absent the function now throws a structured `Error` with
`status: 400` and `code: 'VALIDATION_ERROR'` — identical to the pattern used
for the existing unknown-terms branch — instead of an unhandled `TypeError`.

```diff
-  // ── CRASH BUG ────────────────────────────────────────────────────────────
-  // terms.toLowerCase() throws TypeError when terms is undefined or null.
-  // The route does not validate the `terms` field, so callers can omit it.
-  // This crashes the POST /api/v1/invoices handler with a 500.
-  // ─────────────────────────────────────────────────────────────────────────
-  const normalised = terms.toLowerCase();
+  if (terms == null) {
+    const err = new Error('Payment terms are required');
+    err.status = 400;
+    err.code = 'VALIDATION_ERROR';
+    throw err;
+  }
+
+  const normalised = terms.toLowerCase();
```

### `patient/tests/dateService.test.js`

Added one new test (`CRASH-001`) to `calcDueDate` describe block:

```js
it('throws structured 400 error (not TypeError) when terms is undefined — CRASH-001', () => {
  let thrown;
  try { calcDueDate('2024-03-01', undefined); } catch (e) { thrown = e; }
  expect(thrown).toBeDefined();
  expect(thrown).not.toBeInstanceOf(TypeError);
  expect(thrown.status).toBe(400);
});
```

### `patient/tests/invoices.test.js`

Added one new integration test (`CRASH-001`) to `POST /api/v1/invoices` describe block
using the exact payload from CRASH.txt:

```js
it('returns 400 (not 500) when paymentTerms is omitted and dueAt is absent — CRASH-001', async () => {
  const res = await request(app).post('/api/v1/invoices').send({
    clientId,
    invoiceNumber: 'INV-CRASH-001',
    issuedAt: '2024-03-01',
    items: [{ description: 'Crash test', quantity: 1, unitPrice: 100 }],
  });
  expect(res.status).toBe(400);
});
```

## What we did not do

- Did **not** add `paymentTerms` validation to the express-validator chain in
  `invoices.js` — the route already works correctly when either `dueAt` or a
  valid `paymentTerms` is supplied; adding validation there would be a separate
  product decision (it would reject requests that currently succeed with an
  explicit `dueAt`).
- Did **not** add a default fallback for `paymentTerms` — defaulting silently
  to a specific term would change business logic outside the scope of this bug.
- Did **not** address the `BUMP`-labelled issues (`req.param()` removal,
  `res.json(obj, status)` two-arg form) visible in the route file — those are
  separate regressions flagged for Pass 3.

## Evidence paths

| Artefact | Path |
|---|---|
| Original crash trace | `patient/CRASH.txt` |
| Root-cause source | `patient/src/services/dateService.js:39` |
| Caller source | `patient/src/services/invoiceService.js:48` |
| Route (no paymentTerms validation) | `patient/src/routes/invoices.js:59` |
| Unit test (CRASH-001) | `patient/tests/dateService.test.js` |
| Integration test (CRASH-001) | `patient/tests/invoices.test.js` |

## Commands to reproduce

```sh
# From workspace root — patient/ has its own node_modules

# 1. Run ONLY the new crash tests (RED before fix, GREEN after)
cd patient && npx vitest run --reporter=verbose -t "CRASH-001"

# 2. Run the full patient test suite
cd patient && npx vitest run --reporter=verbose

# 3. Trigger the crash manually against a live server (requires server running on :3002)
#    curl -s -X POST http://localhost:3002/api/v1/invoices \
#      -H "Content-Type: application/json" \
#      -d '{"clientId":"a4d0f9ea-2183-4798-9429-ec14e5de711f","invoiceNumber":"INV-CRASH-001","issuedAt":"2024-03-01","items":[{"description":"Crash test","quantity":1,"unitPrice":100}]}'
```
