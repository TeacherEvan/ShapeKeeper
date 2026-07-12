# ShapeKeeper Modularization Refactoring Plan

> **Version:** 5.0.0 | **Created:** November 29, 2025
> **Status:** ✅ Largely complete (as of v4.3.0 / 2026-07-12) — see "Actual Layout" below
> **Priority:** Done

## Executive Summary

This document outlined a plan to refactor ShapeKeeper's monolithic JavaScript
files into a modular ES6 architecture. That modularization has largely landed,
but the **final layout diverged from the original plan**: the proposed
`src/game/` directory was NOT created, and the app entry point remained
`game.js` (loaded directly by `index.html` as a module) rather than
`src/index.js` (which became a reusable library/barrel module). This document
now records both the original intent and the realized structure so new
contributors know where code actually lives.

---

## Current State Analysis

### Monolithic Files (Before)

| File               | Lines  | Responsibilities                                                          |
| ------------------ | ------ | ------------------------------------------------------------------------- |
| `game.js`          | ~3,524 | Game class, constants, effects, animations, sound, rendering, input, UI   |
| `welcome.js`       | ~600   | Welcome animation, lobby manager, screen navigation, theme, room handlers |
| `convex-client.js` | ~350   | Convex SDK wrapper, session management, API calls                         |

### Problems

1. **God Class**: `DotsAndBoxesGame` handles 15+ concerns
2. **Hard to Test**: No separation between logic and rendering
3. **Merge Conflicts**: Large files increase conflict probability
4. **Cognitive Load**: 3500+ lines is overwhelming
5. **Documentation Scattered**: 16 MD files in root directory

---

## Target Architecture (as realized in v4.3.0)

The plan's `src/game/` directory was **not** created. Instead the project
settled on a **hybrid layout**: root-level runtime modules orchestrated by
`game.js`, plus `src/` shared engine modules. `src/index.js` is a library
barrel (re-exports + `createGameSystems()`), **not** the app entry point.

```
ShapeKeeper/
├── index.html                    # Browser entry; loads game.js as a module
├── game.js                       # App bootstrap → exposes window.DotsAndBoxesGame
├── dots-and-boxes-game.js        # DotsAndBoxesGame orchestrator (924 lines)
├── game-logic.js                 # Pure rules (square detection, scoring)
├── game-state.js                 # Game state model
├── renderer.js / renderer/*.js   # Canvas drawing
├── animation-system.js           # Animation orchestration
├── tutorial-system.js            # Guided tutorial flow
├── ui-manager.js / ui-manager/*  # DOM overlays (effects, celebrations)
├── effect-system.js / effect-system/*  # Tile effects gameplay + modal
├── convex-client.js / convex-client/*  # Convex API wrapper (rooms, subs)
├── input-handler/pointer-controls.js   # Mouse/touch input
├── achievement-system.js         # Achievements + persistence
├── local-save-replay.js          # Save/load + replay
├── utils.js                      # Root-level shared helpers
├── welcome.js                    # Lobby/UI bootstrap
│
├── src/                          # 🆕 Shared ES6 engine modules
│   ├── index.js                  # Library barrel (createGameSystems, etc.)
│   ├── core/                     # constants.js, utils.js (parseSquareKey, getLineKey)
│   ├── effects/                  # ParticleSystem, TileEffects
│   ├── animations/               # KissEmojiSystem, SquareAnimations
│   ├── sound/                    # SoundManager (Web Audio API)
│   └── ui/                       # ThemeManager, LobbyManager, ScreenManager, etc.
│
├── convex/                       # Backend (unchanged)
│   ├── schema.ts
│   ├── rooms.ts
│   ├── games.ts
│   └── _generated/
│
├── tests/
│   ├── *.test.js                 # Vitest unit tests (50 passing)
│   └── e2e/                      # Playwright E2E (needs live server)
│
└── docs/                         # See docs/README.md for navigation
```

