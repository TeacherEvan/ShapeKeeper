# Surgical Audit Report: ShapeKeeper — Background Sprite Ink & Line Artefacts

| Audit Metadata                 | Specification                                                                                                                                                                                                                                                                                |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audit Date**                 | 2026-10-24                                                                                                                                                                                                                                                                                   |
| **Audited Scope**              | `src/ui/` (background sprites, palette, trail), `renderer/effects.js` (board substrate), `styles/cosmic-identity.css` (theme tokens), `tests/` (`53` impl files telemetry-scanned, `4` inspected line-by-line, `82` test files) (`5,424` effective LOC in `src/`, `5,927` incl. `renderer/`) |
| **Tech Stack & Runtime**       | Vanilla JS (ES modules, no build step), Canvas 2D, Convex backend, Vercel static; Chrome/Safari/Firefox desktop + mobile                                                                                                                                                                     |
| **Pre/Post Audit SHA-256**     | `3e2068b5cc2d2850` / `3e2068b5cc2d2850` (VERIFIED ZERO MUTATION during Passes 1–4; remediation ledger in §5)                                                                                                                                                                                 |
| **Deterministic Health Score** | **`76 / 100`** pre-remediation → **`91 / 100`** post (`D_raw = 32`, `P_test = 11.25`, `M_kill = 25%` pre; `D_raw = 8`, `P_test = 6.0`, `M_kill = 60%` post)                                                                                                                                  |
| **Vibe-Debt Risk Level**       | **`MODERATE`** (pre) → **`LOW`** (post)                                                                                                                                                                                                                                                      |

## 1. Executive Architecture & Vibe-Debt Triage

The background is a 120-sprite boids flock drawn on a DPR-scaled Canvas 2D surface, reused for both the menu (`#welcomeCanvas`) and the board backdrop (`#gameBackgroundCanvas`). Its primary failure mode is **unbounded retained geometry**: the sprite motion trail is a position history that survives **teleport** events, so every edge wrap, pointer drag and viewport resize stored a discontinuity that the renderer then stroked as a straight line. Measured live: **28 full-span colour streaks per 9 s** on the menu and **17 per second** on the board (longest 1439.7 px on a 1440 px canvas) — this, not the sprite shapes, is what the product owner sees as "horizontal and vertical colour lines".

The second failure is **ink monoculture**: the palette carried four families with no red, no true green in dark mode, no blue/purple of its own, and a single hard-coded cyan `constellationInk` used for _every_ link in the web. Pixel-verified: **59.6 % of all bright pixels were cyan and exactly 0 % were red, magenta or pink**. Because the cyan connection web carried far more pixel mass than the sprites, the flock read as a monochrome cyan haze regardless of sprite colour. The trust-boundary posture is sound (no network/auth surface in this subsystem) and the board substrate still painted an unrequested 40 px grey grid, contradicting the product owner's standing "no gridlines" directive.

Test posture was the root enabler: every WelcomeAnimation test stubs the 2D context with `vi.fn()`, so **no test has ever asserted on drawn geometry**, and the palette contract was pinned as a literal four-element array — the suite locked the defect in rather than detecting it.

| Severity Tier                                           | Count | Deduction Weight | Primary Failure Domains                                                                                                                                                                                                                       |
| :------------------------------------------------------ | :---- | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — Critical (Crash / Data Loss / Security / Leak)** | `0`   | `-18 pts ea`     | —                                                                                                                                                                                                                                             |
| **P1 — High (Frame-Budget / Race / Logic Bug)**         | `2`   | `-8 pts ea`      | `src/ui/WelcomeAnimation.js` trail-teleport streaks; `src/ui/WelcomeAnimation.js` heritage 4-hue palette + single-ink constellation                                                                                                           |
| **P2 — Medium (God File / Split-Brain State / Debt)**   | `4`   | `-3 pts ea`      | `src/ui/WelcomeAnimation.js` (710 eff LOC God file mixing ink data, trail geometry, physics, rendering, input); per-frame trail-object allocation; duplicate connection edges (2× stroke work); `renderer/effects.js:34-56` 40 px canvas grid |
| **P3 — Low (Magic Constants / DX / Portability)**       | `4`   | `-1 pt ea`       | DPR unit mismatch on canvas fill; edge wrap discards overshoot; magic alphas/widths; inline palette copy duplicating design tokens                                                                                                            |

