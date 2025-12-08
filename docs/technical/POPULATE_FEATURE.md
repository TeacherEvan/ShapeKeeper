# Populate Feature Documentation

## Overview
The Populate feature allows players to add random "safe" lines to the game board. Safe lines are those that won't complete any squares, making gameplay more dynamic and preventing stalemates.

## Feature Details

### Local Play Mode
- Available to both players at any time
- Adds 10% of available safe lines (minimum 1)
- Lines appear in a distinct random color (3rd player color)
- Does not change current player turn

### Multiplayer Mode
- **Host-only feature** - Only the host can use populate
- Synchronizes across all players in real-time
- Lines broadcast via Convex backend mutations
- Button visibility restricted to host automatically

## Technical Implementation

### Frontend (game.js)

#### Constants
```javascript
static POPULATE_PLAYER_ID = 3; // Special player ID for populate lines
```

#### Key Methods
- `handlePopulate()` - Main handler for populate button clicks
  - Local mode: Draws lines directly
  - Multiplayer mode: Sends to Convex backend via `ShapeKeeperConvex.populateLines()`
- `getSafeLines()` - Returns array of line keys that won't complete squares
- `wouldCompleteSquare(lineKey)` - Checks if a line would complete any square
- `updatePopulateButtonVisibility()` - Shows/hides button based on:
  - Availability of safe lines
  - Host status in multiplayer mode

#### Properties
- `isHost` - Boolean flag indicating if current player is the host
- `isMultiplayer` - Boolean flag for multiplayer vs local mode
- `populateColor` - Randomly generated color for populate lines

### Backend (convex/games.ts)

#### Constants
```typescript
const POPULATE_PLAYER_ID = 3; // Display player ID (matches frontend)
const POPULATE_PLAYER_INDEX = 2; // Backend player index (0=P1, 1=P2, 2=Populate)
```

#### Mutation: `populateLines`
```typescript
args: {
  roomId: v.id("rooms"),
  sessionId: v.string(),
  lineKeys: v.array(v.string()), // Array of line keys to populate
}
```

**Validation:**
- Room must exist and be in "playing" status
- Only host can populate (server-side validation)
- Duplicate lines are skipped

**Return:**
```typescript
{ success: true, linesPopulated: number } | { error: string }
```

### Integration (convex-client.js)

```javascript
async function populateLines(lineKeys) {
    return await convexClient.mutation(api.games.populateLines, {
        roomId: currentRoomId,
        sessionId,
        lineKeys,
    });
}
```

Exposed globally as `window.ShapeKeeperConvex.populateLines()`

### Synchronization (welcome.js)

The `handleGameStateUpdate()` function properly handles populate lines:
- Detects `playerIndex === 2` as populate lines
- Maps to `DotsAndBoxesGame.POPULATE_PLAYER_ID` for rendering
- Adds line draw animations and pulsating effects
- Plays line sound for visual feedback

## Turn-Based Optimization

### Problem Solved
Without optimization, Convex subscriptions could trigger excessive re-renders on every database change, even if the game state hasn't meaningfully changed for the user.

### Solution
Turn-based optimization in `convex-client.js` implements:

1. **State Change Detection** - Only updates on meaningful changes:
   - Turn changes (currentPlayerIndex)
   - New lines drawn (lines.length)
   - Squares completed (squares.length)
   - Score changes (player.score)
   - Game status changes (room.status)

2. **Debouncing** - 50ms debounce to batch rapid changes

3. **Shallow State Caching** - Efficient state comparison using cached snapshots

### Performance Benefits
- **Reduced network traffic** - Skips duplicate updates
- **Lower CPU usage** - Fewer re-renders and redraws
- **Better UX** - Smoother gameplay, no stuttering from excessive updates
- **Scalability** - Efficient for 2+ player games

### Code Example
```javascript
function stateHasChanged(newState, lastState) {
    if (!lastState) return true;
    
    const newRoom = newState.room || {};
    const lastRoom = lastState.room || {};
    
    // Turn change detection
    if (newRoom.currentPlayerIndex !== lastRoom.currentPlayerIndex) return true;
    if (newRoom.status !== lastRoom.status) return true;
    
    // Line/square count change detection
    if (newState.lines.length !== lastState.lines.length) return true;
    if (newState.squares.length !== lastState.squares.length) return true;
    
    // Score change detection
    for (let i = 0; i < newState.players.length; i++) {
        if (newState.players[i]?.score !== lastState.players[i]?.score) return true;
    }
    
    return false;
}
```

## UI/UX Considerations

### Loading States
- Loading skeleton displayed while canvas initializes
- Smooth transitions between game states
- Visual feedback on populate button click

### Accessibility
- Populate button has descriptive `aria-label`
- Clear visual distinction for populate lines (3rd player color)
- Host-only access prevents confusion in multiplayer

### Visual Feedback
- Line draw animations for populate lines
- Pulsating effects on new lines (2s duration)
- Sound feedback (line sound played)
- Button auto-hides when no safe lines available

## Security

### Server-Side Validation
- Host-only restriction enforced in backend mutation
- Session ID validation for all mutations
- Room status validation (must be "playing")

### Race Condition Prevention
- Duplicate line checks prevent multiple insertions
- Turn-based optimization prevents race conditions
- Debounced updates batch concurrent changes

## Future Enhancements

### Potential Improvements
- [ ] Add animation for populate button availability
- [ ] Show preview of populate lines before applying
- [ ] Allow host to configure populate percentage (currently 10%)
- [ ] Add undo functionality for populate action
- [ ] Populate statistics (how many lines populated per game)
- [ ] Alternative populate strategies (e.g., populate edges vs center)

### Performance Optimizations
- [ ] Consider Web Workers for safe line calculation on large grids (30x30+)
- [ ] Implement spatial indexing for faster square completion checks
- [ ] Cache safe line calculations between populate clicks

## Testing Checklist

- [x] Local mode: Populate button works for both players
- [x] Local mode: Lines appear in distinct color
- [x] Local mode: Button hides when no safe lines available
- [x] Multiplayer: Only host sees populate button
- [x] Multiplayer: Populate lines sync across all players
- [x] Multiplayer: Non-host cannot populate (server validation)
- [x] Multiplayer: Populate doesn't change current turn
- [x] Turn-based optimization reduces network traffic
- [x] No security vulnerabilities (CodeQL verified)
