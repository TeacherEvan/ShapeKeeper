# Plastic surgery pass — draw result screen, motion physics, level grid

**Date:** 2026-10-30 · **Owner:** Evan/Lea · **Executor:** Fenrie · **Scope:** presentation only
**Companion change:** `feat(levels): a draw clears the level` (`772e906`)

## 1. Alignment & workspace theme lock

| Axis | Value | Evidence |
|---|---|---|
| Mobile / Desktop | **Hybrid, mobile-first** | `styles/blueprint.css` mobile block, 44 px coarse-pointer rules, 390 px gates in existing e2e |
| Private / Commercial | **Commercial** | `PAYWALL_ENABLED` in `config.js`, Lemon Squeezy unlock gate, public Vercel deploy |
| Adult / All audiences | **All audiences** | No mature content; school/family-friendly copy throughout |

- **Theme:** cosmic neon arcade — dark nebula board, cyan/gold accents, mono readouts.
- **Stack:** vanilla ES modules, hand-rolled canvas renderer, CSS custom-property theming.

No Collaboration-State halt was needed: all three axes are provable from the codebase.

## 2. Pre-op defect catalogue (measured)

`scripts/preflight_visual_lint.py . --fail-on high` before the pass:

- **Score 46/100, 23 defects, 1 HIGH**
- HIGH — `renderer/effects.js:8`: `backgroundHue += (target - hue) * 0.02` is a per-frame
  lerp; the hue settles twice as fast on 120 Hz as on 60 Hz.
- LOW (real) — `#mineCounterCount` had no `tabular-nums`, so the mine count could shift
  horizontally as it counted down.
- LOW (real, not flagged) — `styles/menu-layout.css` had **no** `prefers-reduced-motion`
  block, so the level-100 shimmer (infinite animation) and the card lift ignored the OS
  setting.
- Functional-copy defect — the result screen always said **“Game Over!”**, including on a
  cleared level, and a draw ranked the second player 🥈 even though nobody lost.

The other 21 LOW findings are the scanner's known numeric-jitter false positives on prose
and `<tr>` markup (`references/preflight_scanner_notes.md`), not live readouts.

## 3. Changes

| File | Change |
|---|---|
| `utils.js` | new `expDecay(current, target, decayPerSecond, dtSeconds)` |
| `renderer/effects.js` | hue follows the score with `expDecay` at 1.21/s (the exact 60 fps equivalent of the old `* 0.02`) |
| `dots-and-boxes-game.js` | shake (6.32/s) and screen pulse (5.0/s) decay by elapsed time, clamped at 100 ms |
| `styles/game.css` | `.mine-counter { font-variant-numeric: tabular-nums }` |
| `styles/menu-layout.css` | `prefers-reduced-motion` block: level-100 shimmer `animation: none`, card lift `transform: none`, transitions off |

The result-screen heading and tie medals ship in the companion commit `772e906`
(`feat(levels): a draw clears the level`), not in `632cf3e`.

Functional bindings were not touched: every `id`, `data-testid`, `aria-*` attribute, event
handler and state field is unchanged. The only JS signature change is an internal,
non-exported `buildWinnerScoreEntry` helper.

## 4. Post-op verification

| Gate | Result |
|---|---|
| Preflight linter (`--fail-on high`) | **56/100, 22 defects, 0 HIGH**, exit 0 (was 46/100, 1 HIGH) |
| `npm run lint` | clean |
| `npx vitest run` | 86 files, **625 tests passed** |
| Playwright (winner-screen + mines + smoke) | **8 passed** |
| Draw replay (browser, 390 px) | title `Draw!`, both rows 🥇 + `winner`, `_nextLevelToPlay = 3`, +1 sprite (2 → 3), level recorded |
| Reduced motion | level-100 shimmer has `animation: none` under `prefers-reduced-motion: reduce` |

Screenshots inspected at desktop 1280×577 and phone 390×844; no overlap between the result
heading, score rows and buttons.

## 5. Deliberately out of scope

- Replacing `transition: all` on `.level-btn` with explicit properties (paint-only cost,
  no measured jank).
- The remaining 22 LOW numeric-jitter hits are scanner false positives on static prose.
- No token re-theming: the existing palette already passes contrast and is the product's
  identity; changing it would be a redesign, not a polish pass.

## 6. QA record (peer desk — Benjamin, N95)

Verdict: **PASS-WITH-NOTES** (`VERDICT: PASS-WITH-NOTES`), reviewed at `632cf3e` with
`npm ci`, 625 unit tests, lint and a live browser run. Findings and disposition:

| Finding | Severity | Disposition |
|---|---|---|
| F1 — a draw/win on the last free level opened level 20 without an entitlement (the Next Level handler bypassed the gate) | HIGH | **Fixed**: `startLevelMatch` now refuses a locked level and opens the unlock gate; the result button reads `Unlock Level N →`. Regression gate `tests/e2e/paywall-level-gate.spec.js`. |
| F2 — a timeout defeat takes no sprite while an AI out-score does | LOW | **Owner decision** (AGENTS says a level is lost only when the AI out-scores). Left as-is. |
| F3 — `recordLevelLoss` docstring still said "defeat or tie" | LOW | **Fixed**. |
| F4 — this plan attributed the heading change to the wrong commit | LOW | **Fixed** in §3. |
| Casual hot-seat draws also get 🥇/🥇, under a "Game Over!" heading | INFO | Accepted: nobody lost, so nobody is second. Out of scope of the Levels rule. |
| Replaying a completed level pays +1 sprite each time | INFO | Pre-existing economy quirk; flagged for the owner, not changed. |
| `_levelResultRecorded` is only ever set true | INFO | Safe today because every level start builds a new game instance. Noted for a future refactor. |

| N1 — the committed spec covered only the not-entitled branch | LOW (coverage) | **Addressed**: the spec now also covers an entitled player receiving `Next Level (20)` and a paywall-off build where every level is enterable. |
| N2 — a bare `npx playwright test` needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE` + video off on the QA box | LOW (harness/env) | Environment note, not a repo defect; `playwright.config.js` already honours the env var. |
