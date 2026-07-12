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

## 3. Merger target — three concrete ports

### 3.1 Particle object-pooling (PERF)
**Source:** `Sqaure/game.js` `particlePool` / `returnParticleToPool` / `getParticleFromPool`.
**Target:** `particle-system/core.js` — add a fixed-capacity pool. Dead particles return to pool instead of being dropped; `spawnParticles`/`spawnSparkleEmojis` reuse pooled objects. Eliminates per-burst allocation + GC pauses on large grids (20×20, 30×30) and during combo chains.
**Risk:** low. Pure additive; no call-site change beyond `core.js` internals.

### 3.2 Clean canvas listener rebind on resize (INPUT SMOOTHNESS)
**Source:** `Sqaure/game.js:166-171` — clones the canvas node (`cloneNode(true)` + `replaceChild`) before re-binding listeners, so old handlers are discarded.
**Target:** `game-state.js` `setupCanvas()` — currently re-runs on resize (line 252/263). Verify it does not stack duplicate listeners on `gameCanvas`. If it does, adopt the clone-and-replace pattern (or `removeEventListener` by saved bound refs) so pointer/touch handlers are bound exactly once per canvas lifetime. This removes the subtle "double-click registers two lines / laggy input after a resize" class of bug.
**Risk:** low–medium. Must preserve `this.canvas`/`this.ctx` references used everywhere.

### 3.3 Landscape-adaptive grid (OPTIONAL / LOCAL-ONLY)
**Source:** `Sqaure/game.js:117-139` — derives `gridCols`/`gridRows` from container aspect ratio to fill wide screens.
**Target:** local + AI modes only. Multiplayer rooms sync a single `gridSize` for both players, so adaptive dims would desync the board — gate this behind `!isMultiplayer`. Keep square grids for networked play.
**Risk:** low if gated; **skip if it threatens MP parity.** Mark `Unfinished` in docs if deferred.

## 4. Non-goals (YAGNI)

- Do NOT port Sqaure's single-file class structure.
- Do NOT rebuild ShapeKeeper's engine (per user decision: Polish port, not Square-core rebuild).
- Do NOT port Sqaure's Truth-or-Dare squares (already superseded by ShapeKeeper's party-mode tile effects).
- Do NOT add a new multiplayer backend — ShapeKeeper's Convex layer is the keeper.

## 5. Verification

- `npm run lint` clean
- `npm run test` (vitest) green — add/extend unit tests for pooled-particle reuse + canvas rebind (no duplicate listeners).
- `npm run build` (verify script) clean
- Manual: resize the browser mid-game in local + AI mode; confirm input stays crisp, no stacked listeners (3.2). Trigger a 30×30 capture spree; confirm no GC stutter (3.1). Spot-check MP board parity unchanged (3.3 gated).

## 6. Execution

Single feature branch off `main`. Tasks 2–5 min each, TDD (write failing test → implement → pass → commit). See `2026-07-12-square-merger.md` for the task plan.
