# ShapeKeeper Concept-Preserving Enhancements Implementation Plan (Enhanced)

> **Agent:** Anti-Gravity (solo) — optional subagents for Tasks 5–7
> **Enhanced sub-skills invoked:** writing-plans-enhanced + surgical-implementation (optional) + subagent-driven-development (optional)
> **Verification mode:** Visual / Transform / Test / Browser-observable

**Goal:** Harden and polish ShapeKeeper as a Dots-and-Boxes party game (hot-seat + online realtime) without changing what it is.

**Architecture:** Vanilla-JS ES modules + Convex backend + Vercel static hosting. No build step, no framework, no new runtime dependencies. All new behaviour is gated behind `FEATURE_FLAGS` (`constants.js`) or lives in existing modules (`src/ui`, `src/ai`, `src/timing`, `convex/games`, `convex/rooms`).

**Anti-Gravity boundary:** Nothing is shared externally. If subagents are used they get only this plan + file paths. Never pass `.env*`, Convex deploy keys, `hostTokenHash` values, or real passcodes. Subagents must not run `npx convex deploy`.

---

## Concept guardrails (what we will NOT do)

- No framework, bundler, or build step. No new gameplay genre (no power-ups outside the existing tile-effect system).
- Passcodes stay `[Adjective][Animal]`, server-generated, host-only (AGENTS.md).
- Party Mode stays "tile effects on every square"; Lava Timer stays a turn-expiry house rule.
- Scope per commit: one concern, conventional commit.

## Findings that shaped this plan (verified in repo, 2026-10-13)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Docs drift: AGENTS.md says Lava Timer is "default OFF", but `config.js` sets `FEATURE_LAVA_TIMER`/`FEATURE_SYNC_RESILIENCE` to `true` at runtime (`constants.js` defaults are `false`). | `config.js:22-28`, `constants.js:63-66` |
| F2 | Docs drift: README badge says 4.3.0; `package.json` is 4.5.0. Roadmap (Mar 2026) says Party Mode hidden + triangles off; README/AGENTS advertise both. Roadmap flagged this as an open product decision. | `README.md:2`, `docs/planning/COMPETITION_PRODUCTION_ROADMAP.md:59-65` |
| F3 | Repo hygiene: stray `ShapeKeeper/` (a Python venv), `myenv/`, `.kilo/worktrees/` copies at root; grep/lint can hit duplicate sources. AGENTS.md also names a canonical path (`/home/ewaldt/...`) that differs from this workspace. | `ls`, `.kilo/worktrees/royal-conkerberry/` |
| F4 | Open TODOs in `convex-client.js`: offline action queue, optimistic updates, mutation rate limiting. Server rate limit already exists (`convex/rate-limit.js`, used in `convex/games/draw.ts`, `state.ts`). | `convex-client.js:17-20` |
| F5 | AI has `easy/medium/hard` + `MinimaxEngine`/`ChainAnalysis`; replay/save module `local-save-replay.js` is imported by `dots-and-boxes-game.js` but I have not confirmed a user-facing UI for it. | `dots-and-boxes-game.js:21,517-535` |
| F6 | Dogfood report (2026-09-20): production URL returned `404 DEPLOYMENT_NOT_FOUND` — a deployment/domain issue, not a repo defect. | `docs/Dogfood/report.md` |
| F7 | Unit baseline at plan time (`npx vitest run`, 2026-10-13): **20 test files failed / 122 passed (142 files); 858 tests passed, 2 skipped, 0 individual test failures.** Failures are suite-level (file load/collect errors), cause not yet diagnosed — likely duplicate copies under `.kilo/worktrees/` (see F3) but unconfirmed. Task 0 triages; Task 2 may resolve. | vitest summary |

> [!NOTE]
> F5 and the rematch / reduced-motion / colour-blind items are marked **"confirm first"** in their tasks. I did not verify their absence, so each task opens with a read-only audit step.

---

## Task 0: Baseline and quality-gate snapshot

