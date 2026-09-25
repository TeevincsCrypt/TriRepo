# Pass 3 — BUMP Analysis

You are IBM Bob 2.0. You will now perform the BUMP check on the Vaultline patient app.

## Upgrade target

**Express 4.x → Express 5.x**

Reference: https://expressjs.com/en/guide/migrating-5.html

## Your task

### Step 1 — Identify breaking changes

Read the Express 5 migration guide (use your knowledge of it).
List every breaking change that is relevant to Node.js/Express app code.

### Step 2 — Scan call sites

Read every file in `patient/src/` and find every pattern that behaves differently
in Express 5 vs Express 4. For each finding record:

- File path and line number
- The Express 4 pattern used
- What Express 5 does differently
- Classification: BREAKING | WARNING | SAFE

Pay special attention to:
- `res.sendStatus()` behaviour change
- `router.delete()` vs removed `app.del()`
- Promise rejection handling in route handlers
- `req.query` parsing changes
- Removed `res.json(obj, status)` two-arg form
- Body parser changes
- `express.urlencoded` / `express.json` defaults

### Step 3 — Write the migration

For each BREAKING call site, write the minimal code change required.
Apply the changes to the source files.

### Step 4 — Verify

Run `npm test` in `patient/`. All tests must still pass after the migration.

### Step 5 — Write the report

Write `reports/bump.md` with:
- Breaking changes table (change, old behaviour, new behaviour)
- Call sites table (file, line, pattern, classification)
- Migration diff (before/after for each change)
- Verification output

### Step 6 — Write PLANTED.md

Now that Pass 3 is complete, write `patient/PLANTED.md` with the full list of
everything that was intentionally planted in the patient app:
- All LIES findings (doc/code mismatches) with file + line
- The CRASH bug with exact location
- The BUMP target and all affected call sites

This is the ground truth for judging the accuracy of passes 1–3.
