# Square → ShapeKeeper Merger — Implementation Plan (as executed)

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement. Commit after each green test.

**Goal:** Port the one Square smoothness technique ShapeKeeper lacked — particle object-pooling — into the live `dots-and-boxes-game.js` architecture without touching the Convex multiplayer layer.

**Architecture:** Pure additive change to `particle-system/core.js` (pool) + `particle-system.js` (wiring) + `particle-system/spawners.js` (pooled multiplier burst) + `constants.js` (pool size). No engine rewrite, no MP parity change.

**Tech Stack:** Vanilla ESM + Canvas 2D, Vitest (jsdom env), Convex (untouched).

---

## Investigation outcome (drove scope)

- **Task 2 (canvas listener rebind):** ALREADY DONE — `game-state.js:200` + `input-handler.js:170` already clone-and-rebind listeners on resize. No-op.
- **Task 3 (landscape grid):** DELIBERATELY REJECTED in current code (`game-state.js:142-152`) to avoid silently changing the selected grid + MP desync. Not implemented.

=> Only Task 1 (pooling) was a genuine port.

---

## Task 1: Particle object-pool — DONE

**Files changed:**
- `particle-system/core.js` — added `createParticlePool`, `spawnParticlesFromPool`, `updateParticlesFromPool`; `updateParticles` now releases dead particles to `system.pool`.
- `particle-system.js` — holds `this.pool`, `spawnParticles` acquires from pool + mirrors to legacy array.
- `particle-system/spawners.js` — `createMultiplierParticles` acquires from `system.pool`.
- `constants.js` — `PARTICLE_POOL_SIZE: 200`.
- `particle-system/core.test.js` — 3 passing pool tests.

**Verification:**
- `npm run lint` — clean on changed files
- `npm run test` — 82/82 pass
- `npm run build` — passes (no build step)

---

## Final verification

- `npm run lint` ✅
- `npm run test` ✅ (82/82)
- `npm run build` ✅
