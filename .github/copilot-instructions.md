# Copilot Instructions: ShapeKeeper

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Critical Conventions](#critical-conventions)
4. [Development Commands](#development-commands)
5. [Convex Backend Patterns](#convex-backend-patterns)
6. [Game Logic Details](#game-logic-details)
7. [Animation System](#animation-system)
8. [Sound System](#sound-system)
9. [Theme System](#theme-system)
10. [Common Modifications](#common-modifications)
11. [Device Handling](#device-handling)

---

## Project Overview
ShapeKeeper is a Dots and Boxes game with **local and online multiplayer** support. Vanilla JavaScript frontend with HTML5 Canvas, Convex backend for real-time multiplayer, deployed on Vercel at [shape-keeper.vercel.app](https://shape-keeper.vercel.app).

**Version:** 4.2.0 | **Updated:** December 5, 2025

## Architecture

### Frontend (ES6 Modules - In Progress)
```
src/
├── core/           # Constants and utilities
│   ├── constants.js    # GAME, ANIMATION, PARTICLES, SOUND_FREQ, TILE_EFFECTS
│   └── utils.js        # getLineKey, parseSquareKey, clamp, lerp, hexToRgba
├── sound/          # Audio system
│   └── SoundManager.js # Web Audio API wrapper
├── effects/        # Visual effects
│   ├── ParticleSystem.js   # Burst and ambient particles
│   └── TileEffects.js      # Traps and powerups
├── animations/     # Animation systems
│   ├── KissEmojiSystem.js  # Emoji burst effects
│   └── SquareAnimations.js # Square completion animations
├── game/           # Game logic
│   ├── InputHandler.js     # Touch/mouse input
│   ├── MultiplierSystem.js # Score multipliers
│   └── GameState.js        # State management
├── ui/             # UI components
│   └── ThemeManager.js     # Dark/light theme
└── multiplayer/    # (Future) Convex integration
```

### Legacy Files (Being Modularized)
- `game.js` - `DotsAndBoxesGame` class: canvas rendering, game logic, animations, sound
- `welcome.js` - Screen navigation, lobby UI, Convex integration, theme management
- `convex-client.js` - Wrapper around Convex browser SDK exposing `window.ShapeKeeperConvex`
- `styles.css` - CSS custom properties for dark/light theming

### Documentation Structure
```
docs/
├── development/    # QUICKSTART.md, CODE_AUDIT.md, MERGE_CONFLICT_GUIDE.md
├── planning/       # JOBCARD.md, CounterPlan.md, MULTIPLAYER_PLANNING.md, REFACTORING_PLAN.md
├── history/        # DEPLOYMENT_STATUS.md
└── technical/      # BENQ_FIX.md, FEATURE_SUMMARY.md, PERFORMANCE_IMPROVEMENTS.md
```

### Backend (Convex)
- `convex/schema.ts` - Tables: `rooms`, `players`, `lines`, `squares`
- `convex/rooms.ts` - Room lifecycle: create, join, leave, ready, start game
- `convex/games.ts` - Game mutations: `drawLine`, `revealMultiplier`, `getGameState`

### Key Data Flow
```
Local: handleClick() → drawLine() → checkForSquares() → updateUI()
Multiplayer: handleClick() → ShapeKeeperConvex.drawLine() → Convex mutation → 
             subscription callback → handleGameStateUpdate() → sync local state
```

## Critical Conventions

### Line Key Normalization (MUST match frontend & backend)
```javascript
// Always sort coordinates to prevent duplicates
getLineKey(dot1, dot2) {
    const [first, second] = [dot1, dot2].sort((a, b) =>
        a.row === b.row ? a.col - b.col : a.row - b.row
    );
    return `${first.row},${first.col}-${second.row},${second.col}`;
}
```

### Screen Transitions
```javascript
showScreen('gameScreen'); // Sets .active class, removes from others
```

### Multiplayer Mode Detection
```javascript
if (this.isMultiplayer) {
    // Send to Convex, wait for subscription update
    await window.ShapeKeeperConvex.drawLine(lineKey);
} else {
    // Local logic only
    this.lines.add(lineKey);
}
```

## Development Commands
```bash
npm run dev      # Start Convex dev server (required for multiplayer testing)
npm run start    # Local HTTP server on port 8000
npm run serve    # Alternative: Python HTTP server
```

**File Load Order:** `game.js` must load before `welcome.js` (DotsAndBoxesGame class dependency)

## Convex Backend Patterns

### Session-Based Auth
Players identified by `sessionId` stored in `localStorage`. No user accounts—session persists across page reloads.

### Turn-Based Optimized Subscriptions
Multiplayer uses turn-based optimization to minimize network traffic (like chess):
```javascript
// Room updates (lobby state) - debounced
window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate);

// Game state updates (lines, squares, scores) - turn-based optimized
// Only triggers callback when:
// - Turn changes (currentPlayerIndex changes)
// - Lines/squares count changes (actual game state change)  
// - Scores change
// - Game status changes (playing → finished)
window.ShapeKeeperConvex.subscribeToGameState(handleGameStateUpdate);
```

### Mutation Pattern (rooms.ts, games.ts)
1. Validate session owns the action (turn check, host check)
2. Perform database operations
3. Return result (subscription auto-broadcasts changes with turn-based optimization)

## Game Logic Details

### Square Detection
After each line draw, check 2-4 adjacent squares (horizontal lines check above/below, vertical check left/right). Square complete when all 4 sides exist in `lines` Set/table.

### Multiplier Distribution
65% ×2, 20% ×3, 10% ×4, 4% ×5, 1% ×10. Revealed on tap—**multiplies total score**, not adds.

### Party Mode (Tile Effects System)
When Party Mode is enabled, **ALL squares** have tile effects (traps or powerups):
- **Traps (red/50%)**: Landmine, Freeze, Score Swap, Chaos Storm, Hypotheticals, Dares, Secrets
- **Powerups (blue/50%)**: Extra turns, Steal territory, Shield, Lightning, Oracle's Vision, Double Points
- Effects stored in `tileEffects` object, revealed via `revealTileEffect()`
- Effect modal shows description and activation button
- `playerEffects` tracks status effects (frozen turns, shield count, etc.)
- Toggle via "Enable Party Mode 🎉" checkbox on local setup screen

### Landscape Grid Adaptation
When `aspectRatio > 1.5`, grid reshapes: 30×30 selection becomes ~50×18 grid (same total squares).

## Animation System
All in `animate()` requestAnimationFrame loop:
- `squareAnimations[]` - 600ms scale-in on completion
- `particles[]` - Colored bursts with trails and physics
- `kissEmojis[]` - 5-8 💋 emojis per square with stagger
- `pulsatingLines[]` - 2s glow on new lines
- `ambientParticles[]` - Floating background particles
- `comboCount` - Streak tracking for visual escalation
- `screenShake` - Camera shake on multi-square completions

## Sound System (Web Audio API)
Procedural sounds via `SoundManager` class (no audio files):
- `playLineSound()` - Ascending tone on line draw
- `playSquareSound()` - Harmonic chord on square completion
- `playComboSound(count)` - Arpeggio escalation for streaks
- `playVictorySound()` - Fanfare on game end
- `playInvalidSound()` - Error feedback
- Sound toggle persists in localStorage (`shapekeeper-sound-enabled`)

## Theme System
CSS custom properties with localStorage persistence:
- `:root` - Light theme defaults
- `[data-theme="dark"]` - Dark theme overrides
- `initializeTheme()` / `toggleTheme()` in welcome.js
- Key variables: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--border-color`

## Common Modifications

| Task | Location |
|------|----------|
| Add grid size | `index.html` buttons + `setupCanvas()` thresholds |
| Change animations | `src/core/constants.js` ANIMATION object |
| Modify multipliers | `src/game/MultiplierSystem.js` or `convex/games.ts` |
| Game rules | `src/game/GameState.js` or `game.js checkForSquares()` |
| Add sounds | `src/sound/SoundManager.js` |
| Theme colors | `src/ui/ThemeManager.js` or CSS custom properties |
| Particle effects | `src/effects/ParticleSystem.js` |
| Tile effects | `src/effects/TileEffects.js` |

## Module Import Pattern
```javascript
// ES6 module imports (when type="module" is added)
import { GAME, ANIMATION, PARTICLES } from './src/core/constants.js';
import { getLineKey, parseSquareKey } from './src/core/utils.js';
import { SoundManager } from './src/sound/SoundManager.js';
import { ParticleSystem } from './src/effects/ParticleSystem.js';
import { TileEffectsManager } from './src/effects/TileEffects.js';
import { InputHandler } from './src/game/InputHandler.js';
import { GameState } from './src/game/GameState.js';
```

## Device Handling
- **Landscape-only**: CSS overlay in portrait mode
- **Touch debouncing**: `lastTouchTime` prevents mouse/touch conflicts
- **High-DPI**: Canvas scales by `devicePixelRatio`
- **Selection locking**: `selectionLocked` flag prevents Chrome extension interference