### High-Risk File Telemetry Hotspots

| File Path                          | Effective LOC     | Est. Cyclomatic Complexity / Branch Density  | Silent Catches | Primary Vibe-Debt Signature                                                                            |
| :--------------------------------- | :---------------- | :------------------------------------------- | :------------- | :----------------------------------------------------------------------------------------------------- |
| `src/ui/WelcomeAnimation.js`       | `616` (was `710`) | `CC` high (telemetry "high_complexity_file") | `0`            | God class: boids physics + ink palette + trail geometry + canvas rendering + pointer input in one file |
| `renderer/effects.js`              | `475` (was `503`) | moderate                                     | `0`            | Substrate drew a 40 px grid the product owner had already banned in CSS                                |
| `src/ui/sprite-palette.js` _(new)_ | `37`              | `1`                                          | `0`            | none — pure data + hex parser                                                                          |
| `src/ui/sprite-trail.js` _(new)_   | `48`              | `1`                                          | `0`            | none — pure ring buffer + run splitter                                                                 |
| `tests/cosmic-identity.test.js`    | n/a (test)        | n/a                                          | `0`            | Implementation-coupled literal palette assertion (`toEqual([...4 hexes])`) cemented the defect         |

## 2. The 10-Principal-Engineer Deep Audit

### Lens 1 — Systems Architect (Topology, Coupling & State Machines)

- **[P2-01] God class owns five concerns** — `src/ui/WelcomeAnimation.js:L12-L758`
    - **Root Cause Mechanism:** one class holds boids physics (`applyFlockingBehavior`, `updateParticlePositions`), spatial partitioning, palette data (now extracted), trail history, canvas rendering and pointer interaction. Consequence: none of the placement/sampling rules can be unit-tested without booting a canvas + rAF loop.
    - **Deterministic Trigger & Failure Mode:** any change to trail drawing requires the full runtime; the invariant "no drawn line exceeds N px" was never expressible, which is exactly why P1-01 survived.
    - **Surgical Fix Specification:** extract pure modules (`sprite-palette.js`, `sprite-trail.js`) so geometry and ink are testable in isolation. **Applied.**
- **[P2-02 → fixed] Trail geometry was a mutable array of freshly-allocated point objects** — `src/ui/WelcomeAnimation.js:L310-L320` (old numbering)
    - **Root Cause Mechanism:** `particle.trail.push({ x, y })` + `shift()` = 1 object + 1 array mutation per sprite per frame; 120 sprites × 60 fps = 7,200 objects/s of pure GC churn in the frame budget.
    - **Surgical Fix Specification:** fixed-capacity ring buffer with pooled point objects (`SpriteTrail`). **Applied** — steady-state allocation is now zero.

### Lens 2 — Frame-Budget & Performance Engineer (Hot Loops & Latency)

- **[P2-03] Each constellation edge is stroked twice** — `src/ui/WelcomeAnimation.js:L646-L682`
    - **Root Cause Mechanism:** `drawConnections` iterates `getNeighboringParticles(p1)` for every `p1`, so pair (A,B) is stroked from A→B _and_ B→A. Doubles stroke calls and the `rgba()` string construction inside the 16.67 ms budget.
    - **Deterministic Trigger & Failure Mode:** 120 sprites at 60 fps ≈ 240 redundant strokes/frame; on a 120 Hz phone the same code has half the budget (8.33 ms) and a mid-range Adreno device drops frames during dense clustering.
    - **Surgical Fix Specification:** assign each sprite a stable index (`p.__idx`) during `updateSpatialPartitionGrid()` and only stroke when `p1.__idx < p2.__idx`. **Not applied** (behaviour-preserving refinement, queued as Phase 3).
