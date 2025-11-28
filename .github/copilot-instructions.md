# Copilot Instructions: ShapeKeeper

## Project Overview
Browser-based implementation of ShapeKeeper (a classic Dots and Boxes style game) with customizable grid sizes, player colors, score multipliers, and zoom controls. Pure vanilla JavaScript with HTML5 Canvas rendering—no frameworks or build tools.

## Architecture Pattern

**Three-Screen Flow:**
1. **Welcome Screen** (`welcome.js`) - Grid selection (5×5, 10×10, 20×20, 30×30), color pickers, and animated background (flocking boids algorithm)
2. **Game Screen** (`game.js`) - Canvas-based gameplay with `DotsAndBoxesGame` class
3. **Winner Screen** - Results display with play-again option

**State Management:** Single `DotsAndBoxesGame` instance stored in global `game` variable. Screen transitions use `.active` class toggling on `.screen` elements.

## Core Game Mechanics

### Data Structures
- **Lines:** `Set` of string keys like `"1,2-1,3"` (normalized with sorted coordinates)
- **Line Owners:** `Map` tracking which player drew each line (persists entire game)
- **Squares:** Object map `{"row,col": playerNumber}` tracking completed squares
- **Square Multipliers:** Object map with `{type: 'multiplier', value: 2-10}` or `{type: 'truthOrDare'}`
- **Revealed Multipliers:** `Set` of square keys preventing double-reveals
- **Coordinates:** All positions use `{row, col}` objects (0-indexed from top-left)

### Landscape Grid Adaptation
When aspect ratio > 1.5, grid automatically reshapes to fill landscape displays:
```javascript
// 30×30 becomes ~50×18 grid (same total squares, optimized layout)
this.gridCols = Math.ceil(Math.sqrt(totalSquares * aspectRatio));
this.gridRows = Math.ceil(totalSquares / (this.gridCols - 1)) + 1;
```

### Key Algorithms
**Square Detection (`checkForSquares`):** After each line draw, checks 2-4 adjacent potential squares:
- Horizontal lines check squares above and below
- Vertical lines check squares left and right
- Only marks squares if all 4 sides exist in `this.lines`

**Turn Logic:** Player retains turn when completing square(s), otherwise switches to opponent.

**Multiplier System (`initializeMultipliers`):** Randomizes score multipliers across all squares:
- 60% get ×2, 20% get ×3, 10% get ×4, 5% get ×5, 1% get ×10, ~4% get "Truth or Dare"
- Revealed on click/tap via `revealMultiplier(squareKey)` which **multiplies** current score
- Triggers golden spark particles (30) and smoke effects (10)

**Canvas Coordinate System:**
```javascript
screenX = this.offsetX + col * this.cellSize
screenY = this.offsetY + row * this.cellSize
```

## Critical Implementation Details

### Line Key Generation
Always normalize line keys with sorted coordinates to prevent duplicates:
```javascript
getLineKey(dot1, dot2) {
    const [first, second] = [dot1, dot2].sort((a, b) =>
        a.row === b.row ? a.col - b.col : a.row - b.row
    );
    return `${first.row},${first.col}-${second.row},${second.col}`;
}
```

### Persistent Line Colors
Lines maintain original player color via `lineOwners` Map:
```javascript
// On draw:
this.lineOwners.set(lineKey, this.currentPlayer);
// On render:
const player = this.lineOwners.get(lineKey) || this.getLinePlayer(lineKey);
```

### Responsive Canvas Sizing
Canvas recalculates on window resize to fit container while maintaining playability:
- `cellSize` ranges from 8px (min) to 40px (max)—reduced for miniaturized design
- 20px offset margins (`offsetX`, `offsetY`) prevent edge clipping
- Device pixel ratio (DPR) scaling for crisp high-DPI displays
- Fullscreen triggered on game start (with graceful fallback)

### Multi-Touch & Zoom System
**Touch Handling:**
- Tracks all active touches via `activeTouches` Map keyed by touch identifier
- Two-finger pan when `manualZoomLevel > 1` (uses midpoint of touches)
- Touch visuals show expanding ripple effects (300ms duration)
- Debouncing prevents Chrome extension conflicts (`lastInteractionTime` < 50ms)

**Zoom Levels:** 1x (default), 2x, 3x, 5x controlled by footer buttons
```javascript
// Zoom applies center-based scaling with pan offset:
this.ctx.translate(centerX, centerY);
this.ctx.scale(this.zoomLevel, this.zoomLevel);
this.ctx.translate(-centerX + this.panOffsetX, -centerY + this.panOffsetY);
```

