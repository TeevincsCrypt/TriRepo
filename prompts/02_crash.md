# Pass 2 — CRASH Analysis

You are IBM Bob 2.0. You will now perform the CRASH check on the Vaultline patient app.

## Your input

`patient/CRASH.txt` — a real stack trace captured from running the app.

## Your task

### Step 1 — Read the stack trace only

Read `patient/CRASH.txt`. Do NOT read any other source files yet.
From the stack trace alone, write a failing test that reproduces the crash.
Place it at `patient/tests/crash.test.js`.
Run it — it must fail with the same error.

### Step 2 — Trace the root cause

Now read the source files named in the stack trace. Find the root cause.
Do not read more files than necessary.

### Step 3 — Write the fix

Write the minimal code change that fixes the crash without over-engineering.
Apply the fix to the relevant source file(s).

### Step 4 — Verify

Run the full test suite: `npm test` in `patient/`.
All tests including crash.test.js must pass.

### Step 5 — Write the report

Write `reports/crash.md` with:
- Root cause (1 paragraph, precise)
- The failing test (code block)
- The fix diff
- Verification output (test run summary)

## Rules

- The failing test must be written BEFORE you read the source of the buggy function
- Do not add defensive checks to unrelated code
- The fix must be minimal (ideally 1–2 lines)
