# PLAN — Main-Menu CTA Rename (tickable, 25 objectives)

**Feature:** `FEATURE_PR: main-menu-cta-rename`
**Branch:** `feature/main-menu-cta-rename` (from `main` @ `02618d9`)
**Companions:** `2026-08-15-main-menu-cta-INDEX.md` · `2026-08-15-main-menu-cta-ARCHITECTURE.md`
**Rule:** every objective has an exact command or exact `path:line` + a verification line. Tick only on real output.
**Objective count:** A1-A4 (4) + B1-B7 (7) + C1-C8 + C7a (9) + D1-D5 (5) = **25** ≥ 10 ✔

## TARGET label contract (single source of truth for the POST-change state)

This is the **target**. INDEX §2 documents the **baseline** and is deliberately different — that
delta is the feature. Cross-doc agreement is required on the *target* table only.

| Menu pos | New label | Element id (UNCHANGED) | data-testid (UNCHANGED) | Class | Route |
|---|---|---|---|---|---|
| 1 | `START GAME` | `localPlayBtn` | `local-play-button` | `menu-btn` (primary) | `localSetupScreen` |
| 2 | `HOST AGAINST FRIENDS` | `createGameBtn` | `create-game-button` | `menu-btn secondary` | `lobbyScreen` |
| 3 | `JOIN AGAINST FRIENDS` | `joinGameBtn` | `join-game-button` | `menu-btn secondary` | `joinScreen` |

---

## Phase A — Ground truth

- [x] **A1. Confirm branch + clean base.**
  `git rev-parse --abbrev-ref HEAD` → `feature/main-menu-cta-rename`.
  **Verify (AMENDED):** at doc-capture time `git status --short` showed only the 3 new
  `docs/plans/2026-08-15-main-menu-cta-*.md` files (the DEBRIEF is written later, in D5).
  Post-implementation the expected status is: `M index.html`, `M src/ui/ScreenTransition.js`,
  `?? docs/plans/2026-08-15-main-menu-cta-{INDEX,ARCHITECTURE,PLAN}.md`, `?? docs/plans/log#1.txt`,
  `?? tests/e2e/main-menu.spec.js`. Nothing else.

- [ ] **A2. Re-verify the button block before editing.**
  `sed -n '75,93p' index.html`
  **Verify:** 3 buttons in order `createGameBtn`, `joinGameBtn`, `localPlayBtn` with texts
  `Create Game`, `Join Game`, `Local Play (2 Players)`. If it differs, STOP — INDEX doc is stale.

- [ ] **A3. Record baseline gates.**
  `npx eslint . 2>&1 | tail -3` and `npx vitest run 2>&1 | tail -4`
  **Verify:** exactly 14 eslint errors (3 e2e specs, all `prettier/prettier`) and 78/78 vitest pass.
  Any deviation is pre-existing breakage and must be reported, not silently fixed.

- [ ] **A4. Prove zero text-coupling in tests (guards against a false "safe" claim).**
  `grep -rn "Create Game\|Join Game\|Local Play" tests/ src/ *.test.js`
  **Verify:** zero hits. (`Triangle/canvasBonusFeature.md` is a doc, excluded.)

---

## Phase B — Implementation (`index.html` ONLY)

- [ ] **B1. Reorder: move the `#localPlayBtn` block to position 1** inside `.menu-options`
  (`index.html:75-93`). Preserve `id`, `data-testid`, and all attributes byte-for-byte.
  **Verify:** `grep -n 'id="localPlayBtn"\|id="createGameBtn"\|id="joinGameBtn"' index.html` →
  line numbers ascend in the order localPlay → createGame → joinGame.

- [ ] **B2. Relabel position 1 → `START GAME`** (replaces `Local Play (2 Players)`).
  **Verify:** `grep -n "START GAME" index.html` returns exactly 1 line, inside the `#localPlayBtn` element.

- [ ] **B3. Relabel position 2 → `HOST AGAINST FRIENDS`** (replaces `Create Game`) on `#createGameBtn`.
  **Verify:** `grep -c "Create Game" index.html` → `1` (only the `<!-- Create Game / Lobby Screen -->`
  comment at `:204` survives; the button text is gone).