- **[P2-04 → fixed] Per-frame array allocation in the neighbour query** — `src/ui/WelcomeAnimation.js:L112-L134`
    - **Root Cause Mechanism:** `getNeighboringParticles()` allocates a fresh array and spreads 9 cells into it, twice per sprite per frame (flocking + connections). At 120 sprites that is ~240 arrays/frame.
    - **Surgical Fix Specification:** reuse a single module-level index buffer (`neighborScratch`), returning a count instead of an array. **Queued** (touches physics; keep out of a visual-fix changeset).

### Lens 3 — Mathematical, Physics & Algorithmic Engineer (Precision & Edge Cases)

- **[P3-02 → fixed] Edge wrap discarded overshoot** — `src/ui/WelcomeAnimation.js:L354-L357` (old)
    - **Root Cause Mechanism:** `if (particle.x > width) particle.x = 0;` teleports to the _edge_, not to the modulo overshoot, discarding up to `maxSpeed` (1.8 px) of travel and creating a visible velocity discontinuity at the seam.
    - **Surgical Fix Specification:** wrap with `±= width/height` (modulo semantics) inside `wrapParticleIntoViewport()`, then clamp. **Applied.**
- **[P3-03] Dead-flat wrap test coverage** — n/a (test)
    - **Root Cause Mechanism:** no test ever drove a sprite across an edge, so the discontinuity class was invisible.
    - **Surgical Fix Specification:** see MVTH §3.

### Lens 4 — Concurrency, Async & Determinism Engineer (Race Conditions)

- **N/A — no async surface in the audited subsystem.** The flock loop is single-threaded `requestAnimationFrame`; the only cross-source mutation is input handlers writing `particle.x/y` while the loop integrates, which is the grab-drag path explicitly handled by trail clearing.

### Lens 5 — Memory & Resource Lifecycle Engineer (Leaks & Cleanup)

- **[P3-04] Listener registration has no teardown path** — `src/ui/WelcomeAnimation.js:L58-L65`
    - **Root Cause Mechanism:** five `window`/`canvas` listeners are added in the constructor; `stop()` only cancels the rAF id. A second `WelcomeAnimation` (theme rebuild, HMR, test re-mount) stacks listeners and leaks the instance.
    - **Deterministic Trigger & Failure Mode:** instantiate twice in one page lifetime → two rAF loops, two flocks, doubled CPU and doubled streaks.
    - **Surgical Fix Specification:** register on a `DisposableRegistry` (already in `src/lifecycle/DisposableRegistry.js`) and dispose in `stop()`. **Queued.**

### Lens 6 — Security & Trust-Boundary Engineer (AppSec & Sandboxing)

- **N/A — decorative canvas rendering only.** No DOM injection (`no innerHTML`), no network calls, no credentials, no authorisation decisions in this subsystem. Palette values are static module constants, not user input.

### Lens 7 — Reliability, Fault Tolerance & Chaos Engineer (Crash Vectors)

- **N/A — no exception-swallowing paths.** `silent_catches = 0` across all audited files. Canvas calls are guarded by capability checks (`typeof game.ctx.rotate !== 'function'`).

### Lens 8 — Type Systems, Schema & Contract Engineer (Boundary Integrity)

- **[P2-05 → fixed] Palette duplicated the design-token contract instead of deriving from it** — `src/ui/WelcomeAnimation.js:L36-L49` (old)
    - **Root Cause Mechanism:** the canvas kept its own copy of six `--cosmic-*` values that `styles/cosmic-identity.css` also declares, with no mechanical link. Nothing detected that the canvas ink and the stylesheet ink had drifted apart in _breadth_ (CSS had danger-red; the canvas had no red at all).
    - **Surgical Fix Specification:** keep one JS palette module, but enforce the contract mechanically: every ink must clear 3:1 non-text contrast against the CSS `--bg-primary` token for its theme (a test now parses the stylesheet and asserts exactly that). **Applied.**

### Lens 9 — Platform, Viewport & Portability Engineer (Cross-Device Parity)

