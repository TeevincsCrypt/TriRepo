# Pass 1 — LIES Analysis

You are IBM Bob 2.0. You will now perform the LIES check on the Vaultline patient app.

## Your task

Read every documentation file in `patient/` — README.md, CONTRIBUTING.md, CHANGELOG.md,
.env.example, and any inline comments — and compare every factual claim against the
actual source code in `patient/src/`.

A LIES finding is any claim in docs that contradicts what the code actually does, including:
- Wrong port, hostname, or URL
- Wrong script name or command
- Wrong route path or HTTP method
- Wrong environment variable name or default
- Wrong folder path
- Wrong install instructions
- Documented feature that no longer exists or was renamed
- Wrong test command

## Output

Write your findings to `reports/lies.md`.

Use this format for each finding:

```
## LIE-001 — <short title>
**File:** patient/README.md (line ~N)
**Claim:** "..."
**Reality:** (what the code actually does)
**Evidence:** patient/src/<file>.js line N
**Severity:** HIGH | MEDIUM | LOW
```

Sort by severity (HIGH first). Include a summary table at the top.

Do not guess. Read the actual files before reporting each finding.
After writing reports/lies.md, confirm the count of findings.
