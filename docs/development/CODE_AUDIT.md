# Code Audit Report

> Last reviewed: 2026-07-12 (v4.3.0, commit ec051fb)
> Scope: full project — code quality, lint, tests, architecture, docs

## Overview

- **Language:** Vanilla JavaScript (ES6+ modules), no frontend build step
- **Version:** 4.3.0
- **Deployment:** Vercel (static frontend) + Convex (backend)
- **Entry point:** `index.html` → loads `game.js` as a browser ES module
  (`src/index.js` is a library/barrel module, not the app entry)
- **Grid model:** Squares-only since v4.3.0 — triangle mechanics were removed
  in commit `ec051fb` (net −2,152 lines across 35 files).

## Architecture (current, v4.3.0)

The code is split into two layers:

1. **Root-level runtime modules** orchestrated by `dots-and-boxes-game.js`
   (924 lines) — the authoritative `DotsAndBoxesGame` class.
2. **`src/` shared modules** — reusable engine pieces (`core`, `effects`,
   `animations`, `sound`, `ui`, plus `src/animations`, `src/effects`).

Key module sizes (lines):

| File | Lines | Responsibility |
| ---- | ----- | -------------- |
| `dots-and-boxes-game.js` | 924 | Game orchestrator / public API |
| `game-state.js` | 388 | Game state model + transitions |
| `game-logic.js` | 240 | Pure rules (square detection, scoring, turns) |
| `tutorial-system.js` | 323 | Guided first-play flow |
| `animation-system.js` | 245 | Particle / square / multiplier / flash animations |
| `renderer.js` + `renderer/board.js` + `renderer/markers.js` | 215 / 282 / 98 | Canvas drawing |
| `ui-manager.js` + `ui-manager/*` | 257 / 361 / 74 | DOM overlays, celebrations, effects UI |
| `effect-system.js` + `effect-system/*` | 116 / 329 / 94 | Tile effects gameplay + modal |
| `convex-client.js` + `convex-client/*` | 77 / 181 / 167 | Convex API wrapper (rooms, subscriptions) |
| `input-handler/pointer-controls.js` | 324 | Mouse/touch input |
| `achievement-system.js` | 273 | Achievements + persistence |
| `local-save-replay.js` | 244 | Save/load + replay |
| `src/core/utils.js` | 177 | Shared key helpers (tested) |
| `src/effects/TileEffects.js` | 468 | Trap/powerup definitions |
| `src/animations/*`, `src/sound/*` | — | Animation + audio systems |

## Performance Analysis

### Animation Loop

- Uses `requestAnimationFrame` with conditional redraws (GOOD).
- All transient animation arrays are compacted via
  `_compactAnimationArray()` (v4.3.0) — verified no unbounded growth in the
  particle/square/line systems.

### Memory Management

| Array | Lifecycle |
| ----- | --------- |
| `pulsatingLines` | Cleaned on interval ✓ |
| `squareAnimations` | Cleaned after duration ✓ |
| `particles` | In-place compaction (v4.3.0) ✓ |
| `sparkleEmojis` | Cleaned after duration ✓ |
| `multiplierAnimations` | Cleaned after duration ✓ |
| `lineDrawings` | Cleaned after duration ✓ |
| `touchVisuals` | Cleaned after duration ✓ |
| `ambientParticles` | Persistent, frame-skipped (v4.3.0) ✓ |

**Status:** GOOD — all temporary arrays have a bounded lifecycle.

### Network Optimization

Turn-based multiplayer uses state-change detection with host-side validation
in Convex (documented ~20× traffic reduction, 100 KB/min → 5 KB/min).

## Code Quality

### Coordinate Parsing

- ✅ [DONE] `parseSquareKey()`, `parseLineKey()`, `getLineKey()` exist in
  `src/core/utils.js` and are covered by `src/core/utils.test.js`. The audit's
  original recommendation to extract these helpers has been implemented.

### Magic Numbers

- Partially addressed: animation timings live in `GAME_CONSTANTS`
  (`src/core/constants.js`). Some dot/line visual constants remain inline in
  `renderer.js`; acceptable.

### Lint / Format

- ✅ [DONE as of 2026-07-12] `npm run lint` is clean (0 errors, 0 warnings)
  after the review cleanup. The `no-unused-vars` rule now honors the `_`
  prefix convention for intentionally-unused params (see `eslint.config.mjs`).

## Test Coverage (v4.3.0)

| Area | Status |
| ---- | ------ |
| Game rules / scoring (`dots-and-boxes-game.test.js`) | ✅ 7 tests |
| Input handler (`input-handler.test.js`) | ✅ |
| Convex client (`convex-client.test.js`) | ✅ 11 tests |
| Achievement system (`achievement-system.test.js`) | ✅ 4 tests |
| Local save / replay (`local-save-replay.test.js`) | ✅ 3 tests |
| Core utils (`src/core/utils.test.js`) | ✅ 4 tests |
| UI — MultiplayerStartup (`src/ui/MultiplayerStartup.test.js`) | ✅ 3 tests |
| Tutorial system (`tutorial-system.test.js`) | ✅ 13 tests (added 2026-07-12) |
| E2E (Playwright, `tests/e2e/`) | ✅ Comprehensive suite (requires live server) |

**Total unit tests: 50 passing.** Previously uncovered modules
(`animation-system.js`, `sound-manager.js`, `ui-manager.js`, `effect-system.js`)
remain gaps but are largely DOM/Web-Audio bound; the highest-risk uncovered
logic (`tutorial-system.js`) now has unit coverage.

## Bottleneck Summary

- **Critical:** NONE
- **Medium:** String-key parsing in draw loops (mitigated by cached helpers).
- **Low:** Profile 30×30 grids with heavy animation; object pooling if needed.

## Conclusion

**Overall Code Quality: GOOD.** The codebase is well-modularized post-refactor,
memory is bounded, network is optimized, and lint is clean. Remaining work is
documentation accuracy (see `REFACTORING_PLAN.md`) and broadening unit coverage
for DOM-bound systems.