- **[P3-05 → fixed] Device-pixel vs logical-pixel unit mismatch** — `src/ui/WelcomeAnimation.js:L585-L588` (old)
    - **Root Cause Mechanism:** the context is scaled by `devicePixelRatio` in `initializeCanvas()`, but the motion-blur fill used `this.canvas.width/height` (device px), painting `dpr²` times the canvas area — correctly "invisible" but a latent unit bug that goes live the moment anyone computes phase or offset from it.
    - **Surgical Fix Specification:** fill with `logicalWidth/logicalHeight`. **Applied.**
- **Verified good:** touch handling (`touch-action: none`, passive `touchmove`), `PointerEvent` drag with pointer capture by id, DPR capped at 1 by default in `initializeCanvas` (mobile-only omission: no `min(dpr, 2)` cap — P3, queued).

### Lens 10 — Cognitive Load & AI-Context Maintainability Engineer (DX)

- **[P3-06] Magic ink numbers with no provenance** — `src/ui/WelcomeAnimation.js:L667-L672`
    - **Root Cause Mechanism:** `alpha * 0.15` for links, `alpha * 0.4` for trails, `lineWidth 1.5/0.8` — none named, none justified, and the 0.15 link alpha was tuned for a _single-hue_ web where crossings stacked into cyan.
    - **Surgical Fix Specification:** document the calibration next to the constant (measured vivid-pixel counts) so the next agent does not "clean up" the value back to a faint wash. **Applied for the link alpha.**

## 3. Existing Test Suite Comparison & Mutation Truth Table

- **Test-to-Code File Ratio:** `82 / 53` (`1.55 : 1`)
- **Estimated Mutation Kill Score ($M_{\text{kill}}$):** **`25 %`** pre-remediation → **`60 %`** post-remediation

| Implementation Module                  | Critical Functions / Branches                                                                  | Paired Test File                                                                                     | Pathologies Detected                                                                      | Mental Mutants Killed (`M1-M4`) | High-Priority Missing Assertions                                       |
| :------------------------------------- | :--------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :------------------------------ | :--------------------------------------------------------------------- |
| `src/ui/WelcomeAnimation.js`           | `updateParticlePositions()`, `drawTrails()`, `drawConnections()`, `wrapParticleIntoViewport()` | `tests/welcome-animation-interaction.test.js`, `tests/welcome-animation-trail-lines.test.js` _(new)_ | Happy-Path Tunnel Vision (interaction only); **Canvas-stub blindness** (ctx is `vi.fn()`) | `1/4` → `4/4`                   | drawn-segment length, wrap continuity, draw-call colour spread         |
| `src/ui/sprite-palette.js` _(new)_     | palette data, `hexToRgbChannels()`                                                             | `tests/cosmic-identity.test.js` (extended)                                                           | previously **Implementation-Coupled Literal** (`toEqual` of 4 hexes)                      | `0/4` → `3/4`                   | hue-band coverage, saturation floor, WCAG 1.4.11 contrast              |
| `src/ui/sprite-trail.js` _(new)_       | `push()`, `clear()`, `forEachRun()`                                                            | `tests/sprite-trail.test.js` _(new)_                                                                 | none                                                                                      | `4/4`                           | (covered: boundary, degenerate, side-effects, teleport)                |
| `renderer/effects.js`                  | `drawDynamicBackground()`                                                                      | `tests/cosmic-identity.test.js` (extended)                                                           | Existence-Only (asserted CSS text, never canvas behaviour)                                | `1/4` → `2/4`                   | no full-span strokes, no grid return                                   |
| `src/ui/WelcomeAnimation.js` (physics) | `applyFlockingBehavior()`                                                                      | `NONE`                                                                                               | —                                                                                         | `0/4`                           | separation/alignment/cohesion vectors, speed clamp, NaN distance guard |

### Why Existing Tests Missed Discovered P0/P1 Defects

