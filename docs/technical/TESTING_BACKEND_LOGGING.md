# Testing Backend Logging

This guide shows how to manually test the backend logging system and verify it's working correctly.

## Prerequisites

1. Convex backend deployed (run `npm run dev` or `npm run deploy`)
2. Application running locally (run `npm start`)
3. Access to Convex Dashboard: https://dashboard.convex.dev

## Test Scenarios

### Test 1: Room Creation Logging

**Steps:**

1. Open the application at http://localhost:8000
2. Click "Host Game"
3. Enter player name (e.g., "Alice")
4. Select grid size (e.g., 10x10)
5. Enable/disable Party Mode
6. Click "Create Room"

**Expected Logs in Convex Dashboard:**

```
[createRoom] Starting room creation {
  sessionId: "session_...",
  playerName: "Alice",
  gridSize: 10,
  partyMode: true
}
[createRoom] Room created successfully { roomId: "...", roomCode: "ABC123" }
[createRoom] Host player added { roomId: "...", sessionId: "..." }
```

**Browser Console Should Show:**

```
[Convex] Room created: ABC123 partyMode: true
```

---

### Test 2: Join Room Logging

**Steps:**

1. Open a second browser tab/window
2. Click "Join Game"
3. Enter the room code from Test 1
4. Enter different player name (e.g., "Bob")
5. Click "Join"

**Expected Logs:**

```
[joinRoom] Join request {
  roomCode: "ABC123",
  sessionId: "session_...",
  playerName: "Bob"
}
[joinRoom] Room found { roomId: "...", status: "lobby" }
[joinRoom] Current players { roomId: "...", playerCount: 1 }
[joinRoom] Player added successfully {
  roomId: "...",
  playerId: "...",
  playerIndex: 1,
  color: "#0000FF"
}
```

---

### Test 3: Error Handling - Invalid Room Code

**Steps:**

1. Click "Join Game"
2. Enter invalid room code: "ZZZZZ9"
3. Click "Join"

**Expected Logs:**

```
[joinRoom] Join request {
  roomCode: "ZZZZZ9",
  sessionId: "...",
  playerName: "..."
}
[joinRoom] Error: Room not found { roomCode: "ZZZZZ9" }
```

**UI Should Show:**

```
Error: Room not found
```

---

### Test 4: Game Start Logging

**Steps:**

1. In the host tab, ensure at least 2 players are in the room
2. Make sure other players click "Ready"
3. Host clicks "Start Game"

**Expected Logs:**

```
[startGame] Start game request { roomId: "...", sessionId: "..." }
[startGame] Validating players {
  roomId: "...",
  playerCount: 2,
  players: [
    { name: "Alice", isReady: false, sessionId: "..." },
    { name: "Bob", isReady: true, sessionId: "..." }
  ]
}
[startGame] Game started successfully {
  roomId: "...",
  playerCount: 2,
  gridSize: 10,
  partyMode: true
}
```

---

### Test 5: Line Drawing and Square Completion

**Steps:**

1. With game started, click on dots to draw lines
2. Complete a square (4 connected lines)

**Expected Logs for Line Draw:**

```
[drawLine] Line draw request {
  roomId: "...",
  sessionId: "...",
  lineKey: "1,2-1,3"
}
[drawLine] Turn validation {
  currentPlayerIndex: 0,
  currentPlayerSession: "...",
  requestingSession: "...",
  isValidTurn: true
}
[drawLine] Line drawn successfully {
  lineKey: "1,2-1,3",
  playerId: "...",
  playerIndex: 0
}
```

**Expected Logs for Square Completion:**

```
[checkForCompletedSquares] Starting square check {
  newLineKey: "1,2-2,2",
  playerId: "...",
  playerIndex: 0,
  gridSize: 10
}
[checkForCompletedSquares] Potential squares to check {
  lineType: "vertical",
  potentialSquares: [{ row: 1, col: 1 }]
}
[checkForCompletedSquares] Total lines in room { lineCount: 4 }
[checkForCompletedSquares] Checking square {
  squarePos: "1,1",
  sides: {
    topLine: "1,1-1,2",
    bottomLine: "2,1-2,2",
    leftLine: "1,1-2,1",
    rightLine: "1,2-2,2"
  },
  present: { top: true, bottom: true, left: true, right: true },
  hasAllSides: true
}
[checkForCompletedSquares] Square completed! {
  squareKey: "1,1",
  playerId: "...",
  playerIndex: 0,
  multiplier: { type: "multiplier", value: 2 }
}
[drawLine] Score updated {
  playerId: "...",
  oldScore: 0,
  newScore: 1
}
[drawLine] Turn retained (squares completed) {
  playerIndex: 0,
  playerName: "Alice"
}
```

---

### Test 6: Wrong Turn Error

**Steps:**

1. Wait for your turn to end
2. Try to click to draw a line when it's not your turn

**Expected Logs:**

