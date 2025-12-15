# Connection Pooling Implementation

## Overview

Connection pooling has been implemented in `convex-client.js` to efficiently manage WebSocket resources and prevent memory leaks in the ShapeKeeper multiplayer system.

## Key Features

### 1. Singleton Client Instance

- The Convex client uses a singleton pattern - only one instance is created per page session
- Subsequent calls to `initConvex()` reuse the existing instance instead of creating new connections
- This prevents resource exhaustion from multiple connection attempts

### 2. Connection State Tracking

The system tracks connection state through four states:

- `disconnected` - No active connection
- `connecting` - Connection being established
- `connected` - Active, healthy connection
- `reconnecting` - Attempting to restore connection after failure

Access state with:

```javascript
const state = window.ShapeKeeperConvex.getConnectionState();
```

### 3. Connection State Listeners

Subscribe to connection state changes:

```javascript
const unsubscribe = window.ShapeKeeperConvex.onConnectionStateChange((newState, oldState) => {
    console.log(`Connection state changed: ${oldState} → ${newState}`);
});

// Later, cleanup:
unsubscribe();
```

### 4. Resource Cleanup

#### Automatic Cleanup on Page Unload

The system automatically cleans up resources when the page is closed:

- Unsubscribes from all active subscriptions
- Closes the Convex client connection
- Clears timers and state

#### Manual Cleanup

Close the connection manually when needed:

```javascript
window.ShapeKeeperConvex.closeConnection();
```

#### Room Resource Cleanup

When leaving a room, resources are automatically cleaned up:

```javascript
await window.ShapeKeeperConvex.leaveRoom();
// Automatically unsubscribes from room/game subscriptions
// Clears timers and state trackers
```

### 5. Subscription Tracking

All active subscriptions are tracked in an internal `activeSubscriptions` Set:

- Subscriptions are added when created via `subscribeToRoom()` or `subscribeToGameState()`
- Subscriptions are removed when unsubscribed
- All tracked subscriptions are cleaned up on `closeConnection()`

This prevents memory leaks from orphaned subscriptions.

### 6. Connection Reset

Force a connection reset (useful for error recovery):

```javascript
window.ShapeKeeperConvex.resetConnection();
// Closes existing connection, sets state to 'reconnecting', then reinitializes
```

## Implementation Details

### Connection Lifecycle

1. **Initialization** (`initConvex`)
    - Checks for existing client (connection pooling)
    - Creates new client if needed
    - Sets connection state to 'connecting' → 'connected'
    - Generates/retrieves session ID from localStorage

2. **Active Usage**
    - Subscriptions tracked in `activeSubscriptions` Set
    - Connection state monitored
    - Resources reused across operations

3. **Cleanup** (`closeConnection`)
    - Unsubscribes from all active subscriptions
    - Closes Convex client (if `close()` method exists)
    - Resets all state variables
    - Sets connection state to 'disconnected'

### Resource Management

**Tracked Resources:**

- `convexClient` - Singleton Convex client instance
- `currentSubscription` - Room/lobby subscription
- `gameStateSubscription` - Game state subscription
- `activeSubscriptions` - Set of all subscription unsubscribe functions
- `updateDebounceTimer` - Debounce timer for game state updates
- `connectionStateListeners` - Array of state change callbacks

**Cleanup Triggers:**

- Page unload (`beforeunload` event)
- Manual `closeConnection()` call
- `leaveRoom()` (room-specific resources only)
- `resetConnection()` (full cleanup and reinit)

## Performance Benefits

1. **Reduced Connection Overhead**
    - Reusing the same WebSocket connection eliminates reconnection delays
    - Lower latency for subsequent operations

2. **Memory Efficiency**
    - Proper cleanup prevents memory leaks from orphaned subscriptions
    - State trackers are reset when no longer needed

3. **Better Resource Management**
    - Single connection point reduces server load
    - Tracked subscriptions ensure complete cleanup

4. **Improved Error Recovery**
    - `resetConnection()` provides clean recovery path
    - Connection state tracking enables better error handling UI

## Usage Examples

### Basic Multiplayer Flow

```javascript
// Initialize (automatically pools if exists)
window.ShapeKeeperConvex.initConvex();

// Create/join room
await window.ShapeKeeperConvex.createRoom('Player1', 10);

// Subscribe to updates (tracked automatically)
const unsubRoom = window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate);

// Play game...

// Leave room (cleans up subscriptions)
await window.ShapeKeeperConvex.leaveRoom();

// Connection persists for next game (pooling)
```

### Manual Cleanup

```javascript
// When user explicitly signs out or closes connection
window.ShapeKeeperConvex.closeConnection();
```

### Error Recovery

```javascript
// If connection errors occur
try {
    await window.ShapeKeeperConvex.drawLine(lineKey);
} catch (error) {
    console.error('Connection error:', error);
    // Reset connection for recovery
    window.ShapeKeeperConvex.resetConnection();
}
```

## Testing

Tests are in `convex-client.test.js` covering:

- Connection state transitions
- Subscription tracking
- Resource cleanup
- Connection reuse (pooling)
- Lifecycle management

Run tests:

```bash
npm test
```

## Migration Notes

### Breaking Changes

None - all existing code continues to work.

### New APIs

Four new methods added to `window.ShapeKeeperConvex`:

- `closeConnection()` - Clean up connection
- `resetConnection()` - Force reconnection
- `getConnectionState()` - Get current state
- `onConnectionStateChange(callback)` - Subscribe to state changes

### Backward Compatibility

All existing methods work exactly as before. The connection pooling is transparent to existing code.

## Future Improvements

Potential enhancements mentioned in the TODO comments:

1. Offline queue for actions when connection drops
2. Optimistic updates for immediate UI feedback
3. Redis for scalability in high-traffic scenarios
4. Rate limiting for mutations to prevent abuse

These are orthogonal to connection pooling and can be added later.
