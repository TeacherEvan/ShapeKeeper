# ShapeKeeper Modularization Refactoring Plan

> **Version:** 5.0.0 | **Created:** November 29, 2025  
> **Status:** Planning Phase | **Priority:** High

## Executive Summary

This document outlines a comprehensive plan to refactor ShapeKeeper's monolithic JavaScript files into a modular ES6 architecture. The goal is improved maintainability, testability, and developer experience while maintaining zero build-step deployment to Vercel.

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

## Target Architecture

### Directory Structure (After)

```
ShapeKeeper/
├── index.html                    # Entry point (updated for modules)
├── styles.css                    # Global styles
├── README.md                     # Main documentation
├── LICENSE                       # MIT License
├── CONTRIBUTING.md               # Contribution guidelines
├── package.json                  # Dependencies
├── vercel.json                   # Deployment config
│
├── src/                          # 🆕 Source modules
│   ├── index.js                  # Main entry point
│   │
│   ├── core/                     # Core utilities
│   │   ├── constants.js          # All static constants
│   │   ├── utils.js              # Shared utilities (line keys, etc.)
│   │   └── state.js              # Game state management
│   │
│   ├── game/                     # Game logic
│   │   ├── Game.js               # DotsAndBoxesGame class (core logic only)
│   │   ├── GameRenderer.js       # Canvas drawing
│   │   ├── GameInput.js          # Mouse/touch handlers
│   │   └── GameMultiplayer.js    # Multiplayer sync hooks
│   │
│   ├── effects/                  # Tile effects system
│   │   ├── effects.js            # Effect definitions (traps/powerups)
│   │   ├── EffectManager.js      # Effect activation logic
│   │   └── EffectModal.js        # Modal UI for reveals
│   │
│   ├── animations/               # Animation systems
│   │   ├── ParticleSystem.js     # Particle effects
│   │   ├── SquareAnimations.js   # Square completion animations
│   │   ├── ScreenEffects.js      # Shake, pulse, ambient
│   │   └── AnimationLoop.js      # requestAnimationFrame orchestration
│   │
│   ├── sound/                    # Audio system
│   │   └── SoundManager.js       # Web Audio API
│   │
│   ├── multiplayer/              # Online multiplayer
│   │   ├── ConvexClient.js       # Convex SDK wrapper
│   │   └── SyncManager.js        # State synchronization
│   │
│   └── ui/                       # User interface
│       ├── WelcomeAnimation.js   # Boids animation
│       ├── LobbyManager.js       # Lobby state
│       ├── ScreenManager.js      # Screen transitions
│       └── ThemeManager.js       # Dark/light theme
│
├── docs/                         # 🆕 Documentation
│   ├── development/
│   │   ├── QUICKSTART.md
│   │   ├── CODE_AUDIT.md
│   │   └── MERGE_CONFLICT_GUIDE.md
│   │
│   ├── planning/
│   │   ├── JOBCARD.md
│   │   ├── CounterPlan.md
│   │   ├── MULTIPLAYER_PLANNING.md
│   │   └── REFACTORING_PLAN.md   # This document
│   │
│   ├── history/
│   │   ├── BEFORE_AFTER.md
│   │   ├── CLEANUP_SUMMARY.md
│   │   ├── SYNC_COMPLETE.md
│   │   └── DEPLOYMENT_STATUS.md
│   │
│   ├── technical/
│   │   ├── FEATURE_SUMMARY.md
│   │   ├── PERFORMANCE_IMPROVEMENTS.md
│   │   └── BENQ_FIX.md
│   │
│   └── PROJECT_SUMMARY.md
│
├── convex/                       # Backend (unchanged)
│   ├── schema.ts
│   ├── rooms.ts
│   ├── games.ts
│   └── _generated/
│
└── Triangle/                     # Future feature docs
    └── canvasBonusFeature.md
```

---

## Module Dependency Graph

```
index.html
    └── src/index.js (entry point)
            ├── src/core/constants.js
            ├── src/core/utils.js
            │
            ├── src/game/Game.js
            │       ├── src/core/state.js
            │       ├── src/game/GameRenderer.js
            │       │       └── src/animations/AnimationLoop.js
            │       ├── src/game/GameInput.js
            │       └── src/game/GameMultiplayer.js
            │               └── src/multiplayer/SyncManager.js
            │
            ├── src/effects/EffectManager.js
            │       ├── src/effects/effects.js
            │       └── src/effects/EffectModal.js
            │
            ├── src/animations/ParticleSystem.js
            ├── src/animations/SquareAnimations.js
            ├── src/animations/ScreenEffects.js
            │
            ├── src/sound/SoundManager.js
            │
            ├── src/multiplayer/ConvexClient.js
            │
            └── src/ui/
                    ├── WelcomeAnimation.js
                    ├── LobbyManager.js
                    ├── ScreenManager.js
                    └── ThemeManager.js
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

- [ ] Refactor `convex-client.js` to `/src/multiplayer/ConvexClient.js`
- [ ] Create `/src/multiplayer/SyncManager.js`

### Phase 9: Integration (1 hour)

- [ ] Create `/src/index.js` entry point
- [ ] Update `index.html` to use `type="module"`
- [ ] Test all functionality
- [ ] Fix import/export issues

### Phase 10: Cleanup & Documentation (1 hour)

- [ ] Delete old monolithic files
- [ ] Update JOBCARD.md
- [ ] Update copilot-instructions.md
- [ ] Final testing

---

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

## Next Steps

1. ✅ Create this plan document
2. ⬜ Get user approval on architecture
3. ⬜ Begin Phase 1: Documentation Organization
4. ⬜ Proceed iteratively through phases

---

## References

- [MDN JavaScript Modules Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Plainvanilla Project Patterns](https://github.com/jsebrech/plainvanilla)
- [Rollup ES6 Module Best Practices](https://rollupjs.org/guide/en/)
