# DEBRIEF — Main-Menu CTA Rename (2026-08-15 plan)

**Resolution:** All 25 plan objectives (A1–A4, B1–B7, C1–C8, C7a, D1–D5) were
implemented and merged into `main` via commit **565300e** (PR #25,
"feat: rename + reorder main-menu CTAs"). The plan file's 21 unchecked boxes
were STALE doc state — they did not reflect the shipped code. Re-verified
green on **2026-08-20**; this debrief records the real numbers and closes the plan.

## 1. Executive Summary
Renamed and reordered the three main-menu CTAs from `Create Game / Join Game /
Local Play (2 Players)` to `HOST AGAINST FRIENDS / JOIN AGAINST FRIENDS /
START GAME`, with `START GAME` promoted to the single primary action. Found and
fixed a focus-management defect (C7 → C7a) during contract testing. Shipped and
verified; no regressions.

## 2. Original Request
`docs/plans/2026-08-15-main-menu-cta-PLAN.md` — rename + reorder the 3 menu CTAs,
preserve all element ids / data-testids / routes, keep one primary + two
secondary, and add Playwright contract tests plus a focus-landing test.

## 3. Initial State (at merge, commit 565300e)
- index.html: buttons `createGameBtn`, `joinGameBtn`, `localPlayBtn` in order
  Create / Join / Local Play (2 Players); all `menu-btn` (no hierarchy).
- No contract test for menu labels/order/route.
- Focus after exiting a game fell to `<body>` (silent no-op in ScreenTransition).

## 4. Research
None required (internal, self-contained UI change). No external deps added.

## 5. Architecture
- Target label/id/testid/class/route table finalized in PLAN header +
  ARCHITECTURE §2/§3 (ids and testids UNCHANGED; only label text + DOM order +
  class hierarchy changed).
- Side effect handled in `src/ui/ScreenTransition.js`: blur outgoing control
  BEFORE the aria-hidden/inert flip, focus incoming target AFTER it is visible.

## 6. Implementation (shipped in 565300e)
- `index.html`: reorder `localPlayBtn`→pos1, relabel to `START GAME`/`HOST
  AGAINST FRIENDS`/`JOIN AGAINST FRIENDS`, set `#localPlayBtn` to `menu-btn` and
  the other two to `menu-btn secondary`. Zero CSS/JS logic changed (button
  wiring already keyed on ids).
- `src/ui/ScreenTransition.js`:13–48 — focus-order fix (C7a).
- `tests/e2e/main-menu.spec.js`: 9 contract tests added (labels, retired labels,
  order, hierarchy, 44px target, 3 route mappings, focus landing).

## 7. Files Changed (per `git show --stat 565300e`)
- index.html (+34/−−)
- src/ui/ScreenTransition.js (focus fix)
- tests/e2e/main-menu.spec.js (new, 9 tests)
- docs/plans/2026-08-15-main-menu-cta-{INDEX,ARCHITECTURE,PLAN}.md + log#1/#2

## 8. Security Review
No credential, permission, or injection change. Pure front-end label/order
change + a focus-management fix. `.env.local` untouched and gitignored.

## 9. Validation (RE-RUN 2026-08-20, real output)
- `npx eslint .` → **0 errors** (exit 0). (At merge the repo had 14 pre-existing
  eslint errors in 3 e2e specs; tree has since been cleaned to 0.)
- `npx vitest run` → **114 passed (17 files)**, 0 failed (exit 0).
- `npx playwright test tests/e2e/main-menu.spec.js tests/e2e/aria-hidden-verify.spec.js --project=chromium`
  → **11 passed** (exit 0): 9 main-menu contract + 2 aria-hidden-verify
  (menu→game and exitGame→menu focus transitions, confirming C7a did not
  regress the warning the original code defended against).

## 10. Playwright
11/11 chromium contract + regression tests green. No flaky, no weakened assertion.

## 11. Consistency Review
PLAN target table ↔ ARCHITECTURE §2/§3 ↔ live index.html all agree (label,
id, testid, class, route). INDEX §2 baseline table differs from target as
designed. Coupling inventory: zero text-coupled tests (`grep -rn "Create
Game|Join Game|Local Play" tests/ src/` → 0 hits pre-merge).

## 12. Retry / Failure History
- Plan review runs 1–2 (log#1/#2): 7 mismatches corrected (baseline-vs-target
  framing, text-coupling scope, 14-file coupling inventory, objective count
  16→25, A1 status, `order:` wording). Re-review passed.
- C7 first run FAILED (focus on `<body>`, not `#localPlayBtn`) → root-caused to
  ScreenTransition blur/focus ordering → fixed in C7a → C7 green.

## 13. Git Summary
- Merged via PR #25 into `origin/main` at commit **565300e** (Aug 15, 2026).
- Post-merge `main` is up to date (no ahead commits as of 2026-08-20 audit).

## 14. Remaining Work
None for this plan. D5 (this debrief) was the only unfulfilled objective; now
complete. The plan file is archived to `docs/plans/.archive/` to prevent
re-derivation.

## 15. Final Recommendation
READY. Implementation verified green on current `main` (114 vitest, 0 eslint,
11 playwright). The 21 stale "open" checkboxes in the plan are closed by this
evidence; archive the plan.

## 16. Agent Handoff
- The feature is production-merged; no code action needed.
- Open hygiene items (separate from this plan): untracked leftovers
  `.prune/`, `surgical-pruning-0818-ShapeKeeper.html`, and stale
  `docs/.scratch-audit/` from a prior Surgical-Pruning run — candidate for
  cleanup (user authorization required for deletes).

## 17. Audit Metadata
- Run: surgical-implementation (git+codebase audit → plan reconciliation).
- Workspace: ewaldt@ewaldt-N95:/home/ewaldt/Documents/VS/GAMES/ShapeKeeper (TeacherEvan/ShapeKeeper, branch main).
- Verified: 2026-08-20. Evidence: eslint 0, vitest 114/114, playwright 11/11.
- Resolution: plan archived (DONE); no re-implementation performed.
