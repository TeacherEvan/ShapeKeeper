# ShapeKeeper Optimization Audit — 2026-07-12

## Scope
Static + runtime audit of the browser game (vanilla ES modules, no bundler).
Stack: `package.json` (`convex` dep, `vitest`, `eslint`, `prettier`). No `dist/` /
Vite / Next — so Vite-specific Phase 1.1 tooling from the skill was NOT applicable;
adapted to the real scripts (`npm test`, `eslint .`, `node -c`).

## Baseline (before changes)
- **Tests:** `npx vitest run` → 13 files, **82 tests PASS**.
- **Lint:** `eslint .` → 204 prettier-formatting errors + 5 no-unused-vars warnings,
  concentrated in `tests/e2e/*`, `bench.mjs`, and scratch AI-sim files (`ai_*.mjs`
  per gitignore). None in the changed runtime files. Formatting errors are style-only
  and do not block the `verify` script.
- **Verify:** `npm run verify` (convex typecheck + `node -c` on game/welcome/convex-client) passes.

## Architecture finding (HIGHEST IMPACT — not auto-fixed)
The repo contains **two parallel module trees**:
1. **Live runtime** (loaded by `index.html`): root `game.js`/`welcome.js`, `convex-client/*`,
   `animation-system.js`, `particle-system.js`, and `src/ui/*` (MenuNavigation, ThemeManager,
   MultiplayerStartup, etc.).
2. **Abandoned / drifted migration** in `src/core`, `src/effects`, `src/sound`,
   `src/animations` — reachable from NO entry point in the runtime import graph.

The five duplicated modules are **not identical — they have drifted** (line counts differ,
logic differs):
```
constants.js (276)        vs src/core/constants.js (395)        DIFFERENT
utils.js (178)            vs src/core/utils.js (349)            DIFFERENT
sound-manager.js (257)    vs src/sound/SoundManager.js (273)    DIFFERENT
particle-system.js (213)  vs src/effects/ParticleSystem.js (350) DIFFERENT
animation-system.js (246) vs src/animations/SquareAnimations.js(245) DIFFERENT
```
Only `docs/planning/REFACTORING_PLAN.md` references the dead `src/*` subtrees.

**Measured dead code:** import-graph walk from live entry points + `convex-client/*`
script tags found **32 unreached JS files ≈ 5,417 LOC** (incl. the whole `src/core`,
`src/effects`, `src/sound`, `src/animations` subtrees and the unrun e2e suite).

**Recommendation (user decision, NOT applied here):** either (a) delete the dead `src/*`
subtrees + their tests to shrink maintenance surface and remove drift risk, or
(b) finish the migration so `src/*` becomes the live tree and the root copies become dead.
Left untouched to respect the NO-FEATURE-CHANGES gate and pending user direction.

## Applied fixes (behavior-preserving, measured O(n²) → O(n))
### 1. `particle-system.js` — `spawnParticles()`
Before: `for (const p of this.pool.active) if (!this.particles.includes(p)) …`
(`includes` rescans the array per active particle ⇒ **O(active × particles)**).
After: build a `Set` once, membership check O(1) ⇒ **O(active + particles)**.

### 2. `renderer/board.js` — `drawLines()` (runs every frame)
Before: per-line `game.lineDrawings.some(...)` + `game.pulsatingLines.find(...)` ⇒
**O(lines × drawings) + O(lines × pulsating)** per frame.
After: precompute `lineDrawingKeys` (Set) + `pulsatingByLine` (Map) once ⇒ **O(n)** per frame.

### 3. `renderer/board.js` — `drawSquaresWithAnimations()` (runs every frame)
Before: per-square `game.squareAnimations.find(item => item.squareKey === k)` ⇒
**O(squares × animations)** every frame — worst on 30×30 grids (~900 squares).
After: precompute `animationBySquare` Map once ⇒ **O(squares + animations)** per frame.

No UI strings, CSS, or HTML changed. Signatures/return values unchanged.

## Verification (after changes)
- `npx vitest run` → **13 files / 82 tests PASS** (unchanged).
- `npx eslint particle-system.js renderer/board.js` → **0 errors**.
- `node -c particle-system.js && node -c renderer/board.js` → syntax OK.
- No visual/functional regression by construction (lookup results identical; only the
  iteration strategy changed).

## Metric improvement
No bundle step to gzip-size; gains are runtime render-frame complexity reductions:
- spawnParticles: O(a·p) → O(a+p)
- drawLines/drawSquaresWithAnimations: O(lines·anim) and O(squares·anim) → O(lines+anim)
On a 30×30 board these are the per-frame hot paths; the change removes quadratic scaling
as animations/particles accumulate during combo chains.

## Handoff
- `documentation-maintenance` skill: not invoked (not installed in this environment).
  Per skill §4.2, handoff satisfied by this inline report at
  `docs/plans/2026-07-12-shapekeeper-optimization.md`.
- Suggested follow-ups (require user approval, out of scope for this audit's no-change gate):
  - Decide dead-`src/*` disposition (delete vs. complete migration).
  - Run `eslint . --fix` to clear the 204 prettier style errors repo-wide.
  - Add a render-frame perf guard (e.g. capture a frame-time marker in `Renderer.draw`)
    to catch future O(n²) regressions in hot paths.
