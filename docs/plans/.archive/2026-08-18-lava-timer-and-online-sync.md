# Lava Timer & Online Sync Resilience Implementation Plan

> **Goal:** Build an animated 10-second countdown with bouncing lava particles constrained to the gameplay board behind dots at 40% opacity, paired with an innovative jitter-free online turn timer with network delay auto-pause/drift compensation and local snapshot-based reconnection in the "Join Friends" screen.

**Architecture Overview:**

1. **Canvas Layering & Particle Engine:** A dedicated `LavaParticleSystem` operating within strict board boundaries (`[game.offsetX, game.offsetY]` to `[game.offsetX + boardWidth, game.offsetY + boardHeight]`). Rendered at 40% opacity in the canvas background stack _before_ lines, squares, and dots, ensuring interactive dots remain strictly on top.
2. **Network Clock Synchronization & Delay Detection:** Client-server RTT and monotonic drift tracking via timestamped mutation/query payloads (`clientSentAt`, `serverReceivedAt`, `turnStartTime`, `turnEndTime`). When lag exceeds threshold, active turn clock pauses for the lagging peer and extends turn budget proportionately to ensure fair play.
3. **Turn Snapshotting & Reconnect Storage:** After each turn, the game state is snapshotted to `localStorage` under `shapekeeper.online.snapshots.<roomId>`. The "Join Friends" screen dynamically renders all disconnected/in-progress games with one-click Reconnect (authoritative sync) and Delete/Dismiss actions.

**Tech Stack:** Vanilla JS (ES Modules), HTML5 Canvas 2D, Convex Backend (`convex/`), `localStorage` API, Vitest for unit tests, Playwright for E2E.

**Effort Estimate:** ~3–4 days (8 modular tasks) | **Feature Flag:** `window.FEATURE_LAVA_TIMER` & `window.FEATURE_SYNC_RESILIENCE`

---

## Milestone Timeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 1: Lava Particle Board Bounds & Canvas Background Rendering                    │
│ Tasks 1 & 2: Particle physics, elastic collisions, 40% alpha, layer below dots & lines   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 2: Monotonic Timer & Drift Compensation Engine                                 │
│ Tasks 3, 4 & 5: Jitter-free countdown, server epoch sync, lag pause & turn compensation   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 3: Turn Snapshots & "Join Friends" Reconnection UI                             │
│ Tasks 6 & 7: Turn-by-turn localStorage snapshots, saved games list, reconnect & delete   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 4: End-to-End Hardening, Testing & Feature Flag Rollout                        │
│ Task 8: Full vitest unit suite, Playwright E2E specs, and visual regression checks      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Mathematical Foundations & Data Flow

### 1. Mathematical Clock Synchronization (NTP-Style Smoothing)

```
Player Client (Turn Active)                   Convex Server Backend
     │                                                 │
     │── [t0: clientSentAt] Move / Ping Mutation ────►│
     │                                                 │── [t_server] Record server time
     │                                                 │   turnStartTime = t_server
     │                                                 │   turnEndTime = t_server + 10000
     │◄── [t1: clientReceivedAt] Subscription Update ──┘
     │
     ├─► Round Trip Time: RTT = t1 - t0
     ├─► Raw Clock Offset: θ_raw = t_server - (t0 + t1) / 2
     ├─► Exponential Moving Average: θ_smooth = 0.8 * θ_smooth + 0.2 * θ_raw
     ├─► Estimated Current Server Time: T_est(t) = Date.now() + θ_smooth
     │
     └─► Monotonic Countdown Calculation:
         Remaining Time R(t) = max(0, turnEndTime - T_est(t) + lagCompensationMs)
```

### 2. Lava Particle Physics & Boundary Equations

```
Board Bounding Box:
minX = game.offsetX
maxX = game.offsetX + (game.gridCols - 1) * game.cellSize
minY = game.offsetY
maxY = game.offsetY + (game.gridRows - 1) * game.cellSize

For every particle p with radius r in [6px, 16px]:
- Position update: p.x += p.vx * speedScale,  p.y += p.vy * speedScale
- Urgency Escalation (Remaining Time <= 5.0s): speedScale = 1.85, upward buoyancy += 0.08
- Elastic Boundary Reflection:
    p.x - r < minX  ==>  p.x = minX + r,  p.vx = |p.vx| * 0.88
    p.x + r > maxX  ==>  p.x = maxX - r,  p.vx = -|p.vx| * 0.88
    p.y - r < minY  ==>  p.y = minY + r,  p.vy = |p.vy| * 0.88
    p.y + r > maxY  ==>  p.y = maxY - r,  p.vy = -|p.vy| * 0.88
```

