# Copilot Instructions: ShapeKeeper

## 🚨 CRITICAL ARCHITECTURE WARNING 🚨
**This project is in a hybrid state.**
- **Active Production Code:** `game.js`, `welcome.js`, `convex-client.js`. These are loaded directly in `index.html`. **Edit these files to make changes.**
- **Future/Inactive Code:** `src/` directory. These are ES6 modules for a future refactor. **DO NOT EDIT** `src/` files unless explicitly working on the migration. They are NOT loaded by the application.

## Project Overview
ShapeKeeper is a Dots and Boxes game with local and online multiplayer.
- **Frontend:** Vanilla JavaScript (No build step), HTML5 Canvas.
- **Backend:** Convex (TypeScript) for real-time state.
- **Hosting:** Vercel.

## Key Files & Components
- **`game.js`**: The monolith. Contains `DotsAndBoxesGame` class, rendering loop, game logic, input handling, and `SoundManager`.
- **`welcome.js`**: Handles UI navigation, lobby creation, theme management, and `ShapeKeeperConvex` integration.
- **`convex/`**: Backend logic.
  - `schema.ts`: Defines `rooms`, `players`, `lines`, `squares`.
  - `games.ts`: Core game mutations (`drawLine`, `revealMultiplier`).
  - `rooms.ts`: Room lifecycle management.

## Critical Conventions
### 1. Line Key Normalization
Line keys MUST be normalized to prevent duplicates. Always sort coordinates:
```javascript
// Correct: "1,2-1,3"
// Incorrect: "1,3-1,2"
getLineKey(dot1, dot2) {
    const [first, second] = [dot1, dot2].sort((a, b) =>
        a.row === b.row ? a.col - b.col : a.row - b.row
    );
    return `${first.row},${first.col}-${second.row},${second.col}`;
}
```

### 2. Multiplayer State Sync
- **Local**: Optimistic updates apply immediately for responsiveness.
- **Remote**: `ShapeKeeperConvex.drawLine()` sends mutation.
- **Reconciliation**: `handleGameStateUpdate` (in `welcome.js`) receives the authoritative state from Convex and updates the local `game` instance.

### 3. Coordinate System
- Grid is 0-indexed.
- `lines` are stored as a Set of keys.
- `squares` are stored as a Map/Object.

## Development Workflow
- **Start Dev Server**: `npm run dev` (Runs `convex dev` and serves frontend).
- **Verify Code**: `npm run verify` (Typechecks Convex and validates JS syntax).
- **Deploy**: `npm run deploy`.

## Game Logic Reference
- **Square Detection**: Checked after every line draw. A square is formed when all 4 surrounding lines exist.
- **Multipliers**: Hidden in squares. Distribution: 65% (x2), 20% (x3), 10% (x4), 4% (x5), 1% (x10).
- **Party Mode**: Enables "Tile Effects" (Traps/Powerups) on squares.
- **Animations**: Handled in `game.js` `animate()` loop. Includes particles, emojis, and line pulses.

## Common Modifications
- **Adjust Grid/Canvas**: `DotsAndBoxesGame` constructor and `setupCanvas` in `game.js`.
- **Change Colors/Theme**: CSS variables in `styles.css` (e.g., `--bg-primary`, `--text-primary`).
- **Update Sounds**: `SoundManager` class in `game.js` (uses Web Audio API).