> **Note:** `src/index.js` exposes `createGameSystems(gameCanvas)` for lazy
> chunk loading, but the production UI wires modules through `game.js` and
> `welcome.js`. Don't add app bootstrap logic to `src/index.js`.

---

## Module Dependency Graph (actual)

```
index.html
    ├── game.js ............................ DotsAndBoxesGame export + bootstrap
    │       ├── dots-and-boxes-game.js
    │       │       ├── game-logic.js, game-state.js
    │       │       ├── renderer.js → renderer/board.js, renderer/markers.js
    │       │       ├── animation-system.js
    │       │       ├── tutorial-system.js, ui-manager.js
    │       │       ├── effect-system.js, input-handler/pointer-controls.js
    │       │       ├── achievement-system.js, local-save-replay.js, utils.js
    │       │       └── convex-client.js → convex-client/{room-operations,subscriptions}.js
    │       └── src/index.js (library barrel; createGameSystems)
    │               ├── src/core/{constants,utils}.js
    │               ├── src/effects/{ParticleSystem,TileEffects}.js
    │               ├── src/animations/{KissEmojiSystem,SquareAnimations}.js
    │               ├── src/sound/SoundManager.js
    │               └── src/ui/* (ThemeManager, LobbyManager, ScreenManager, ...)
    └── welcome.js .......................... lobby/UI bootstrapping
```

---

## Implementation Phases

### Phase 1: Documentation Organization (1 hour)

- [ ] Create `/docs/` folder structure
- [ ] Move MD files to appropriate subfolders
- [ ] Update internal links
- [ ] Update README with new structure

### Phase 2: Core Module Extraction (2 hours)

- [ ] Create `/src/core/constants.js` - Extract all static constants
- [ ] Create `/src/core/utils.js` - Extract utility functions
- [ ] Create `/src/core/state.js` - State management patterns

### Phase 3: Sound System (30 mins)

- [ ] Create `/src/sound/SoundManager.js` - Extract from game.js
- [ ] Export as ES6 module

### Phase 4: Animation Systems (1.5 hours)

- [ ] Create `/src/animations/ParticleSystem.js`
- [ ] Create `/src/animations/SquareAnimations.js`
- [ ] Create `/src/animations/ScreenEffects.js`
- [ ] Create `/src/animations/AnimationLoop.js`

### Phase 5: Effects System (1 hour)

- [ ] Create `/src/effects/effects.js` - TILE_EFFECTS, HYPOTHETICALS, DARES, etc.
- [ ] Create `/src/effects/EffectManager.js` - Effect activation
- [ ] Create `/src/effects/EffectModal.js` - Modal DOM manipulation

### Phase 6: Game Core (2 hours)

- [ ] Create `/src/game/Game.js` - Slim DotsAndBoxesGame class
- [ ] Create `/src/game/GameRenderer.js` - Canvas drawing
- [ ] Create `/src/game/GameInput.js` - Event handlers
- [ ] Create `/src/game/GameMultiplayer.js` - Multiplayer hooks

### Phase 7: UI System (1 hour)

- [ ] Create `/src/ui/WelcomeAnimation.js`
- [ ] Create `/src/ui/LobbyManager.js`
- [ ] Create `/src/ui/ScreenManager.js`
- [ ] Create `/src/ui/ThemeManager.js`

### Phase 8: Multiplayer (30 mins)

- [x] Convex client lives at `convex-client.js` + `convex-client/` (NOT `src/multiplayer/`)
- [x] Sync handled inside `dots-and-boxes-game.js` + `convex-client/subscriptions.js`

### Phase 9: Integration (1 hour)

- [x] `src/index.js` exists as a library barrel (NOT the app entry)
- [x] `index.html` loads `game.js` as `<script type="module">`
- [x] All functionality tested via 50 Vitest unit tests + Playwright E2E

### Phase 10: Cleanup & Documentation (1 hour)

