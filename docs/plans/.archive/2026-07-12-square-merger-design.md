# Square → ShapeKeeper Merger Design

**Date:** 2026-07-12
**Author:** Hermes (with TeacherEvan)
**Scope:** Polish port — keep ShapeKeeper's modular architecture + Convex multiplayer; port Square's remaining smoothness techniques.

## 1. Context

Two games in the TeacherEvan GitHub account:

- **ShapeKeeper** (`TeacherEvan/ShapeKeeper`, v4.3) — modular ESM engine (`dots-and-boxes-game.js` orchestrates `game-logic.js`, `renderer/`, `animation-system.js`, `particle-system/`, `input-handler/`, `ui-manager.js`), full Convex backend (rooms/players/lines/games), AI opponents, party mode (tile effects), achievements, tutorial, welcome animation. Mature vitest + Playwright suites.
- **Sqaure** (`TeacherEvan/Sqaure`, v2.1, typo in repo name) — single 1431-line `DotsAndBoxesGame` class, no backend, no real multiplayer (only `MULTIPLAYER_PLANNING.md`).

User perception: Sqaure "feels smoother." Investigation shows ShapeKeeper already ported the obvious polish (thick lines, persistent line colors, multipliers, kiss/sparkle emojis, animated score counters, debounced resize, selection lock, multi-touch, populate, devicePixelRatio scaling). The residual "smoother" deltas are three engineering techniques, below.

## 2. Audit: what ShapeKeeper already has (no action)

| Square feature | ShapeKeeper location | Status |
|---|---|---|
| LINE_WIDTH 6 | `constants.js:12` | ✅ present |
| Persistent per-player line color | `renderer/board.js` + `gameLogic.getLinePlayer` | ✅ present |
| Multipliers (x2–x10) | `constants.js` + `effect-system` | ✅ present |
| Kiss/sparkle emojis | `animation-system.js` + `particle-system/spawners.js` | ✅ present |
| Animated score counters | `ui-manager.js:66-99` (`displayedScores`) | ✅ present |
| Debounced resize | `game-state.js` resize handler | ✅ present |
| Selection lock + click debounce | `input-handler/pointer-controls.js` | ✅ present |
| Multi-touch | `input-handler/pointer-controls.js` | ✅ present |
| Populate feature | `game-state.js` + `convex/games` | ✅ present |
| DPR scaling | `game-state.js:170` | ✅ present |

## 3. Merger target — implemented

### 3.1 Particle object-pooling (PERF) — DONE
**Source:** `Sqaure/game.js` `particlePool` / `returnParticleToPool` / `getParticleFromPool`.
**Implemented in:** `particle-system/core.js` (`createParticlePool`, `spawnParticlesFromPool`, `updateParticlesFromPool`) + wired into `particle-system.js` (pool held on the system, `spawnParticles`/`createMultiplierParticles` acquire from it, `updateParticles` releases dead particles back). `PARTICLE_POOL_SIZE = 200` added to `constants.js`.
**Effect:** eliminates per-burst allocation + GC pauses on large grids (20×20, 30×30) and during combo/multiplier chains.
**Tests:** `particle-system/core.test.js` (3 cases) — PASS. Full suite 82/82 PASS.

### 3.2 Clean canvas listener rebind on resize (INPUT) — ALREADY DONE (no-op)
**Finding:** `game-state.js:200` already calls `this.game.inputHandler?.rebindCanvas(newCanvas)`, and `input-handler.js:170-177` removes then re-binds listeners to the fresh canvas node created at `game-state.js:172-197`. This achieves exactly Sqaure's cloneNode-trick goal (no stacked listeners). No change needed.

### 3.3 Landscape-adaptive grid — DELIBERATELY REJECTED
**Finding:** `game-state.js:142-152` intentionally keeps the player-selected grid square (aspect-warping was previously reverted because it "silently changed the game the player selected"). Reintroducing Sqaure's aspect-ratio grid would regress that decision and threaten multiplayer board parity. Not implemented.

## 4. Non-goals (YAGNI)
- Do NOT port Sqaure's single-file class structure.
- Do NOT rebuild ShapeKeeper's engine.
- Do NOT port Sqaure's Truth-or-Dare squares (superseded by party-mode tile effects).
- Do NOT add a new multiplayer backend — Convex layer is the keeper.
- Do NOT re-introduce landscape grid warping (see 3.3).

## 5. Verification

- `npm run lint` clean
- `npm run test` (vitest) green — add/extend unit tests for pooled-particle reuse + canvas rebind (no duplicate listeners).
- `npm run build` (verify script) clean
- Manual: resize the browser mid-game in local + AI mode; confirm input stays crisp, no stacked listeners (3.2). Trigger a 30×30 capture spree; confirm no GC stutter (3.1). Spot-check MP board parity unchanged (3.3 gated).

## 6. Execution

Single feature branch off `main`. Tasks 2–5 min each, TDD (write failing test → implement → pass → commit). See `2026-07-12-square-merger.md` for the task plan.