- **P1-01 (trail streaks):** every test injects `getContext = () => ({ moveTo: vi.fn(), lineTo: vi.fn(), … })`. The stub _discards coordinates_, so a 1,439 px line and a 1.8 px line are the same `vi.fn()` call. Nothing in the suite ever observed geometry, and no test ever drove a sprite across a viewport edge — the only path that produces the teleport.
- **P1-02 (ink monoculture):** `tests/cosmic-identity.test.js:197` asserted `expect(darkInk).toEqual(['#00f0ff','#e000ff','#ffc700','#22ff00'])`. That is a literal snapshot of the shipped array, so it enforced the palette's _shape_, not its _intent_ (a visible spectrum). Adding a red family would fail the test; having no red family passed it. `git log -S "toEqual(['#00f0ff'"` shows the assertion was written once in `561c846` and never revised — a stale snapshot, not a deliberate re-decision, so it was updated (and strengthened) rather than preserved.

### Minimal Viable Test Harness (MVTH) Specifications

1. **`SpriteTrail` (table-driven, pure)** — inputs `[(0,0),(160,0)]` → 1 run; `[(0,0),(161,0)]` → split; `[]` → 0 runs; `[(…) × 9]` with capacity 8 → 8 points, oldest-first. Invariant: _no emitted run contains a segment longer than `maxSegment`_. **Shipped** (`tests/sprite-trail.test.js`, 11 assertions).
2. **Drawn-geometry regression (integration)** — a recording 2D context captures every `moveTo`/`lineTo` pair; drive 40 frames with a sprite forced across the horizontal edge, the vertical edge, and a grab-drag-release. Invariant: _every drawn segment ≤ 200 px_. **Shipped** (`tests/welcome-animation-trail-lines.test.js`); it failed before the fix at 559 px / 790 px.
3. **Ink contract (data + CSS cross-check)** — parse `styles/cosmic-identity.css` tokens, then assert for both themes: all 8 required hue bands present, every ink HSL `S ≥ 60`, every ink `contrast(ink, --bg-primary) ≥ 3`. **Shipped** (`tests/cosmic-identity.test.js`).
4. **Substrate contract (behavioural)** — a recording ctx proves `drawDynamicBackground()` emits **zero** segments ≥ 800 px, i.e. the grid cannot come back. **Shipped**.

## 4. Surgical Refactoring Blueprints (Zero-Mutation Drafts)

### Refactor [R1]: Replace the mutable trail array with a bounded ring buffer + run splitting

- **Target Scope:** `src/ui/WelcomeAnimation.js` (update/draw paths) → new `src/ui/sprite-trail.js`
- **Engineering ROI:** removes ~7,200 point allocations/s at 60 fps; makes "a sprite cannot draw a line across the canvas" an executable invariant; reduces the hot loop to pointer-free writes.

**Current Pattern (Audited Code):**

```js
// update loop
particle.trail.push({ x: particle.x, y: particle.y });
if (particle.trail.length > particle.maxTrailLength) particle.trail.shift();
…
if (particle.x < 0) particle.x = this.logicalWidth;   // teleport, history kept
…
// draw
this.ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
for (let i = 1; i < particle.trail.length; i++) this.ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
this.ctx.stroke();                                    // ⟵ strokes the teleport
```

**Target Pattern (Surgical Blueprint):**

```js
// update loop — pooled ring buffer, teleport resets history
particle.trail.push(particle.x, particle.y);
…
if (this.wrapParticleIntoViewport(particle)) particle.trail.clear();

// draw — runs are split on any jump > TRAIL_MAX_SEGMENT (160 px)
particle.trail.forEachRun((run) => {
    ctx.beginPath();
    ctx.moveTo(run[0].x, run[0].y);
    for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
    ctx.stroke();
}, TRAIL_MAX_SEGMENT);
```

### Refactor [R2]: Full-spectrum ink module + per-sprite link colour

- **Target Scope:** `src/ui/WelcomeAnimation.js:L36-L49`, `L646-L682` → new `src/ui/sprite-palette.js`
- **Engineering ROI:** 9 hue families instead of 4; bright pixel mass 16,517 → 17,604 (+6.6 %) _while_ spreading from 59.6 % cyan to ≤ 19.5 % any single hue; hex parsing leaves the hot loop (pre-computed `rgb` per sprite).