```
[drawLine] Line draw request {
  roomId: "...",
  sessionId: "...",
  lineKey: "..."
}
[drawLine] Turn validation {
  currentPlayerIndex: 1,
  currentPlayerSession: "session_bob...",
  requestingSession: "session_alice...",
  isValidTurn: false
}
[drawLine] Error: Not player turn {
  expectedSession: "session_bob...",
  receivedSession: "session_alice..."
}
```

**UI Should Show:**

```
Error: Not your turn
```

---

### Test 7: Populate Lines (Host Only)

**Steps:**

1. As host during gameplay, click "Populate" button (if available)
2. Observe lines being added to the grid

**Expected Logs:**

```
[populateLines] Populate request {
  roomId: "...",
  sessionId: "...",
  lineCount: 15
}
[populateLines] Starting line insertion {
  hostPlayerId: "...",
  linesToInsert: 15
}
[populateLines] Line insertion complete {
  requestedLines: 15,
  inserted: 15,
  skipped: 0
}
[populateLines] Populate complete { linesPopulated: 15 }
```

---

### Test 8: Non-Host Populate Error

**Steps:**

1. As a non-host player, try to call populate (via browser console):
    ```javascript
    window.ShapeKeeperConvex.populateLines(['1,1-1,2']);
    ```

**Expected Logs:**

```
[populateLines] Populate request {
  roomId: "...",
  sessionId: "session_nonhost...",
  lineCount: 1
}
[populateLines] Error: Not host {
  requestingSession: "session_nonhost...",
  hostSession: "session_host..."
}
```

---

## Accessing Logs in Convex Dashboard

### Step-by-Step

1. Go to https://dashboard.convex.dev
2. Sign in to your account
3. Select your ShapeKeeper deployment
4. Click **"Logs"** in the left sidebar
5. You'll see all function calls in chronological order

### Filtering Logs

- **By Function**: Type function name in filter (e.g., `drawLine`)
- **By Status**: Click "Failed" to see only errors
- **By Text**: Search for specific error messages or player names
- **By Time**: Use the time range selector

### Reading a Log Entry

Each log entry shows:

- **Timestamp**: When the function was called
- **Function**: Which backend function (e.g., `games:drawLine`)
- **Status**: Success (green) or Failed (red)
- **Duration**: How long the function took
- **Console Output**: All your `console.log()` statements

### Expanding Details

Click any log entry to see:

- Full request arguments
- All console output (including objects)
- Return value
- Error stack trace (if failed)

---

## Using Request IDs

When an error occurs in the browser, you'll see:

```
Error: [Request ID: 395912a7cd8be2f4] Not your turn
```

**To find this in logs:**

1. Copy the Request ID: `395912a7cd8be2f4`
2. Paste into the Logs filter box
3. Click the matching entry to see full details

---

## Development Mode Live Logs

When running `npm run dev`, logs appear in your terminal in real-time:

```bash
$ npm run dev

✔ Convex functions ready! (2.5s)
📍 Dashboard: https://dashboard.convex.dev/...

[createRoom] Starting room creation { sessionId: "...", ... }
[createRoom] Room created successfully { roomId: "...", roomCode: "ABC123" }
[joinRoom] Join request { roomCode: "ABC123", ... }
[joinRoom] Player added successfully { ... }
[startGame] Game started successfully { ... }
[drawLine] Line draw request { ... }
[checkForCompletedSquares] Square completed! { ... }
```

---

## Troubleshooting

### No Logs Appearing

**Check:**

1. Is Convex dev/deploy running?
2. Are you looking at the correct deployment?
3. Is the browser actually calling backend functions?
4. Check browser console for client-side errors

### Too Many Logs

**Filter by:**

1. Function name (e.g., just `drawLine`)
2. Failed status only
3. Recent time range (last hour)
4. Specific player session ID

### Log Objects Not Showing

**Solution:**

1. Click the log entry to expand
2. Click the arrow next to object fields
3. Objects are collapsed by default to save space

---

## Verification Checklist

After testing, verify you can:

- [ ] See room creation logs in dashboard
- [ ] See join room logs with player details
- [ ] See error logs when joining invalid room
- [ ] See game start validation logs
- [ ] See line draw and turn validation logs
- [ ] See square completion detection logs
- [ ] See score update logs
- [ ] See error logs when trying wrong turn
- [ ] See populate lines logs (host only)
- [ ] Filter logs by function name
- [ ] Search logs by Request ID
- [ ] View detailed log objects in dashboard

---

## Next Steps

Once logging is verified:

1. Use logs to debug production issues
2. Monitor for unexpected errors in dashboard
3. Add custom logs for new features
4. Share Request IDs when reporting bugs
5. Review logs after each deployment

---

## Production Monitoring

### Regular Checks

1. **Daily**: Check for any failed function calls
2. **After deployment**: Verify all functions still work
3. **After user reports**: Search for their session ID in logs
4. **Performance**: Monitor function durations for slowdowns

### Red Flags

- Frequent "Room not found" errors (may indicate database issues)
- High function durations (>1 second)
- Internal Convex errors (infrastructure issues)
- Repeated authorization errors (client state sync issues)

---

## Reference

See full debugging guide: `docs/technical/BACKEND_DEBUGGING_GUIDE.md`
