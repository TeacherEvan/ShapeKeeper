# Multiplayer Mode Planning Document

## Executive Summary

This document outlines the recommended approach for implementing real-time multiplayer functionality in the Dots and Boxes game, supporting 2-6 players with lobby systems, ready buttons, and seamless turn-based gameplay.

---

## Technology Stack Recommendation

### Primary Recommendation: **Convex + Vercel**

After evaluating multiple backend solutions for turn-based browser games, **Convex with Vercel deployment** is the recommended stack for the following reasons:

#### Why Convex?

| Feature | Benefit for Dots and Boxes |
|---------|---------------------------|
| **Native Real-time Sync** | Game state updates propagate instantly to all connected players without extra setup |
| **ACID Transactions** | Ensures move validity and prevents race conditions when players act simultaneously |
| **TypeScript Support** | Strong typing prevents bugs in game logic |
| **React Integration** | Simple hooks for subscribing to game state |
| **Serverless Functions** | No server management required |
| **Built-in Authentication** | Easy player identification and session management |

#### Why Vercel?

| Feature | Benefit |
|---------|---------|
| **Zero-config Deployment** | Push code, auto-deploy both frontend and backend |
| **Edge Network** | Low latency globally for players worldwide |
| **Convex Marketplace Integration** | Seamless setup with Convex backend |
| **CI/CD Built-in** | Automatic deployments on every commit |
| **Free Tier** | Generous free tier for development and small-scale games |

---

## Alternative Options Evaluated

### 1. Firebase Realtime Database / Firestore
- **Pros**: Established, scalable, good documentation
- **Cons**: Higher costs at scale (read/write ops), vendor lock-in with Google
- **Verdict**: Good alternative if team has Firebase experience

### 2. Supabase (PostgreSQL + Realtime)
- **Pros**: Open source, SQL power, self-hosting option, Edge Functions
- **Cons**: More manual real-time setup, requires more backend code
- **Verdict**: Best for teams wanting SQL/relational features or open-source preference

### 3. Socket.io + Custom Node.js Backend
- **Pros**: Maximum flexibility, full control, no vendor lock-in
- **Cons**: Significant development overhead, manual scaling, security complexity
- **Verdict**: Only for teams with strong backend expertise and specific requirements

---

## Multiplayer Architecture Design

### Game Session Model

```typescript
// Convex schema example
interface GameSession {
  _id: Id<"games">;
  roomCode: string;           // 6-character room code for joining
  hostPlayerId: Id<"players">;
  gridSize: number;
  status: "lobby" | "playing" | "finished";
  currentPlayerIndex: number;
  players: PlayerState[];
  lines: string[];            // Array of line keys ("1,2-1,3")
  squares: Record<string, number>; // squareKey -> playerIndex
  createdAt: number;
  updatedAt: number;
}

interface PlayerState {
  playerId: Id<"players">;
  name: string;
  color: string;
  score: number;
  isReady: boolean;
  isConnected: boolean;
}
```

### Core Multiplayer Features

#### 1. Lobby System
- Host creates a room with a unique 6-character code
- Players join using the room code
- Host selects grid size
- All players choose their colors
- Ready button for each player
- Game starts when all players are ready (2-6 players)

#### 2. Player Management
- 2-6 player support
- Dynamic turn order (clockwise or random)
- Automatic handling of disconnected players
- Rejoin capability within timeout period

#### 3. Game State Sync
- Real-time line drawing updates
- Score updates pushed to all clients
- Turn indicator synced across devices
- Game over detection and winner announcement

---

## Implementation Phases

### Phase 1: Infrastructure Setup
1. Install Convex CLI and initialize project
2. Set up Vercel deployment pipeline
3. Create basic database schema
4. Configure authentication (anonymous or basic auth)

### Phase 2: Lobby Implementation
1. Room creation with unique codes
2. Room joining functionality
3. Player list display with colors
4. Ready/unready toggle
5. Game start conditions

### Phase 3: Game State Migration
1. Move game state to Convex tables
2. Implement move validation on server
3. Add real-time subscriptions
4. Handle turn management
5. Score calculation and updates

### Phase 4: UI Updates
1. Lobby screen with player list
2. Color selection for each player
3. Ready button functionality
4. Player count indicator
5. Connection status indicators
6. Reconnection handling UI

