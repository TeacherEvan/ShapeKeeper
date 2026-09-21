# Dogfood Remediation — TODO (Objectives)

**Plan ID:** 2026-09-20-dogfood-remediation  
**Source:** docs/Dogfood/report.md (Critical 404, Medium local-only)  
**Definition of Done:** All ticked; 404 either fixed or documented with user-decision required; evidence files present.

| # | Objective | Requirement | Evidence | Status |
|---|-----------|-------------|----------|--------|
| OBJ-001 | Confirm `index.html` and `styles.css` intact in repo (no deletion/corruption) | AC-003 | `ls -la index.html` + `git status` | [ ] |
| OBJ-002 | Confirm `vercel.json` routing does not block `/` (only headers, no broken redirects) | AC-001, AC-002 | Read `vercel.json` | [ ] |
| OBJ-003 | Confirm `.git` is intact (no `git checkout -b .` corruption per AGENTS.md pitfalls) | AC-005 | `ls .git/config` + `git status` | [ ] |
| OBJ-004 | Verify local server still serves `index.html` with 200 (no regression) | AC-003 | `curl -I http://localhost:8888/` | [ ] |
| OBJ-005 | Verify deployed URL responds 404 for `/`, `/index.html`, `/lobby`, `/game` (confirm current state) | AC-001 | Playwright screenshot `01-landing-404.png` + curl test | [x] |
| OBJ-006 | Author `docs/plans/2026-09-20-dogfood-remediation/REQUIREMENTS.md` | Gate artifact | File exists and has AC table | [x] |
| OBJ-007 | Author `CODEBASE-STATE.md` with discovery evidence | Gate artifact | File exists with baseline + issue classification | [x] |
| OBJ-008 | Author `ARCHITECTURE.md` with current→target + edited areas | Gate artifact | File exists with area table | [x] |
| OBJ-009 | Author this `TODO.md` with ≥10 tickable objectives mapped to AC | Gate artifact | This file | [x] |
| OBJ-010 | Document that 404 requires Vercel redeploy/domain remap (deployment-level, not repo fix) | AC-001 | Note in `ARCHITECTURE.md` + user notification | [ ] |
| OBJ-011 | Add final remediation note to `docs/Dogfood/report.md` referencing this plan | AC-002 | Report updated with plan ID + status | [ ] |

**Evidence blocks (per V2 template):**
- `evidence/01-deployed-404-curl.md` — curl output for deployed paths.
- `evidence/02-local-200-curl.md` — curl output for localhost.
- `evidence/03-git-status.md` — `git status` output confirming no corruption.