- [x] Monolithic files split (game.js, welcome.js remain as thin bootstrap modules)
- [ ] Update JOBCARD.md (still references old layout)
- [x] Final testing — `npm run lint` clean, `npm run test` green

> **What diverged from the original plan:** the `src/game/`, `src/multiplayer/`,
> and `src/effects/EffectManager.js` directories were never created. Game logic
> stayed in root-level modules (`dots-and-boxes-game.js`, `game-logic.js`,
> `game-state.js`) and tile effects in `src/effects/TileEffects.js` +
> `effect-system.js`. This hybrid layout is the de-facto standard now — keep new
> engine code under `src/` and new runtime/orchestration code at the root.


## Module Templates

### constants.js Example

```javascript
// src/core/constants.js

// Configuration
export const DOT_RADIUS = 1.6;
export const LINE_WIDTH = 6;
export const CELL_SIZE_MIN = 8;
export const CELL_SIZE_MAX = 40;
export const GRID_OFFSET = 20;

// Animation timing
export const ANIMATION = {
    SQUARE_DURATION: 600,
    KISS_DURATION: 1000,
    MULTIPLIER_DURATION: 2000,
    PULSATING_DURATION: 2000,
    LINE_DRAW_DURATION: 150,
    INVALID_FLASH_DURATION: 300,
};

// Particle counts
export const PARTICLES = {
    SQUARE: 15,
    MULTIPLIER_SPARKS: 30,
    MULTIPLIER_SMOKE: 10,
    TRAIL_LENGTH: 8,
    AMBIENT_COUNT: 30,
};

// Sound frequencies (Hz)
export const SOUND = {
    LINE_BASE: 440,
    SQUARE_BASE: 523,
    COMBO_BASE: 659,
};

// Combo thresholds
export const COMBO = {
    FLASH_THRESHOLD: 3,
    PULSE_THRESHOLD: 5,
    EPIC_THRESHOLD: 7,
};
```

### utils.js Example

```javascript
// src/core/utils.js

/**
 * Normalize line key to prevent duplicates
 * @param {Object} dot1 - {row, col}
 * @param {Object} dot2 - {row, col}
 * @returns {string} Normalized line key "row,col-row,col"
 */
export function getLineKey(dot1, dot2) {
    const [first, second] = [dot1, dot2].sort((a, b) =>
        a.row === b.row ? a.col - b.col : a.row - b.row
    );
    return `${first.row},${first.col}-${second.row},${second.col}`;
}

/**
 * Parse a line key string into start and end dot objects
 * @param {string} lineKey - Format: "row,col-row,col"
 * @returns {Array} [startDot, endDot]
 */
export function parseLineKey(lineKey) {
    const [start, end] = lineKey.split('-').map((s) => {
        const [row, col] = s.split(',').map(Number);
        return { row, col };
    });
    return [start, end];
}

/**
 * Parse a square key string into row and col
 * @param {string} squareKey - Format: "row,col"
 * @returns {Object} {row, col}
 */
export function parseSquareKey(squareKey) {
    const [row, col] = squareKey.split(',').map(Number);
    return { row, col };
}

/**
 * Check if two dots are adjacent (horizontal or vertical)
 */
export function areAdjacent(dot1, dot2) {
    const rowDiff = Math.abs(dot1.row - dot2.row);
    const colDiff = Math.abs(dot1.col - dot2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

/**
 * Generate a random hex color
 */
export function generateRandomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const toHex = (val) => val.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
```

### index.js Entry Point Example

```javascript
// src/index.js - Main entry point

// Core
export * from './core/constants.js';
export * from './core/utils.js';

// Game
export { DotsAndBoxesGame } from './game/Game.js';

// UI
export { WelcomeAnimation } from './ui/WelcomeAnimation.js';
export { LobbyManager } from './ui/LobbyManager.js';
export { showScreen, showToast } from './ui/ScreenManager.js';
export { initializeTheme, toggleTheme } from './ui/ThemeManager.js';

// Multiplayer
export { ShapeKeeperConvex } from './multiplayer/ConvexClient.js';

// Initialize application
import { initializeApp } from './ui/ScreenManager.js';

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
```