**Current Pattern (Audited Code):**

```js
this.colorPalette = { light: [4 sets], dark: [4 sets] };
…
const linkInk = this.themedInk(this.constellationInk);   // one ink for the whole web
this.ctx.strokeStyle = `rgba(${linkInk}, ${opacity})`;
```

**Target Pattern (Surgical Blueprint):**

```js
import { SPRITE_PALETTES, hexToRgbChannels } from './sprite-palette.js';
this.colorPalette = SPRITE_PALETTES;                     // 9 families, both themes
…
rgb: hexToRgbChannels(color),                            // parsed once, at spawn
…
const linkInk = p1.rgb || this.themedInk(this.constellationInk);  // per-sprite ink
```

### Refactor [R3]: Delete the board grid instead of dimming it

- **Target Scope:** `renderer/effects.js:L34-L56`
- **Engineering ROI:** removes ~58 full-span strokes per frame (36 vertical × 900 px + 22 horizontal × 1440 px) and closes the last violation of the standing "no gridlines" directive.

**Current Pattern (Audited Code):**

```js
drawSubtleGridPattern(game, isDark); // 40 px scrolling grid, one stroke call
```

**Target Pattern (Surgical Blueprint):**

```js
// Substrate is a nebula wash ONLY.
drawFloatingGeometry(game, isDark, time);
```

## 5. Remediation Ledger (Pass 4.5 — executed with authorisation)

**Probe commands (identical before/after, browser = bundled Chromium, 1440×900, DPR 1):**

```bash
# audit-phase integrity (pristine tree == pre-audit digest)
git archive HEAD | tar -x -C <scratch>/sk-head
python3 ~/.hermes/skills/surgical-audit/scripts/preflight_telemetry.py src
# live geometry: hook CanvasRenderingContext2D.moveTo/lineTo/stroke on #welcomeCanvas
node <scratch>/sk-probe.mjs          # menu, 9 s
node <scratch>/sk-probe-game.mjs     # 10x10 board, 7 s
node <scratch>/sk-vivid.mjs <url> 3  # bright-pixel hue histogram, 3 loads
```

| Measurement                                 |                 Before |                    After |
| :------------------------------------------ | ---------------------: | -----------------------: |
| Menu: segments > 300 px (9 s)               |                 **28** |                    **0** |
| Menu: horizontal spans > 500 px             |                 **14** |                    **0** |
| Menu: vertical spans > 400 px               |                 **14** |                    **0** |
| Menu: longest drawn segment                 |         **1,439.7 px** |             **140.0 px** |
| Board: segments > 300 px (7 s)              |                **119** |                    **0** |
| Board: longest drawn segment                |         **1,439.9 px** |             **140.0 px** |
| Bright pixels, dark theme (avg of 3 loads)  |                 16,517 |                   17,604 |
| Bright-pixel share, cyan                    |             **59.6 %** |                    6.9 % |
| Bright-pixel share, red                     |              **0.0 %** |                   19.5 % |
| Bright-pixel share, magenta / pink          |      **0.0 % / 0.0 %** |           7.7 % / 12.6 % |
| Bright-pixel share, violet                  |                  8.0 % |                   14.1 % |
| Bright-pixel share, blue / azure            |          3.5 % / 2.0 % |            9.0 % / 7.9 % |
| Bright-pixel share, lime / orange           |         7.9 % / 11.4 % |            9.1 % / 9.4 % |
| Light theme: bright pixels (avg of 2 loads) |                 11,714 |                    8,878 |
| Light theme: cyan / red / pink share        | 49.1 % / 0.0 % / 0.0 % | 13.4 % / 20.8 % / 13.8 % |

Honest reading of the light-theme row: total bright pixel mass fell 24 % because the old cyan web was the brightest object on a cream backdrop; the trade was made deliberately in exchange for full hue coverage. If the dawn theme should hit parity, the next lever is a theme-aware link alpha (`isDark ? 0.34 : 0.50`) — queued as Phase 3, deliberately not mixed into this changeset.

