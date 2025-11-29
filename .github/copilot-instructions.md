# Copilot Instructions: ShapeKeeper

## Project Overview
ShapeKeeper is a Dots and Boxes game with **local and online multiplayer** support. Vanilla JavaScript frontend with HTML5 Canvas, Convex backend for real-time multiplayer, deployed on Vercel at [shape-keeper.vercel.app](https://shape-keeper.vercel.app).

**Version:** 4.0.0 | **Updated:** November 29, 2025

## Architecture

### Frontend (No Build Step)
- `game.js` - `DotsAndBoxesGame` class: canvas rendering, game logic, animations, sound
- `welcome.js` - Screen navigation, lobby UI, Convex integration, theme management
- `convex-client.js` - Wrapper around Convex browser SDK exposing `window.ShapeKeeperConvex`
- `styles.css` - CSS custom properties for dark/light theming

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

### Real-Time Subscriptions
```javascript
// Room updates (lobby state)
window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate);

// Game state updates (lines, squares, scores)
window.ShapeKeeperConvex.subscribeToGameState(handleGameStateUpdate);
```

### Mutation Pattern (rooms.ts, games.ts)
1. Validate session owns the action (turn check, host check)
2. Perform database operations
3. Return result (subscription auto-broadcasts changes)

## Game Logic Details

### Square Detection
After each line draw, check 2-4 adjacent squares (horizontal lines check above/below, vertical check left/right). Square complete when all 4 sides exist in `lines` Set/table.

### Multiplier Distribution
65% ×2, 20% ×3, 10% ×4, 4% ×5, 1% ×10. Revealed on tap—**multiplies total score**, not adds.

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
| Change animations | `DotsAndBoxesGame.ANIMATION_*` static constants |
| Modify multipliers | `initializeMultipliers()` in game.js, `generateMultiplier()` in games.ts |
| Game rules | `checkForSquares()` + `handleClick()`/`handleTouchEnd()` |
| Add sounds | `SoundManager` class methods in game.js |
| Theme colors | CSS custom properties in `:root` and `[data-theme="dark"]` |

## Device Handling
- **Landscape-only**: CSS overlay in portrait mode
- **Touch debouncing**: `lastTouchTime` prevents mouse/touch conflicts
- **High-DPI**: Canvas scales by `devicePixelRatio`
- **Selection locking**: `selectionLocked` flag prevents Chrome extension interference