- [ ] **B4. Relabel position 3 → `JOIN AGAINST FRIENDS`** (replaces `Join Game`) on `#joinGameBtn`.
  **Verify:** `grep -n "Join Game" index.html` → only `<h1 id="joinScreenTitle">Join Game</h1>` (`:314`,
  a different screen) and the `<!-- Join Game Screen -->` comment remain.

- [ ] **B5. Rebalance visual hierarchy: exactly one primary.**
  `#localPlayBtn` → `class="menu-btn"`; `#createGameBtn` and `#joinGameBtn` → `class="menu-btn secondary"`.
  **Verify:** `grep -n 'class="menu-btn' index.html | sed -n '1,3p'` → 1 bare `menu-btn`, 2 `menu-btn secondary`.
  No `.css` file edited: `git diff --name-only styles/` → empty.

- [x] **B6. Confirm zero JS/CSS drift.**
  `git diff --name-only`
  **Verify (AMENDED):** `index.html` + `src/ui/ScreenTransition.js` + `docs/plans/...`.
  `styles/` and `convex/` must be absent. The `ScreenTransition.js` diff is the focus-order fix
  mandated by C7 — see objective C7a and ARCHITECTURE §7. Any OTHER `src/` file = investigate.

- [ ] **B7. Format + lint the changed file.**
  `npx prettier --write index.html && npx eslint index.html`
  **Verify:** eslint clean for `index.html`; total repo errors still 14 (the pre-existing 3 specs).

---

## Phase C — Playwright contract tests

- [ ] **C1. Create `tests/e2e/main-menu.spec.js`** using `gotoApp` from `./helpers/bootstrap.js`.
  Locator policy: `getByRole('button', { name: <label> })` for label assertions (per Playwright
  locator guidance — role+name is the only locator that fails when copy regresses).
  **Verify:** file exists, imports resolve, `npx eslint tests/e2e/main-menu.spec.js` clean.

- [ ] **C2. Test: all three new labels are visible.**
  Assert `START GAME`, `HOST AGAINST FRIENDS`, `JOIN AGAINST FRIENDS` visible on `#mainMenuScreen`.
  **Verify:** test passes; then mutate a label locally to prove it FAILS (mutation check), restore.

- [ ] **C3. Test: DOM/visual order is 1-2-3.**
  `.menu-options .menu-btn` nth 0/1/2 → ids `localPlayBtn`/`createGameBtn`/`joinGameBtn`.
  **Verify:** passes.

- [ ] **C4. Test: old labels are gone.**
  Assert `getByRole('button', { name: 'Create Game', exact: true })` and
  `{ name: 'Local Play (2 Players)' }` each have count 0.
  **Verify:** passes.

- [ ] **C5. Test: label → route wiring (3 clicks, 3 screens).**
  `START GAME` → `#localSetupScreen.active`; back; `HOST AGAINST FRIENDS` → `#lobbyScreen.active`;
  back; `JOIN AGAINST FRIENDS` → `#joinScreen.active`.
  **Verify:** passes — this is the objective that would catch a host/join mis-binding.

- [ ] **C6. Test: hierarchy + WCAG 2.2 target size.**
  `#localPlayBtn` NOT `.secondary`; the other two ARE; all three `boundingBox()` ≥44×44.
  **Verify:** passes.

- [x] **C7. Test: focus lands on `START GAME` after exiting a game** (the reorder side effect of
  `ScreenTransition.js`). Start local game → `#exitGame` → assert `#localPlayBtn` focused.
  **Result:** FAILED on first run — `document.activeElement` was `BODY`, not `#localPlayBtn`.
  Assertion was correct; the code was wrong. See C7a.

