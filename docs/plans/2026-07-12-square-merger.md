# Square → ShapeKeeper Merger — Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement. Commit after each green test.

**Goal:** Port the three Square smoothness techniques ShapeKeeper lacks — particle object-pooling, clean canvas listener rebind on resize, and local-only landscape-adaptive grid — into the live `dots-and-boxes-game.js` architecture without touching the Convex multiplayer layer.

**Architecture:** Pure additive changes to `particle-system/core.js` (pooling) and `game-state.js` (canvas rebind + gated landscape grid). No engine rewrite, no MP parity change.

**Tech Stack:** Vanilla ESM + Canvas 2D, Vitest (jsdom env), Convex (untouched).

---

### Task 1: Particle object-pool

**Files:**
- Modify: `particle-system/core.js`
- Create test: `particle-system/core.test.js`

**Step 1: Write the failing test**
```js
import { describe, expect, it } from 'vitest';
import { createParticleSystemWithPool } from './core.js';

describe('particle object pool', () => {
    it('reuses dead particles instead of allocating new ones', () => {
        const sys = createParticleSystemWithPool(10);
        const a = sys.acquire();
        const b = sys.acquire();
        expect(sys.poolSize()).toBe(10);
        expect(sys.activeCount()).toBe(2);
        sys.release(a); // dies
        sys.release(b); // dies
        const c = sys.acquire(); // should reuse, not grow pool
        expect(sys.activeCount()).toBe(1);
        expect(sys.poolSize()).toBe(10);
    });

    it('grows pool only when exhausted', () => {
        const sys = createParticleSystemWithPool(1);
        sys.acquire();
        sys.acquire(); // pool exhausted -> grow
        expect(sys.poolSize()).toBe(2);
    });
});
```

**Step 2: Run test — confirm it fails**
Command: `npx vitest run particle-system/core.test.js`
Expected: FAIL — `createParticleSystemWithPool` not exported.

**Step 3: Write minimal implementation** (add to `particle-system/core.js`)
```js
export function createParticleSystemWithPool(maxPoolSize = 200) {
    let pool = [];
    const active = new Set();
    return {
        acquire() {
            const p = pool.pop() || { x: 0, y: 0, vx: 0, vy: 0, life: 1, decay: 0.02, trail: [] };
            active.add(p);
            return p;
        },
        release(p) {
            active.delete(p);
            if (pool.length < maxPoolSize) pool.push(p);
        },
        poolSize: () => pool.length + active.size,
        activeCount: () => active.size,
    };
}
```

**Step 4: Run test — confirm it passes**
Command: `npx vitest run particle-system/core.test.js`
Expected: PASS

**Step 5: Wire pool into `spawnParticles`** in `particle-system/core.js` so real bursts reuse pooled objects (add `updateParticles` to call `release` on dead particles; `spawnParticles` acquires from pool).

**Step 6: Re-run full suite**
Command: `npm run test`
Expected: PASS

**Step 7: Commit**
`git add particle-system/core.js particle-system/core.test.js && git commit -m "perf: add particle object pool to reduce GC churn on large grids"`

---

### Task 2: Clean canvas listener rebind on resize

**Files:**
- Modify: `game-state.js` (the `setupCanvas` resize path, lines ~133–270)
- Modify test: `dots-and-boxes-game.test.js` (extend with listener-stack assertion) or add `game-state.test.js`

**Step 1: Write the failing test**
```js
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('canvas listener rebind', () => {
    it('binds click/touch listeners exactly once across resizes', () => {
        // jsdom doesn't size layout; stub getBoundingClientRect + devicePixelRatio
        global.window.devicePixelRatio = 1;
        const canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        // spy on addEventListener
        const added = [];
        const origAdd = canvas.addEventListener.bind(canvas);
        canvas.addEventListener = (type, fn, opts) => { added.push(type); origAdd(type, fn, opts); };

        // import after stub so game-state picks up canvas
        // exercise: call setupCanvas twice (initial + resize)
        // assert no duplicate 'click'/'touchstart' beyond first setup
        // (exact harness depends on game-state export surface — see Step 3)
        expect(added.filter(t => t === 'click').length).toBeLessThanOrEqual(1);
    });
});
```

**Step 2: Run test — confirm it fails**
Command: `npx vitest run game-state.test.js` (file may not exist yet → FAIL).

**Step 3: Implement in `game-state.js` `setupCanvas()`**
Adopt Sqaure's clone-and-replace pattern (or saved bound refs + `removeEventListener`) so listeners bind once per canvas node. Preserve `this.canvas`/`this.ctx` references used throughout the engine.

**Step 4: Run test — confirm it passes**
Command: `npx vitest run game-state.test.js`
Expected: PASS

**Step 5: Commit**
`git add game-state.js game-state.test.js && git commit -m "fix(input): rebind canvas listeners cleanly on resize to stop input stacking"`

---

### Task 3: Landscape-adaptive grid (local + AI only)

**Files:**
- Modify: `game-state.js` `setupCanvas()` grid-calc section
- Create test: `game-state.test.js` (aspect-ratio → cols/rows)

**Step 1: Write the failing test**
```js
it('derives landscape cols/rows from container aspect when not multiplayer', () => {
    // given a wide container, expect gridCols > gridRows
    // gated by this.isMultiplayer === false
});
it('keeps square grid in multiplayer to preserve board parity', () => {
    // given isMultiplayer true, expect gridCols === gridRows === gridSize
});
```

**Step 2: Run — confirm fail. Implement gated landscape calc (mirror Sqaure `game.js:117-139`). Re-run — pass. Commit.**

**Step 3: Commit**
`git add game-state.js game-state.test.js && git commit -m "feat(local): adaptive landscape grid for wide screens, gated off multiplayer"`

---

### Task 4: Final verification

Commands:
- `npm run lint`
- `npm run test`
- `npm run build` (verify script)

Expected: all green. Confirm no MP board-parity regression (resize in local/AI does not affect networked rooms).