**Files:** none modified; evidence → `docs/plans/2026-10-13-concept-enhancements-evidence/00-baseline.md`

- [ ] **Step 1:** `git status --short` (expect clean) and `git rev-parse HEAD`.
- [ ] **Step 2:** Run gates in AGENTS.md order: `npm run lint`, `npx convex typecheck`, `npx vitest run`, `npm run build`, `npm run test:e2e:smoke`.
- [ ] **Step 3:** Record pass/fail counts and any pre-existing failures verbatim. Do not fix anything in this task.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** None (no UI change).
- [ ] **Transform claim:** `docs/plans/2026-10-13-concept-enhancements-evidence/00-baseline.md` exists with the five gate outputs.
- [ ] **Verification method:** File read.
- [ ] **Verification result:** _pending_

---

## Task 1: Truth alignment (docs ↔ code)

**Files:** Modify `AGENTS.md`, `README.md`; read `config.js`, `constants.js`, `index.html`, `welcome.js`.

- [ ] **Step 1:** Update AGENTS.md "Lava Timer" section to state: `constants.js` default `false`; `config.js` enables it at runtime unless `window.FEATURE_LAVA_TIMER === false` is set first (F1). Code is the source of truth.
- [ ] **Step 2:** Determine real runtime status of Party Mode and triangles/diagonals (read `index.html`, `welcome.js`, `dots-and-boxes-game.js`; run the app). Write the result into README "Features" so it lists only what ships.
- [ ] **Step 3:** Sync README version badge to `package.json` (4.5.0). Prefer a shields.io `npm`/static badge generated from one value; at minimum correct it by hand.
- [ ] **Step 4:** Resolve the AGENTS.md canonical-path line against reality (ask owner which path is canonical if unclear; do not guess).
- [ ] **Step 5:** Commit: `docs(agents): align lava-timer defaults, party/diagonal status and version with code`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** README feature list matches what the running app shows on the main menu.
- [ ] **Transform claim:** `AGENTS.md` Lava Timer section mentions `config.js` runtime default `true`; README badge reads 4.5.0.
- [ ] **Verification method:** `grep -n "FEATURE_LAVA_TIMER" AGENTS.md config.js`; browser snapshot of main menu vs README list.
- [ ] **Verification result:** _pending_

---

## Task 2: Repo hygiene

**Files:** Modify `.gitignore`, `eslint.config.mjs`, `vitest.config.mjs`.

- [ ] **Step 1:** Check what git tracks: `git ls-files ShapeKeeper myenv .kilo | head`. If untracked, add `ShapeKeeper/bin`, `myenv/`, `.kilo/` to `.gitignore`; if tracked, **stop and ask the owner** before `git rm`.
- [ ] **Step 2:** Add `.kilo/**`, `myenv/**`, `ShapeKeeper/**` to ESLint `ignores` and Vitest `exclude` so duplicate copies never run twice.
- [ ] **Step 3:** Run `npx vitest run --reporter=dot` and compare test-file count with the Task 0 baseline (should drop only by duplicates, if any).
- [ ] **Step 4:** Commit: `chore(repo): ignore venvs and agent worktrees in git, lint and vitest`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** None.
- [ ] **Transform claim:** `.gitignore`, `eslint.config.mjs`, `vitest.config.mjs` contain the new patterns; `git status` shows no stray dirs.
- [ ] **Verification method:** `git diff --stat`, `git status --short`, `npx vitest run` file count vs Task 0.
- [ ] **Verification result:** _pending_

---

## Task 3: Deployment availability (F6)

**Files:** `vercel.json` (read), possibly none modified. Deployment fix is outside the repo.