### 3. Canvas Layer Execution Order

```
Renderer.draw() Execution Sequence:
  1. drawDynamicBackground()
  2. drawAmbientParticles()
  3. drawLavaTimer(game)              ◄── [Layer 2: 40% Opacity Glowing Lava & Center Countdown]
  4. drawLines() & drawLineAnimations()
  5. drawSquares() & drawSquaresWithAnimations()
  6. drawParticles() & drawSparkles()
  7. drawDots()                       ◄── [Layer 5 Top: Crisp, Unobscured, Interactive Dots]
  8. drawSelectedDot() / drawKeyboardFocusDot()
```

---

## UI / UX Mockups

### Mockup A: Board Bounds Lava Countdown (40% Opacity Behind Dots)

```
+-----------------------------------------------------------------------+
|  ShapeKeeper - Online Match (Room: XK92L1)               Score: 4 - 3  |
+-----------------------------------------------------------------------+
|                                                                       |
|      (minX, minY)                                                     |
|         +================== BOARD BOUNDARY ===================+       |
|         |  o       o       o       o       o       o       o  |       |
|         |      * (lava particle)                              |       |
|         |  o       o-------o       o       o       o       o  |       |
|         |          |       |     * (bouncing particle)        |       |
|         |  o       o-------o       o       o       o       o  |       |
|         |              .---.                                  |       |
|         |  o       o  /     \      o       o       o       o  |       |
|         |            |  07   |  (40% translucent countdown)   |       |
|         |  o       o  \     /      o       o       o       o  |       |
|         |              `---'    *                             |       |
|         |  o       o       o       o       o       o       o  |       |
|         |                   * (lava particle bounce)          |       |
|         |  o       o       o       o       o       o       o  |       |
|         +=====================================================+       |
|                                                     (maxX, maxY)      |
|                                                                       |
|  [ Player 1's Turn: 7.2s remaining ]  [ ⏸️ Syncing: +0.4s added ]      |
+-----------------------------------------------------------------------+
```

### Mockup B: "Join Friends" Screen with Saved / Incomplete Games

```
+-----------------------------------------------------------------------+
|                             JOIN FRIENDS                              |
+-----------------------------------------------------------------------+
|                                                                       |
|  Room Code: [ K 8 F 2 M 9 ]       Your Name: [ Alex       ]           |
|                                                                       |
|  [        JOIN ROOM        ]                                          |
|                                                                       |
|  ------------------ SAVED / INCOMPLETE GAMES ------------------------ |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | Room: XK92L1 (10x10 Grid)                Disconnected: 3m ago   |  |
|  | Lines: 28 drawn | Score: You 6 - 4 Opponent                     |  |
|  | [ 🔄 Reconnect Match ]                        [ 🗑️ Delete ]      |  |
|  +-----------------------------------------------------------------+  |
|  | Room: W7B2P4 (5x5 Grid)                  Disconnected: 1h ago   |  |
|  | Lines: 14 drawn | Score: You 2 - 2 Opponent                     |  |
|  | [ 🔄 Reconnect Match ]                        [ 🗑️ Delete ]      |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  [ < Back to Main Menu ]                                              |
+-----------------------------------------------------------------------+
```

---

## Risk Analysis & Mitigations

| Risk / Failure Mode                                       | Likelihood | Impact | Concrete Mitigation Strategy                                                                                                                                                                                                         |
| :-------------------------------------------------------- | :--------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Particle Leakage outside Board**                        | Medium     | Medium | Implement hard mathematical clamping: before integration and after bounce, enforce `p.x = clamp(p.x, minX + r, maxX - r)` and `p.y = clamp(p.y, minY + r, maxY - r)`.                                                                |
| **Dots Obscured by Lava Particles**                       | High       | High   | Explicit render pipeline ordering in `Renderer.draw()`: Lava canvas background runs _before_ lines, squares, and dots (`drawDots()` is invoked afterwards). Set global particle opacity to max `0.40`.                               |
| **Timer Text Flickering / Sub-pixel Jitter**              | High       | Medium | Decouple network packet arrival from display refresh. Use monotonic `performance.now()` delta against server `targetEndTime`, quantizing rendered string to 0.1s or 1.0s increments with stable typography kerning (`tabular-nums`). |
| **Client-Server Clock Skew (Local clock off by minutes)** | Medium     | High   | Compute Relative Server Epoch Offset $\theta = t_{\text{server}} - t_{\text{local}}$ upon first handshake and update via rolling exponential moving average. All countdowns use $t_{\text{local}} + \theta$.                         |
| **Unfair Timeout from Connection Lag**                    | Medium     | High   | Active packet latency monitoring: if a move packet or heartbeat takes $>600\text{ms}$, pause local clock decrement, award delay buffer $\Delta t$, and resume smoothly when connection confirms.                                     |
| **Snapshot Key Collisions or Bloat**                      | Low        | Low    | Scope localStorage keys strictly by `shapekeeper.online.snapshots.<roomId>`. Auto-purge snapshots older than 48 hours or when a match reaches `finished` status.                                                                     |

---

## Bite-Sized Implementation Tasks

### Task 1: Lava Particle Physics & Board Boundary Clamping

- **Files:** Create `particle-system/lava-particles.js`, modify `constants.js`, test `tests/lava-particles.test.js`
- **Commands:** `npx vitest run tests/lava-particles.test.js`
- **Commit:** `feat: implement bounded lava particle physics engine`

### Task 2: Lava Countdown Background Renderer Behind Dots

- **Files:** Create `renderer/lava-timer.js`, modify `renderer.js`, `game-state.js`, test `tests/lava-renderer.test.js`
- **Commands:** `npx vitest run tests/lava-renderer.test.js`
- **Commit:** `feat: render lava timer behind gameplay dots`

### Task 3: Monotonic Jitter-Free Clock & Delay Compensation Engine

- **Files:** Create `src/timing/clock-sync.js`, modify `constants.js`, test `tests/clock-sync.test.js`
- **Commands:** `npx vitest run tests/clock-sync.test.js`
- **Commit:** `feat: implement monotonic clock sync and lag compensation`

### Task 4: Convex Turn Timing Metadata Schema & Handlers

- **Files:** Modify `convex/schema.ts`, `convex/games/state.ts`, `convex/games/draw.ts`, test `tests/convex-timing.test.js`
- **Commands:** `npx vitest run tests/convex-timing.test.js`
- **Commit:** `feat: add turn timing metadata to convex backend`

### Task 5: Convex Client Clock Sync & Subscription Integration

- **Files:** Modify `convex-client/subscriptions.js`, `convex-client/game-operations.js`, `game-logic.js`, `dots-and-boxes-game.js`, test `tests/client-sync-integration.test.js`
- **Commands:** `npx vitest run tests/client-sync-integration.test.js`
- **Commit:** `feat: wire convex client clock sync and pause triggers`

### Task 6: Turn-by-Turn Local Incomplete Match Snapshots

- **Files:** Modify `local-save-replay.js`, `dots-and-boxes-game.js`, test `tests/online-snapshots.test.js`
- **Commands:** `npx vitest run tests/online-snapshots.test.js`
- **Commit:** `feat: implement turn-by-turn local snapshot storage`

### Task 7: "Join Friends" Reconnect & Saved Games Management UI

- **Files:** Modify `index.html`, `src/ui/menu/eventBindings.js`, `src/ui/LobbyManager.js`, `styles.css`, test `tests/join-reconnect-ui.test.js`
- **Commands:** `npx vitest run tests/join-reconnect-ui.test.js`
- **Commit:** `feat: add Join Friends saved games list with reconnect and delete`

### Task 8: End-to-End Verification, Feature Flag Gating & Polish

- **Files:** Modify `constants.js`, `src/ui/MenuNavigation.js`, test `tests/e2e/lava-timer-online-sync.spec.js`
- **Commands:** `npm test && npx playwright test`
- **Commit:** `feat: complete lava timer and online sync resilience system`