- [x] **C7a. Fix the focus-order defect this test exposed (UNPLANNED, added mid-run).**
  Root cause: `showScreen()` called `focusTarget.focus()` while the incoming screen was still
  `hidden`/`inert` — a silent no-op, so focus fell to `<body>`. Probe evidence:
  `{"immediately":"BODY","settled":"BODY","firstFocusable":"localPlayBtn"}` and
  `TABSEQ=["BODY","skip-link","localPlayBtn","createGameBtn"]`.
  Fix in `src/ui/ScreenTransition.js:13-48`: blur the outgoing control BEFORE the visibility flip,
  focus the incoming target AFTER it.
  **Verify:** C7 passes AND both `tests/e2e/aria-hidden-verify.spec.js` tests still pass
  (the warning the original code defended against must not regress). Both confirmed —
  `11 passed` on `main-menu.spec.js` + `aria-hidden-verify.spec.js`, chromium.
  Delete any temporary probe spec before commit (`tests/e2e/zz-debug-focus.spec.js` removed).

- [ ] **C8. Run the new spec.**
  `npx playwright test tests/e2e/main-menu.spec.js --project=chromium`
  **Verify:** all tests pass, 0 flaky. Iterate until green — do NOT weaken an assertion to pass.

---

## Phase D — Regression + delivery

- [ ] **D1. Full chromium suite.**
  `npx playwright test --project=chromium`
  **Verify:** no test that passed at baseline now fails. Record pass/fail counts verbatim.

- [ ] **D2. Unit gate unchanged.**
  `npx vitest run`
  **Verify:** 78/78 pass.

- [ ] **D3. Commit scoped source + tests + docs** (respect @BAN: no `convex/_generated/`,
  `node_modules/`, `playwright-report/`, `test-results/`, `.vercel/`, `.env.local`, `AGENTS.md`).
  `git add index.html tests/e2e/main-menu.spec.js docs/plans/2026-08-15-main-menu-cta-*.md`
  **Verify:** `git status --short` shows nothing banned staged.

- [ ] **D4. Push + open PR.**
  `git push -u origin feature/main-menu-cta-rename` then `gh pr create`.
  **Verify:** `gh pr view --json url,state` returns a URL; `git status -sb` shows `0 0` ahead/behind.

- [ ] **D5. Write `…-DEBRIEF.md`** with real numbers (eslint delta, vitest counts, playwright counts,
  files changed) and the reconciliation note on host=create.
  **Verify:** every number in the debrief is copied from actual tool output, none inferred.

---

## Consistency contract (checked by the reviewer subagent)

The reviewer must confirm, and record a `log#x.txt` on ANY mismatch:
1. The **TARGET** label/id/testid/class/route table is IDENTICAL in the PLAN header, ARCHITECTURE §2,
   and ARCHITECTURE §3. INDEX §2 holds the **BASELINE** table and is expected to differ from the
   target — verify only that INDEX's per-element `id ↔ data-testid ↔ route` identity triples match
   the target's, since ids/testids never change.
2. INDEX's "zero text-coupling" claim matches A4's real grep output, scoped to pre-existing specs
   (`main-menu.spec.js`'s own `RETIRED_LABELS` is an expected, documented exception).
3. ARCHITECTURE §5's changed-file table matches the real `git diff --name-only`
   (`index.html` + `src/ui/ScreenTransition.js` + new spec + docs; no `styles/`, no `convex/`).
4. Every PLAN objective's verification command references a path that exists.
5. Objective count ≥10 (this plan: 25).
6. INDEX §6's coupling inventory is exhaustive against
   `grep -rn "local-play-button\|create-game-button\|join-game-button\|localPlayBtn\|createGameBtn\|joinGameBtn" tests/`.

**Escalation (per user rule):** each failed review run appends a numbered `log#x.txt`. If the number of
recorded RUNS exceeds 5, STOP and request user assistance. A single run finding many mismatches is
not an escalation — it is a fix list.

## Review run history

| Run | Log | Verdict | Outcome |
|---|---|---|---|
| 1 | `docs/plans/log#1.txt` | FAIL — 7 mismatches (M1-M7) | All 7 corrected: baseline-vs-target framing (M1, M2), text-coupling scope note (M3), exhaustive 14-file coupling inventory (M4), objective count 16→25 (M5), A1 status (M6), `order:` wording (M7). Re-review dispatched as run 2. |