- [ ] **Step 1:** `curl -sI https://shapekeeper.vercel.app/` and `/?join=TEST`; record status.
- [ ] **Step 2:** If still 404 `DEPLOYMENT_NOT_FOUND`: read `vercel.json`; confirm no rewrite blocks `/`. Document that the fix is a Vercel project/domain remap and **ask the owner** to do/approve it. Do not deploy.
- [ ] **Step 3:** Add a post-deploy smoke script `scripts/check-deploy.sh` (`curl -fsS` root, assert `200` and that the body contains `ShapeKeeper`) and reference it from `CONTRIBUTING.md`.
- [ ] **Step 4:** Commit: `chore(deploy): add post-deploy availability check`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** Production URL shows the ShapeKeeper main menu instead of the Vercel 404 page (after owner remap).
- [ ] **Transform claim:** `scripts/check-deploy.sh` exists, executable, exits 0 on 200.
- [ ] **Verification method:** `curl -I` output + Playwright screenshot to `docs/plans/2026-10-13-concept-enhancements-evidence/03-prod.png`.
- [ ] **Verification result:** _pending (BLOCKED until owner remaps domain)_

---

## Task 4: Online resilience — close the `convex-client.js` TODOs

**Files:** Modify `convex-client.js`, `convex-client.test.js`, `src/ui/menu/syncHandlers.js` (via `src/ui/menu/`); read `convex/rate-limit.js`, `convex/games/draw.ts`.

- [ ] **Step 1 (audit):** Confirm server rate limit coverage: list which mutations in `convex/` call the rate limiter (`draw`, `state`) and which don't (`rooms/mutations.ts` join/create/leave). Write the list in the PR description.
- [ ] **Step 2 (test first):** In `convex-client.test.js` add failing tests: (a) a draw action issued while offline is held in a bounded queue (cap 1; only the latest pending move, because turns are sequential) and flushed on reconnect; (b) a stale queued move is dropped if the server snapshot's turn/version has moved on.
- [ ] **Step 3:** Implement the queue behind `FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE`. Reuse the existing reconnect path; no new transport.
- [ ] **Step 4:** Add rate limiting to any unprotected `rooms` mutations found in Step 1 (create/join), using the existing `convex/rate-limit.js`. Add Convex tests.
- [ ] **Step 5:** Remove the completed TODO lines (and only those) from the `convex-client.js` header. Leave the Redis TODO untouched (out of scope: Convex is the backend).
- [ ] **Step 6:** Gates: `npm run lint`, `npx convex typecheck`, `npx vitest run`, `npm run test:e2e:reliability`.
- [ ] **Step 7:** Commit (two commits): `feat(sync): bounded offline move queue`, `fix(rooms): rate-limit create/join mutations`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** With the network throttled/offline in a live match, the player's tapped line appears pending, then confirms on reconnect; no duplicate line.
- [ ] **Transform claim:** Convex `lines` state for the game contains exactly one entry for that move; unit tests assert queue cap and stale-drop.
- [ ] **Verification method:** `tests/e2e/reconnect.spec.js` (extended with offline-then-click) + screenshot before/after reconnect; vitest output.
- [ ] **Verification result:** _pending_

---

## Task 5: Play-again / rematch flow (confirm first)

**Files:** audit `src/ui/menu/eventBindings.js`, `convex/games/*.ts`, `tests/e2e/winner-screen.spec.js`.

- [ ] **Step 1 (audit):** Check whether winner screen offers a one-tap "Play again" for both local and online. Record in the PR description. If both exist and work, mark task **N/A** and stop.
- [ ] **Step 2:** Local: "Play again" reuses last config (grid, colours, mode, AI difficulty) via `local-save-replay.js` config snapshot rather than returning to setup.
- [ ] **Step 3:** Online: add a `requestRematch` Convex mutation (host+guest both opt in → new game in same room, same lobby). No new passcode generated; no passcode ever returned (AGENTS.md).
- [ ] **Step 4:** Tests: vitest for the mutation (both-accept → new game; single-accept → pending; timeout → clears); extend `winner-screen.spec.js`.
- [ ] **Step 5:** Commit: `feat(game): one-tap rematch for local and online`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** Winner screen shows a "Play again" button; after tapping, the board resets with the same settings and scores at 0.
- [ ] **Transform claim:** `rooms`/`games` tables show a new game linked to the same room; old game state is marked finished.
- [ ] **Verification method:** Playwright two-client run + screenshot of winner screen and fresh board.
- [ ] **Verification result:** _pending_

