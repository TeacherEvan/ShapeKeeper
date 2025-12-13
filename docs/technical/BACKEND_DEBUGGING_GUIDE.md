# Backend Debugging Guide

This guide helps you systematically debug backend issues in ShapeKeeper's Convex backend.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Accessing Logs](#accessing-logs)
3. [Understanding Log Messages](#understanding-log-messages)
4. [Error Classification](#error-classification)
5. [Common Issues](#common-issues)
6. [Advanced Debugging](#advanced-debugging)

---

## Quick Start

When you encounter a backend error:

1. **Check the browser console** for the Request ID
2. **Go to Convex Dashboard** → Deployments → Logs
3. **Filter by Request ID** to see all backend logs for that request
4. **Look for error messages** with `[functionName] Error:` prefix

---

## Accessing Logs

### Browser Console
Client-side errors include Request IDs:
```
Error: [Request ID: 395912a7cd8be2f4] Server Error
```

### Convex Dashboard
1. Navigate to: https://dashboard.convex.dev
2. Select your deployment
3. Click **Logs** in the sidebar
4. Use filters:
   - **Request ID**: Paste from browser error
   - **Function name**: Filter by specific function (e.g., `games:drawLine`)
   - **Status**: Filter by success/failure
   - **Text search**: Search for specific error messages

### Development Logs
When running `npm run dev`, all console logs appear in your terminal in real-time.

---

## Understanding Log Messages

All backend functions now include structured logging with consistent prefixes:

### Log Format
```
[functionName] Action: { context }
```

### Example Logs

#### Room Creation
```javascript
[createRoom] Starting room creation {
  sessionId: "session_1234...",
  playerName: "Alice",
  gridSize: 10,
  partyMode: true
}
[createRoom] Room created successfully { roomId: "...", roomCode: "ABC123" }
[createRoom] Host player added { roomId: "...", sessionId: "..." }
```

#### Line Drawing
```javascript
[drawLine] Line draw request {
  roomId: "...",
  sessionId: "...",
  lineKey: "1,2-1,3"
}
[drawLine] Turn validation {
  currentPlayerIndex: 0,
  currentPlayerSession: "session_1234...",
  requestingSession: "session_1234...",
  isValidTurn: true
}
[drawLine] Line drawn successfully {
  lineKey: "1,2-1,3",
  playerId: "...",
  playerIndex: 0
}
[checkForCompletedSquares] Starting square check {
  newLineKey: "1,2-1,3",
  gridSize: 10
}
[checkForCompletedSquares] Square completed! {
  squareKey: "1,2",
  playerId: "...",
  playerIndex: 0,
  multiplier: { type: "multiplier", value: 2 }
}
```

#### Errors
```javascript
[drawLine] Error: Not player turn {
  expectedSession: "session_1234...",
  receivedSession: "session_5678..."
}
[joinRoom] Error: Room not found { roomCode: "XYZ789" }
```

---

## Error Classification

### Application Errors (Expected)
User-triggered validation failures that are part of normal operation:
- **Room not found**: User entered invalid room code
- **Not your turn**: User tried to draw when it's not their turn
- **Line already drawn**: User clicked an existing line
- **Color already in use**: User selected a taken color

**Action**: These are normal and handled by the UI. No code fix needed.

### Developer Errors (Bugs)
Unexpected errors indicating code problems:
- **Player not found** when player should exist
- **Room status mismatch** (e.g., trying to start when already playing)
- **Index out of bounds** errors
- **Type mismatches** in function arguments

**Action**: Fix the code logic causing the error.

### Read/Write Limit Errors
Database operation limits exceeded:
- Too many documents read in one function
- Too many writes in one transaction
- Function execution timeout

**Action**: Optimize queries, batch operations, or split into multiple functions.

### Internal Convex Errors
Temporary infrastructure issues:
- Network timeouts
- Database unavailable
- Deployment issues

**Action**: These are automatically retried. If persistent, contact Convex support.

---

## Common Issues

### Issue: "Room not found"
**Symptoms**: User can't join a room with a valid code

**Debug Steps**:
1. Check logs for `[joinRoom] Join request` with the room code
2. Look for `[joinRoom] Error: Room not found`
3. Verify room code format (should be 6 uppercase characters)
4. Check if room was created successfully with `[createRoom]` logs
5. Verify room hasn't been deleted (check `[leaveRoom]` logs)

**Common Causes**:
- Room code typo
- Room was deleted when last player left
- Case sensitivity issue (code should be uppercase)

### Issue: "Not your turn"
**Symptoms**: Player can't draw lines even though they think it's their turn

**Debug Steps**:
1. Find `[drawLine] Turn validation` log
2. Compare `currentPlayerSession` with `requestingSession`
3. Check if turn advanced correctly with `[drawLine] Turn advanced` logs
4. Verify player didn't get stuck after completing squares

**Common Causes**:
- Client state out of sync with server
- Subscription update didn't propagate
- Player reconnected with different session ID

### Issue: Game stuck / Can't start
**Symptoms**: Host can't start game, or game won't progress

**Debug Steps**:
1. Check `[startGame]` logs for validation failures
2. Look for `playerCount` and `players` array in logs
3. Verify all players have `isReady: true` or are the host
4. Check `status` field transitions

**Common Causes**:
- Not enough players (need at least 2)
- Players not marked as ready
- Room status stuck in wrong state

### Issue: Multiplier not applying
**Symptoms**: Score doesn't multiply when revealing multiplier

**Debug Steps**:
1. Check `[revealMultiplier]` logs
2. Verify `multiplier` object structure
3. Check score before/after in logs
4. Confirm player owns the square

**Common Causes**:
- Wrong player revealing (not their square)
- Multiplier is `truthOrDare` type, not `multiplier` type
- Score calculation bug

### Issue: Populate lines not working
**Symptoms**: Host can't populate lines, or lines don't appear

**Debug Steps**:
1. Check `[populateLines]` logs for authorization
2. Verify `requestingSession` matches `hostSession`
3. Check `inserted` vs `skipped` counts
4. Look for line insertion errors

**Common Causes**:
- Non-host trying to populate
- Game not in "playing" status
- Lines already exist (skipped)
- Client sending duplicate line keys

---

## Advanced Debugging

### Enable Verbose Client Logs
Add to `convex-client.js`:
```javascript
const client = new ConvexClient(CONVEX_URL, { verbose: true });
```

This shows all client-server communication in browser console.

### Enable Auth Debug Logs
Set environment variable in Convex Dashboard:
```
AUTH_LOG_LEVEL=DEBUG
```

This shows detailed authentication flow logs.

### Track Specific Request
1. Note the Request ID from browser error
2. Filter Convex logs by Request ID
3. Click the log entry to see all related logs
4. Expand each log to see full context objects

### Performance Debugging
All key operations include timing data:
1. Look for `createdAt` timestamps in logs
2. Compare timestamps between sequential operations
3. Check for long gaps indicating slow queries
4. Monitor function duration in Convex Dashboard

### Subscription Debugging
Turn-based optimization may delay updates:
1. Check `[Convex] Subscribed to room updates` in browser console
2. Verify `stateHasChanged` logic in `convex-client.js`
3. Look for debouncing delays (50ms default)
4. Check `updatedAt` timestamps in logs

### Database Query Debugging
Add temporary logs to investigate data:
```typescript
const players = await ctx.db.query("players").collect();
console.log('[DEBUG] All players:', players.map(p => ({
  id: p._id,
  name: p.name,
  session: p.sessionId,
  ready: p.isReady
})));
```

### Network Issues
1. Check browser Network tab for failed requests
2. Look for HTTP 500 errors (backend errors)
3. Check HTTP 401 errors (auth issues)
4. Verify Convex URL matches deployment

---

## Error Handling Best Practices

### For Developers

1. **Always check logs first** before assuming the bug is in the frontend
2. **Use Request IDs** to correlate browser errors with backend logs
3. **Add console.logs** to your functions when debugging new features
4. **Test error paths** explicitly (wrong turn, invalid room, etc.)
5. **Monitor production logs** for unexpected errors

### Log Structure Guidelines

Good log:
```javascript
console.log('[functionName] Action description', {
  relevantId: value,
  relevantState: state,
  result: outcome
});
```

Bad log:
```javascript
console.log('doing thing'); // No context
console.log(hugeObject); // Too much noise
```

---

## Getting Help

### Self-Service
1. Search logs for error message
2. Check this guide's Common Issues section
3. Review function code with logs side-by-side

### Community Support
- GitHub Issues: https://github.com/TeacherEvan/ShapeKeeper/issues
- Include: Request ID, relevant logs, browser console output

### Convex Support
- Dashboard → Help → Contact Support
- Provide: Deployment URL, Request ID, function name
- Describe: Expected vs actual behavior

---

## Appendix: All Backend Functions

### Room Management (rooms.ts)
- `createRoom` - Create a new game room
- `joinRoom` - Join an existing room
- `leaveRoom` - Leave a room
- `toggleReady` - Toggle player ready status
- `updatePlayer` - Update player name/color
- `updateGridSize` - Change grid size (host only)
- `updatePartyMode` - Toggle party mode (host only)
- `startGame` - Start the game (host only)
- `getRoomByCode` - Query room by code
- `getRoom` - Get room state (subscription)

### Game Logic (games.ts)
- `drawLine` - Draw a line (make a move)
- `revealMultiplier` - Reveal and apply multiplier
- `resetGame` - Reset game to lobby (host only)
- `populateLines` - Add safe lines (host only)
- `getGameState` - Get game state (subscription)

### Helper Functions (internal)
- `checkForCompletedSquares` - Check if line completes squares
- `normalizeLineKey` - Ensure consistent line key format
- `generateMultiplier` - Random multiplier generation
- `generateRoomCode` - Generate unique 6-char room code

---

## Version History

- **v4.3.0** - Added comprehensive structured logging to all functions
- **v4.2.0** - Initial backend implementation