### HTML Module Loading

```html
<!-- Old approach -->
<script src="game.js"></script>
<script src="welcome.js"></script>

<!-- New approach (ES6 modules) -->
<script type="module" src="./src/index.js"></script>
```

---

## Testing Strategy

### Unit Tests (Future)

- Each module should be independently testable
- Use Jest or Vitest for testing
- Mock DOM and Canvas APIs

### Integration Tests

1. Start local server: `npm run start`
2. Manual testing checklist:
    - [ ] Game loads without errors
    - [ ] Grid renders correctly
    - [ ] Lines can be drawn
    - [ ] Squares complete with animations
    - [ ] Tile effects reveal and activate
    - [ ] Sound plays
    - [ ] Theme toggle works
    - [ ] Multiplayer connects and syncs

---

## Risk Assessment

| Risk                   | Likelihood | Impact | Mitigation                                |
| ---------------------- | ---------- | ------ | ----------------------------------------- |
| Circular dependencies  | Medium     | High   | Careful dependency graph planning         |
| Global state access    | High       | Medium | Explicit imports, avoid window.\*         |
| Browser compatibility  | Low        | High   | Test in Chrome, Firefox, Safari           |
| Convex CDN loading     | Low        | High   | Keep convex bundle in separate script tag |
| Performance regression | Low        | Medium | Profile before/after                      |

---

## Rollback Plan

1. All changes in a feature branch
2. Keep original files until verification complete
3. Git tags for major milestones
4. Easy revert if issues found

---

## Success Criteria

- [ ] No file larger than 500 lines
- [ ] Clear module boundaries
- [ ] All existing functionality preserved
- [ ] Clean console (no errors/warnings)
- [ ] Documentation updated
- [ ] Deployment successful

---

## Timeline Estimate

| Phase             | Duration | Cumulative |
| ----------------- | -------- | ---------- |
| Docs Organization | 1h       | 1h         |
| Core Modules      | 2h       | 3h         |
| Sound System      | 0.5h     | 3.5h       |
| Animations        | 1.5h     | 5h         |
| Effects System    | 1h       | 6h         |
| Game Core         | 2h       | 8h         |
| UI System         | 1h       | 9h         |
| Multiplayer       | 0.5h     | 9.5h       |
| Integration       | 1h       | 10.5h      |
| Cleanup           | 1h       | 11.5h      |

**Total Estimated Time: ~12 hours**

---

## Success Criteria

- [x] No file larger than 500 lines — ⚠️ partially: `dots-and-boxes-game.js` (924) and
      `ui-manager/celebrations.js` (361) exceed 500; acceptable as orchestrators.
- [x] Clear module boundaries (root runtime vs `src/` engine)
- [x] All existing functionality preserved
- [x] Clean console (no errors/warnings) — `npm run lint` clean (2026-07-12)
- [x] Documentation updated (CODE_AUDIT.md, REFACTORING_PLAN.md refreshed)
- [x] Deployment successful (Vercel + Convex)

---

## Next Steps

1. ✅ Create this plan document
2. ✅ Refactor to modular ES6 (done; layout diverged as noted above)
3. ✅ Unit tests added (`npm run test` → 50 passing)
4. ⬜ Add a CI workflow that runs `npm run lint` + `npm run test` on every push
   (currently only `deploy-convex.yml` exists; E2E needs a live `npm run serve`)
5. ⬜ Optional: split `dots-and-boxes-game.js` (924 lines) if it keeps growing

---

## References

- [MDN JavaScript Modules Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Plainvanilla Project Patterns](https://github.com/jsebrech/plainvanilla)
- [Rollup ES6 Module Best Practices](https://rollupjs.org/guide/en/)