---

## Task 6: AI polish (hot-seat vs computer)

**Files:** `dots-and-boxes-game.js` (~L447–540), `src/ai/MinimaxEngine.js`, `src/ai/ChainAnalysis.js`, `tests/ai-*.test.js`.

- [ ] **Step 1 (audit):** Run `tests/ai-engine.test.js` and `tests/ai-chain-engine.test.js`; measure worst-case `hard` move time on the largest grid (30×30) with a throwaway script in `docs/plans/.../scratch/`.
- [ ] **Step 2:** If `hard` exceeds ~500 ms on large grids, add an iteration/time budget to `findOptimalMinimaxMove` with a graceful fallback to the chain heuristic; never block the UI thread >100 ms (use `setTimeout` slicing, matching the existing `aiTurnToken` cancellation pattern).
- [ ] **Step 3:** Add a visible "AI thinking…" indicator tied to `aiTurnToken`; announce through `AccessibilityAnnouncer`.
- [ ] **Step 4:** Tests: budget respected (mock timer), cancellation on game reset leaves no pending move.
- [ ] **Step 5:** Commit: `feat(ai): time-budgeted hard mode with thinking indicator`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** While the AI moves, the HUD shows "Thinking…"; it disappears when the line is drawn.
- [ ] **Transform claim:** Recorded move latency ≤ budget in the benchmark output.
- [ ] **Verification method:** Benchmark output saved to evidence file; browser screenshot mid-AI-turn.
- [ ] **Verification result:** _pending_

---

## Task 7: Accessibility and comfort (confirm first)

**Files:** `styles/base.css`, `src/ui/ThemeManager.js`, `src/a11y/AccessibleGridTree.js`, `animation-system.js`, `particle-system.js`, `tests/a11y-keyboard-navigation.test.js`, `tests/e2e/settings-and-theme.spec.js`.

- [ ] **Step 1 (audit):** `grep -rn "prefers-reduced-motion" styles src *.js` — `styles/base.css` already references it; check whether JS-driven effects (particles, screen shake, lava, fireworks) honour it.
- [ ] **Step 2:** If not: add a single `prefersReducedMotion()` helper in `utils.js` and gate shake/particles/fireworks on it. Gameplay and scoring must be unaffected.
- [ ] **Step 3:** Add a colour-blind-safe player palette option in `ThemeManager` (extra preset only; custom colours still work). Add contrast check for the default pair in a unit test.
- [ ] **Step 4:** Ensure the turn-expiry (lava) warning is not colour-only (add text/icon + announcer message).
- [ ] **Step 5:** Commit: `feat(a11y): reduced-motion for effects, colour-blind palette, non-colour lava warning`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** With OS reduced-motion on, completing a box shows no shake/particles; with the colour-blind palette selected, the two players are distinguishable in a greyscale screenshot.
- [ ] **Transform claim:** `localStorage` palette key persists across reload.
- [ ] **Verification method:** Playwright `page.emulateMedia({ reducedMotion: 'reduce' })` + screenshots; unit test output.
- [ ] **Verification result:** _pending_

---

## Task 8: Party Mode decision and guarded return

**Prerequisite:** owner decision (roadmap open item). Ask: *"Ship Party Mode in the live build, or keep it hidden?"* If "hidden": update README only (Task 1) and mark this task **N/A**.

**Files:** `effect-system.js`, `effect-system/`, `welcome.js`, `index.html`, `tests/e2e/*`.