### Phase 5: Polish & Testing
1. Error handling and edge cases
2. Disconnect/reconnect flows
3. Game abandonment handling
4. Performance optimization
5. Cross-browser testing

---

## UI Components for Multiplayer

### New Screens Required

#### 1. Main Menu Screen
```
┌─────────────────────────────────┐
│       Dots and Boxes            │
│                                 │
│   ┌─────────────────────────┐   │
│   │     Create Game         │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │     Join Game           │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │     Local Play          │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

#### 2. Lobby Screen
```
┌─────────────────────────────────┐
│  Room: ABC123    [Copy Code]    │
├─────────────────────────────────┤
│  Grid Size: [5x5] [10x10] [20x20]│
├─────────────────────────────────┤
│  Players (3/6):                 │
│  ┌─────────────────────────────┐│
│  │ 🔴 Player 1 (Host) ✓ Ready  ││
│  │ 🔵 Player 2        ✓ Ready  ││
│  │ 🟢 Player 3        ○ Not Ready││
│  └─────────────────────────────┘│
│                                 │
│  Your Color: [Color Picker]     │
│  ┌───────────────┐              │
│  │   Ready ✓     │              │
│  └───────────────┘              │
│                                 │
│  [Start Game] (Host Only)       │
│  [Leave Room]                   │
└─────────────────────────────────┘
```

#### 3. Updated Game Header (Multi-player)
```
┌─────────────────────────────────────────┐
│ 🔴 P1: 5  │ 🔵 P2: 3  │ 🟢 P3: 4  │ Exit │
├─────────────────────────────────────────┤
│        🔴 Player 1's Turn               │
└─────────────────────────────────────────┘
```

---

## Player Colors

### Default Color Palette (6 Players Max)

| Player | Default Color | Hex Code |
|--------|--------------|----------|
| Player 1 | Red | #FF0000 |
| Player 2 | Blue | #0000FF |
| Player 3 | Green | #00FF00 |
| Player 4 | Orange | #FF8C00 |
| Player 5 | Purple | #8B00FF |
| Player 6 | Cyan | #00FFFF |

### Color Selection Rules
- No two players can have the same color
- Colors auto-assigned on join, can be changed in lobby
- Visual indicator if color conflicts

---

## Dependencies to Add

```json
{
  "dependencies": {
    "convex": "^1.x.x",
    "@convex-dev/auth": "^0.x.x"
  },
  "devDependencies": {
    "convex-test": "^0.x.x"
  }
}
```

---

## Estimated Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: Infrastructure | 2-3 days | Convex/Vercel setup |
| Phase 2: Lobby | 3-4 days | Room management |
| Phase 3: Game State | 4-5 days | Core multiplayer logic |
| Phase 4: UI Updates | 3-4 days | New screens and components |
| Phase 5: Polish | 2-3 days | Testing and edge cases |
| **Total** | **~3 weeks** | For full implementation |

---

## Security Considerations

1. **Server-side Move Validation**: All moves must be validated on Convex backend
2. **Rate Limiting**: Prevent spam moves/actions
3. **Room Access**: Only players in a room can modify game state
4. **Anti-cheat**: Server authoritative game state prevents client manipulation
5. **Data Privacy**: No personal data stored, anonymous play by default

---

## Migration Path

### From Current 2-Player Local to Multiplayer

1. **Local Mode Preservation**: Keep current local 2-player mode as "Local Play" option
2. **Shared Code**: Game logic (line drawing, square detection) shared between modes
3. **State Management**: Abstract state management to work with both local and remote backends
4. **UI Components**: Create reusable components that work in both contexts

---

## References

- [Convex Documentation](https://docs.convex.dev/)
- [Convex + Vercel Integration](https://docs.convex.dev/production/hosting/vercel)
- [Vercel Convex Templates](https://vercel.com/templates/convex)
- [Building Multiplayer Games with Supabase](https://dev.to/iakabu/i-built-a-real-time-multiplayer-browser-game-with-supabase-nextjs-no-backend-server-required-h28)

---

## Conclusion

The **Convex + Vercel** stack provides the optimal balance of:
- Developer experience
- Real-time capabilities
- Scalability
- Cost efficiency
- Time to market

This stack allows the team to focus on game mechanics rather than infrastructure, while providing a robust foundation for multiplayer functionality.