### Animation System
**Three Animation Queues (all managed in `animate()` requestAnimationFrame loop):**

1. **Square Animations** (`squareAnimations[]`): 600ms scale-in effect when completing squares
2. **Particle Effects** (`particles[]`): 
   - Square completion: 15 colored particles radiating outward
   - Multiplier reveal: 30 golden sparks + 10 gray smoke particles rising
3. **Kiss Emojis** (`kissEmojis[]`): 20-35 💋 emojis per square with staggered start times, floating upward with wobble

**Cleanup:** Arrays auto-filter expired animations based on `startTime + duration < Date.now()`

**Score Counter:** Animated via `displayedScores` that increment toward actual `scores` at `scoreAnimationSpeed = 0.1` per frame

### Visual Feedback System
- **Pulsating Lines:** New lines animate for 2 seconds via `pulsatingLines` array with timestamps
- **Selected Dot:** Triple-ring highlight (outer glow + pulsing ring + solid ring) matching current player color
- **Active Player:** Header `.player-info` gets `.active` class for pulsing animation
- **Pan Hint:** Shows "Use two fingers to pan when zoomed" when zoom > 1x

## Constants Architecture
All magic numbers extracted to `DotsAndBoxesGame` static constants for maintainability:
```javascript
static DOT_RADIUS = 1.6;
static LINE_WIDTH = 6; // Increased 300% from original 2
static CELL_SIZE_MIN = 8; // Reduced 60% for miniaturized design
static ANIMATION_SQUARE_DURATION = 600;
static PARTICLE_COUNT_SQUARE = 15;
static KISS_EMOJI_MIN = 20; // Per completed square
```

## Helper Methods (Performance Optimization)
Avoid repeated string parsing in draw loops:
```javascript
parseLineKey(lineKey) // "1,2-3,4" → [{row: 1, col: 2}, {row: 3, col: 4}]
parseSquareKey(squareKey) // "1,2" → {row: 1, col: 2}
```

## UI Conventions

### Player Representation
- Player 1: Default red (hex color FF0000)
- Player 2: Default blue (hex color 0000FF)
- Completed squares: Semi-transparent player color (color + `'40'` alpha)
- Player numbers (1 or 2) rendered in square centers with dynamic font sizing

### Screen Transitions
```javascript
// Pattern used throughout welcome.js
oldScreen.classList.remove('active');
newScreen.classList.add('active');
```
Only one `.screen` element should have `.active` at a time.

**Welcome Background:** `WelcomeAnimation` class runs continuous flocking animation (boids algorithm) with spatial partitioning grid for performance. Dims when transitioning to game screen via `isDimmed` flag.

## Development Workflow

**No build process.** Open `index.html` directly in browser or use live server:
```bash
python -m http.server 8000
npx http-server
php -S localhost:8000
```

**File Load Order (critical):**
```html
<script src="game.js"></script>  <!-- DotsAndBoxesGame class must load first -->
<script src="welcome.js"></script>  <!-- Depends on game.js global -->
```

**Testing Grid Sizes:** 
- Use 10×10 for quick feature tests (81 squares)
- Use 20×20 for landscape mode validation (~29×14 grid, 361 squares)
- Use 30×30 for performance stress testing (~50×18 grid, 841 squares)

**Debugging Multipliers:** Check `this.squareMultipliers` object in console after grid initialization

## Common Modifications

**Adding Grid Size:** Update `index.html` grid buttons and adjust responsive thresholds in `setupCanvas()` if going beyond 30×30.

**Changing Animation Timing:** Modify `DotsAndBoxesGame.ANIMATION_*` constants at top of `game.js`

**Adjusting Multiplier Distribution:** Change percentages in `initializeMultipliers()` (ensure total ≤ 100%)

**Changing Game Rules:** Modify `checkForSquares()` return logic and turn-switching in `handleClick()` event handler.

**Styling Player Info:** Colors dynamically set via inline styles in `updateUI()`, not CSS variables.

## Mobile & Device Considerations

**Orientation:** Landscape-only enforced via CSS overlay. Portrait mode shows rotation prompt covering entire screen (see media query at end of `styles.css`).

**Touch Event Priority:** `lastTouchTime` prevents mouse event interference after touch events (common browser issue).

**Selection Locking:** `selectionLocked` flag prevents accidental deselection from problematic Chrome extensions.

**Safe Area Insets:** `body` uses `env(safe-area-inset-*)` for notched device support (iPhone X, etc.)

**High-DPI Displays:** Canvas automatically scales by `window.devicePixelRatio` with context scaling for crisp rendering on BenQ boards and Retina displays.