**Quality gates (all green, run in AGENTS.md order):**

```text
npx vitest run        → 82 files, 582 tests passed
npm run lint          → exit 0
npx convex typecheck  → not applicable (no convex/ change)
npm run build         → exit 0 (no-op)
npm run test:e2e:smoke → 1 passed (chromium)
```

**Files changed:** `src/ui/WelcomeAnimation.js` (+79/−71), `renderer/effects.js` (−26), `tests/cosmic-identity.test.js` (+126/−3), new `src/ui/sprite-trail.js` (101), new `src/ui/sprite-palette.js` (74), new `tests/sprite-trail.test.js` (117), new `tests/welcome-animation-trail-lines.test.js` (188).

**Recorded in the repo contract:** `AGENTS.md` now carries a **Background sprite
invariants** section (never stroke a teleport, full-spectrum ink contract, no
gridlines anywhere) so the next agent cannot reintroduce these defects. It was
written after an explicit re-request of the protected-file approval.

## 6. Phased Execution Roadmap & Scoped Agent Prompts

1. **Phase 1 — Containment (done):** trail ring buffer + run splitting; wrap/drag/resize resets; regression tests that failed first (559 px / 790 px) and pass now.
2. **Phase 2 — Ink (done):** 9-family palette for both themes with a mechanical hue/saturation/contrast contract; per-sprite constellation colour; calibrated link alpha; grid deleted.
3. **Phase 3 — Structural de-vibing (queued, separate changeset):** dedupe connection edges via stable sprite index; module-level neighbour scratch buffer; theme-aware light link alpha; disposable listener registry; `min(dpr, 2)` cap; split boids physics out of the God file.

### Copy-Paste Surgical Prompts for Coding Agents

> **Prompt [Phase 3-1] (`src/ui/WelcomeAnimation.js`):** "Strictly scope edits to `src/ui/WelcomeAnimation.js` (`updateSpatialPartitionGrid`, `drawConnections`) and `tests/welcome-animation-connections.test.js`. Assign each sprite a stable integer `__idx` during partitioning and stroke a connection only when `p1.__idx < p2.__idx`, halving stroke calls. Add a regression test that counts `stroke()` calls for N sprites and asserts it equals the number of unique pairs, not twice it. Run `npx vitest run` and `npm run lint`."

> **Prompt [Phase 3-2] (`src/ui/WelcomeAnimation.js`):** "Strictly scope edits to `src/ui/WelcomeAnimation.js` (`getNeighboringParticles`, `applyFlockingBehavior`, `drawConnections`) and `tests/welcome-neighbour-scratch.test.js`. Replace the per-call array allocation with a module-level scratch buffer (`neighborScratch`, `neighborCount`) reused by both call sites; assert with a test that a 200-frame loop allocates no new arrays (spy on `Array.prototype.push` receiver identity or assert buffer identity stability). Do not change flocking behaviour: the neighbour set must be identical before/after."

> **Prompt [Phase 3-3] (`src/ui/WelcomeAnimation.js`):** "Strictly scope edits to `src/ui/WelcomeAnimation.js` and `tests/welcome-animation-lifecycle.test.js`. Move every `addEventListener` in the constructor into `src/lifecycle/DisposableRegistry.js` and dispose them in `stop()`. Add a test that constructs → stops → constructs again and asserts `document`/`window` listener count does not grow (spy on add/removeEventListener)."

## 7. Live Evidence Trail

- Screenshots (post-fix): `~/.hermes/cache/scratch/sk-menu-after-dark.png`, `…-light.png`.
- Pre-fix reference build: `~/.hermes/cache/scratch/sk-head/` (pristine `git archive` of `f347b72`).
- Probe scripts: `sk-probe.mjs`, `sk-probe-game.mjs`, `sk-ab.mjs`, `sk-ab2.mjs`, `sk-vivid.mjs`, `sk-shot.mjs`.
- Telemetry: `sk-src-telemetry.json` (pre), `sk-src-post.json` (post).
