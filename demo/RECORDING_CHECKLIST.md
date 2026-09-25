# Demo Recording Checklist — TriRepo (3-minute demo)

## Before you record

- [ ] `cd patient && npm start` — patient app running on port 3000
- [ ] `cd app && npm start` — TriRepo UI running on port 4000
- [ ] Browser open at http://localhost:4000
- [ ] Terminal visible alongside browser

---

## Scene 1 — Introduction (0:00–0:30)

**Say:** "TriRepo is a three-check clinic for one codebase. One repo in, three truths out."

**Show:**
- [ ] TriRepo UI in browser, header visible: "TriRepo — patient/"
- [ ] Three tabs: Lies / Crash / Bump

---

## Scene 2 — LIES tab (0:30–1:00)

**Say:** "The LIES check finds every place the docs disagree with the code."

**Show:**
- [ ] Click Lies tab
- [ ] Scroll through reports/lies.md rendered in the UI
- [ ] Point out one HIGH severity finding (e.g. wrong start command)
- [ ] Open the referenced source file to confirm the finding is real

---

## Scene 3 — CRASH tab (1:00–1:50)

**Say:** "The CRASH check takes a real stack trace, writes a failing test, finds the root cause, and fixes it."

**Show:**
- [ ] Click Crash tab
- [ ] Show the original stack trace (from CRASH.txt)
- [ ] Show the failing test Bob wrote from the trace alone
- [ ] Show the fix diff
- [ ] Run `npm test` in terminal — all green including crash.test.js

---

## Scene 4 — BUMP tab (1:50–2:30)

**Say:** "The BUMP check maps every call site that breaks on an upgrade — before you touch package.json."

**Show:**
- [ ] Click Bump tab
- [ ] Show breaking changes table (Express 4→5)
- [ ] Show call sites table with file + line references
- [ ] Open one of the source files to the flagged line

---

## Scene 5 — Wrap-up (2:30–3:00)

**Say:** "All of this — the patient app, the planted bugs, the analysis, the reports, the UI — was written by IBM Bob 2.0. Zero human code."

**Show:**
- [ ] bob_sessions/ folder showing session screenshots
- [ ] patient/PLANTED.md (ground truth confirming what was planted)
- [ ] One bob_sessions screenshot of Bob doing the work

---

## After recording

- [ ] Upload to lablab.ai submission
- [ ] Link to repo in submission description

---

*All analysis and code changes produced with IBM Bob 2.0*