- [ ] **Step 1:** Add `FEATURE_PARTY_MODE` flag (`constants.js`, default `false`, bridged via `game.js` like the others).
- [ ] **Step 2:** Show the Party toggle in local and online setup only when the flag is `true`; with it off the code path must still force non-party startup (current behaviour).
- [ ] **Step 3:** Adult-friendly content pass: confirm the dares/hypotheticals lists have a "mild/spicy" tier toggle so the party remains opt-in per lobby; the host's choice syncs to all clients.
- [ ] **Step 4:** Tests: effect trigger count equals completed boxes; online clients see identical effect for the same box (deterministic seed from game id).
- [ ] **Step 5:** Commit: `feat(party): flag-gated party mode with synced tile effects`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** Flag off → no Party toggle. Flag on → toggle shown; completing a box displays the tile-effect card on both clients.
- [ ] **Transform claim:** Game config contains `partyMode: true` and an effect seed for both clients.
- [ ] **Verification method:** Two-client Playwright run + screenshots on both pages.
- [ ] **Verification result:** _pending_

---

## Task 9: Performance guardrails

**Files:** `particle-system.js`, `src/particles/TypedParticlePool.js`, `renderer.js`, `tests/particle-soa.test.js`.

- [ ] **Step 1:** Profile a 30×30 game (Chrome performance trace, 60 s of AI vs AI). Save frame-time p95 to evidence.
- [ ] **Step 2:** If p95 > 16 ms on a mid-range profile (CPU 4× throttle), cap particles by device tier and skip ambient particles when `document.hidden`.
- [ ] **Step 3:** Add a test asserting the pool never exceeds its configured cap and that `dispose()` returns memory (extend `tests/memory-lifecycle.test.js`).
- [ ] **Step 4:** Commit: `perf(particles): cap by tier and pause when hidden`.

### Verify Visual & Transform Claims
- [ ] **Visual claim:** Effects look identical at normal load; fewer ambient particles on the throttled profile.
- [ ] **Transform claim:** Trace JSON/summary in evidence shows p95 frame time before/after.
- [ ] **Verification method:** DevTools trace summary; vitest memory-lifecycle output.
- [ ] **Verification result:** _pending_

---

## Self-Review

1. **Coverage:** F1–F7 each map to a task (F1/F2→1, F3→2, F6→3, F4→4, F5→5/6, F7→0). Accessibility, performance and party mode come from the concept itself.
2. **Placeholders:** Audit-first steps are explicit where I could not confirm current state (Tasks 5, 7); no invented files beyond `scripts/check-deploy.sh` and evidence files.
3. **Type/name consistency:** `FEATURE_PARTY_MODE` follows the existing `FEATURE_*` pattern; `requestRematch` is a proposed new mutation (does not exist yet).
4. **Visual/Transform completeness:** every task with a UI change has a screenshot/browser verification, not just unit tests.
5. **Anti-Gravity boundary:** stated in header; no secrets in this document.
6. **Source provenance:** no external packages or skills referenced; all claims cite repo files.

## Ordering and dependencies

`0 → 1 → 2` first (cheap, unblock trust in docs and tests). `3` runs any time (needs owner). `4` before `5` (rematch relies on resilient sync). `6`, `7`, `9` are independent and can be parallelised via subagents. `8` blocked on owner decision.

## Execution handoff

Options: **subagent-driven-development** (recommended for Tasks 6/7/9 in parallel) or **executing-plans** sequentially. Before accepting any subagent commit, run `git show --stat HEAD` to confirm no `.superpowers/`, `.github/workflows/` or `convex/_generated/` changes slipped in. Optional final pass: re-check every "Verification result" against the evidence directory.

## Open questions for the owner

1. Is Party Mode (and triangles/diagonals) meant to ship in the live build? (Task 8; also fixes README accuracy.)
2. Which repo path is canonical: AGENTS.md's `/home/ewaldt/...` or this workspace? (Task 1.)
3. Can I treat `ShapeKeeper/`, `myenv/`, `.kilo/` as disposable local artifacts if they are untracked? (Task 2.)
4. Who owns the Vercel domain remap for the production 404? (Task 3.)
