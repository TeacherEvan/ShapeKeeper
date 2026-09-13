# Comprehensive Codebase Audit & Modernization Plan

> **Date:** 2026-08-21  
> **Target Version:** ShapeKeeper v4.3.0+  
> **Status:** Approved / Ready for Implementation  
> **Author:** Antigravity AI Engineering Pair

---

## 1. Plan Header

### Goal
Perform an exhaustive architectural, performance, security, accessibility, and reliability audit of the entire ShapeKeeper codebase. Modernize tooling configurations, eliminate legacy artifacts, reinforce real-time sync resilience, verify high-DPI canvas performance, and solidify test coverage across all core modules.

### Architecture Overview
ShapeKeeper is a zero-build browser-based territory capture game utilizing Vanilla JavaScript (ES6+ modules), HTML5 2D Canvas rendering, and a real-time serverless backend powered by Convex (`convex/`).

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SHAPEKEEPER ARCHITECTURE                                 │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   BROWSER CLIENT (Vanilla ES Modules - Zero Build Step)                                  │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│   │ index.html (Main Entry) ──► welcome.js / game.js                                  │   │
│   │                                                                                  │   │
│   │ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐     │   │
│   │ │ DotsAndBoxesGame     │  │ GameState            │  │ GameLogic            │     │   │
│   │ │ (Root Orchestrator)  │  │ (Score, Turns, Grid) │  │ (Square Detection)   │     │   │
│   │ └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘     │   │
│   │            │                         │                         │                 │   │
│   │ ┌──────────▼───────────┐  ┌──────────▼───────────┐  ┌──────────▼───────────┐     │   │
│   │ │ Renderer & Subsystem │  │ InputHandler         │  │ UIManager & A11y     │     │   │
│   │ │ (Board, Effects, Lava│  │ (Pointer & Keyboard) │  │ (DOM Cache, Screen   │     │   │
│   │ │  Markers, Ambient)   │  │                      │  │  Reader Announcer)   │     │   │
│   │ └──────────┬───────────┘  └──────────────────────┘  └──────────────────────┘     │   │
│   │            │                                                                     │   │
│   │ ┌──────────▼───────────┐  ┌──────────────────────┐  ┌──────────────────────┐     │   │
│   │ │ ConvexClientWrapper  │  │ ClockSync Controller │  │ LocalStorage Snapshots│    │   │
│   │ │ (Rooms, Game Ops)    │  │ (NTP Smoothing, RTT) │  │ (Reconnection Store) │     │   │
│   │ └──────────┬───────────┘  └──────────────────────┘  └──────────────────────┘     │   │
│   └────────────┼─────────────────────────────────────────────────────────────────────┘   │
│                │                                                                         │
│                ▼ WebSocket Subscriptions & RPC Mutations                                 │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│   │ CONVEX SERVERLESS BACKEND (TypeScript)                                           │   │
│   │ ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐     │   │
│   │ │ schema.ts            │  │ rooms.ts & mutations │  │ games.ts & draw.ts   │     │   │
│   │ │ (rooms, players,     │  │ (Lobby creation,     │  │ (Server move check,  │     │   │
│   │ │  lines, squares)     │  │  joining, host mgmt) │  │  authoritative turn) │     │   │
│   │ └──────────────────────┘  └──────────────────────┘  └──────────────────────┘     │   │
│   └──────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack
- **Frontend Core:** Vanilla JavaScript (ES6+ native modules), HTML5 Canvas 2D, CSS3 (Modular Stylesheets).
- **Backend & Realtime:** Convex Serverless Backend (`convex/`) with TypeScript runtime.
- **Testing & Verification:** Vitest v4 (`jsdom` environment), Playwright E2E (`tests/e2e/`), Convex typechecker (`tsc --noEmit`), ESLint v9 Flat Config.
- **Hosting & Deployment:** Vercel (Static Frontend) + Convex Cloud Backend.

### Effort Estimate
- **Total Duration:** 3 Days (6 Milestones / 10 Bite-Sized Tasks)
- **Feature Flags:** 
  - `window.FEATURE_AUDIT_HARNESS` (Toggles diagnostics and health monitoring)
  - `window.FEATURE_LAVA_TIMER` (Toggles lava particle countdown)
  - `window.FEATURE_SYNC_RESILIENCE` (Toggles snapshot-based online reconnects)

---

## 2. Milestone Timeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 1: Tooling & Configuration Hygiene                                             │
│ - Task 1: Migrate Vitest config to native ESM (.mjs) & unify verify script               │
│ - Task 2: Audit and archive legacy experimental artifacts (Triangle/ and root logs)      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 2: Core Engine & Memory Lifecycle Verification                                  │
│ - Task 3: Audit canvas rendering pipelines & verify high-DPI scaling across resolutions   │
│ - Task 4: Validate animation array lifecycle & bounded particle memory compaction       │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 3: Backend Concurrency, Schemas & Security Audit                                │
│ - Task 5: Audit Convex schema indexes, room code generation collision safety, and auth    │
│ - Task 6: Validate server-side move verification & optimistic update rollback safety     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 4: A11y, Keyboard Navigation & UX Resiliency                                   │
│ - Task 7: Audit ARIA live announcements, screen-reader focus flow & theme contrast       │
│ - Task 8: Audit touch/pointer/keyboard unified input handling & gesture conflicts        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 5: Test Suite Expansion & E2E Matrix Validation                                 │
│ - Task 9: Expand unit test coverage for uncovered DOM-adjacent subsystems               │
│ - Task 10: Multi-browser cross-device compatibility pass (Chromium, Firefox, WebKit, iOS)│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Diagrams

### Client-to-Server Turn Execution & Drift Compensation Data Path

```
 +------------------+                                        +---------------------+
 |  Browser Client  |                                        |    Convex Server    |
 +--------+---------+                                        +----------+----------+
          |                                                             |
          |  [1] Player taps dot-to-dot line on Canvas                  |
          |  ----------------------------------------                   |
          |  - Instant local UI feedback (hover preview lock)           |
          |  - t0 = Date.now()                                          |
          |                                                             |
          |  [2] drawLine({ roomId, sessionId, lineKey, clientSentAt:t0})
          | ───────────────────────────────────────────────────────────>|
          |                                                             | [3] Backend Validation
          |                                                             |  - Verify room.status === 'playing'
          |                                                             |  - Verify currentPlayer.sessionId === args.sessionId
          |                                                             |  - Verify lineKey not already in 'lines' table
          |                                                             |
          |                                                             | [4] State Mutation
          |                                                             |  - Insert line record
          |                                                             |  - Evaluate completed squares server-side
          |                                                             |  - Calculate next turn + timer budget (+10000ms)
          |                                                             |  - Record serverReceivedAt = Date.now()
          |                                                             |
          |  [5] Reactive Subscription Broadcast (getGameState / Room)  |
          |<────────────────────────────────────────────────────────────|
          |                                                             |
          |  [6] Clock Synchronization (NTP-Style Smooth Offset)        |
          |  - RTT = t1 - t0                                            |
          |  - θ_raw = serverReceivedAt - (t0 + t1) / 2                 |
          |  - θ_smooth = 0.8 * θ_smooth + 0.2 * θ_raw                  |
          |  - Remaining Turn Time = turnEndTime - (Date.now() + θ)     |
          |                                                             |
          |  [7] Local Storage Snapshot Saved                           |
          |  - Key: shapekeeper.online.snapshots.<roomId>               |
          |  - Stores: lines, squares, scores, turn order               |
          |                                                             |
          |  [8] Screen Reader & UI Update                              |
          |  - AccessibilityAnnouncer.announceStatus()                  |
          |  - Render board changes, trigger particle bursts            |
          v                                                             v
```

---

## 4. UI / UX Layout Mockups

### Mockup 1: Modernized Codebase Health & Diagnostic HUD (`window.FEATURE_AUDIT_HARNESS`)

```
+---------------------------------------------------------------------------------------+
|  ShapeKeeper v4.3.0 [ONLINE]              FPS: 60.0 | RTT: 42ms | Mem: 18.4MB [DEV]   |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   (0,0)                                                                               |
|     +========================= GAMEPLAY CANVAS STACK =========================+       |
|     |  o       o       o       o       o       o       o       o       o   |       |
|     |      * (ambient particle)                                               |       |
|     |  o       o=======o       o       o       o       o       o       o   |       |
|     |          | RED 1 | (square completed)                                   |       |
|     |  o       o=======o       o       o       o       o       o       o   |       |
|     |              .---.                                                      |       |
|     |  o       o  / 08s \ (Lava Timer Background @ 40% Opacity)        o   |       |
|     |  o       o  \ === /      o       o       o       o       o       o   |       |
|     |              `---'                                                      |       |
|     |  o       o       o       o.......o (Keyboard Focus Ribbon)       o   |       |
|     |                          [ (2,4) ]                                      |       |
|     |  o       o       o       o       o       o       o       o       o   |       |
|     +=========================================================================+       |
|                                                                                       |
|  [ Player 1 (Red): 4 pts ]      [ Player 2 (Blue): 2 pts ]      [ Turn: Blue (8s) ]   |
|  Status: "Player 1 completed square at Row 1, Col 1 (+1 Point)" (A11y Live Region)   |
+---------------------------------------------------------------------------------------+
```

### Mockup 2: Reconnection & Disconnect Recovery Screen

```
+---------------------------------------------------------------------------------------+
|                                     JOIN FRIENDS                                      |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   Enter Room Code: [  W  7  B  2  P  4  ]          Player Name: [  Alex  ]            |
|                                                                                       |
|   [                  JOIN ROOM NOW                  ]                                 |
|                                                                                       |
|   ========================= RESUMABLE ACTIVE MATCHES =========================        |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | Room: XK92L1 (10x10 Grid)                       Status: Disconnected 2m ago   |   |
|   | Score: You 8 - 6 Opponent | Total Lines: 34 / 180                             |   |
|   | [ 🔄 Resume Match (Authoritative Reconnect) ]             [ 🗑️ Forget Match ]   |   |
|   +-------------------------------------------------------------------------------+   |
|                                                                                       |
|   [ < Return to Main Menu ]                                                           |
+---------------------------------------------------------------------------------------+
```

---

## 5. Comprehensive Risk Assessment & Mitigation Matrix

| # | Risk Description | Severity | Impact Area | Mitigation Strategy |
|---|------------------|----------|-------------|---------------------|
| **R1** | **Vite Native Config ESM Warning** (`vitest.config.js` loaded in CJS mode) | Low | Build & Test Tooling | Rename `vitest.config.js` to `vitest.config.mjs` or ensure explicit ES module declaration. |
| **R2** | **Memory Leaks from Rapid Canvas Animations** (Heavy 30×30 grid matches) | Medium | Client Performance | Continuous in-place array compaction (`_compactAnimationArray`), object pooling for high-frequency particles. |
| **R3** | **Network Jitter & False Timeout Disconnects** during online turn timer countdown | High | Multiplayer UX | Server-authoritative turn timestamps with NTP-style Exponential Moving Average (EMA) smoothing and drift buffer. |
| **R4** | **Stale / Orphaned Disconnected Rooms** occupying backend memory | Medium | Convex Backend | Clean indexing on `rooms` by status; automatic disconnect status patch on ping timeout; client snapshot expiry. |
| **R5** | **DOM Injection / XSS Risks in Player Names** | Medium | Security & DOM | Strict HTML entity escaping in `LobbyManager.js`, `UIManager.js`, and `Toast.js`; never use raw `innerHTML` with unsanitized names. |
| **R6** | **High-DPI Retina Blurring / Distortion** on mobile devices | Medium | Visual Quality | Enforce device pixel ratio scaling (`window.devicePixelRatio`) with matching CSS logical size and canvas buffer size. |
| **R7** | **Screen Reader Announcement Thrashing** on rapid moves | Low | Accessibility (WCAG) | Rate-limit announcements with debounce/queue in `AccessibilityAnnouncer.js` and use `aria-live="polite"`. |

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Tooling & Config Hygiene (Vitest Native ESM & Verification Pipeline)
- **Files to Modify:**
  - `vitest.config.js` -> rename/reconfigure to `vitest.config.mjs`
  - `package.json` (update verify script & test scripts)
- **TDD / Steps:**
  1. Rename `vitest.config.js` to `vitest.config.mjs`.
  2. Verify Vitest runs cleanly without `configLoader: 'native'` warning: `npx vitest run`.
  3. Ensure `npm run verify` runs `convex typecheck`, `eslint`, and all unit tests in a single command.
- **Verification:** Run `npm run verify` and verify exit code is 0 with zero warnings.

---

### Task 2: Legacy Artifacts Organization & Maintenance
- **Files to Modify / Organize:**
  - `Triangle/canvasBonusFeature.md` (Document as historical legacy artifact or relocate to `docs/history/`)
  - Root diagnostic logs (`ai_diagnose.log`, `ai_diagnose2.log`, `ai_moves.json`)
- **TDD / Steps:**
  1. Add a clear historical header note to `Triangle/canvasBonusFeature.md` clarifying that triangle mechanics were removed in v4.3.0 to focus on polished square grid mechanics.
  2. Ensure `.gitignore` properly excludes ephemeral `.log` and temporary JSON diagnostics.
- **Verification:** Run `git status` and ensure clean tracking.

---

### Task 3: Canvas Rendering Pipeline & High-DPI Resolution Audit
- **Files to Modify:**
  - `renderer.js`
  - `renderer/board.js`
  - `renderer/markers.js`
  - `renderer/lava-timer.js`
- **TDD / Steps:**
  1. Audit `Renderer.draw()` layer execution sequence to ensure background, lava particles, lines, squares, multipliers, and dots are rendered in strict visual hierarchy.
  2. Validate device pixel ratio scaling (`canvas.width = logicalWidth * dpr`, `ctx.scale(dpr, dpr)`).
  3. Write test in `tests/lava-renderer.test.js` checking that layer ordering remains invariant.
- **Verification:** Run `npx vitest run tests/lava-renderer.test.js`.

---

### Task 4: Animation Lifecycle & Particle Memory Compaction Audit
- **Files to Modify:**
  - `animation-system.js`
  - `particle-system.js`
  - `particle-system/core.js`
  - `particle-system/lava-particles.js`
- **TDD / Steps:**
  1. Audit `_compactAnimationArray()` in `animation-system.js` and `LavaParticleSystem.update()`.
  2. Ensure inactive particles (`life <= 0` or out-of-bounds) are pruned without allocating new array buffers every frame.
  3. Verify particle cap limits (e.g., maximum 300 active particles at any given tick).
  4. Write test in `particle-system/core.test.js` validating memory stability over 1,000 simulated frames.
- **Verification:** Run `npx vitest run particle-system/core.test.js`.

---

### Task 5: Backend Concurrency, Schemas & Security Validation
- **Files to Modify:**
  - `convex/schema.ts`
  - `convex/rooms/mutations.ts`
  - `convex/games/draw.ts`
  - `convex/games/squares.ts`
- **TDD / Steps:**
  1. Audit schema indexes: ensure `by_code`, `by_status`, `by_room_and_session`, `by_room_and_key` cover all queries.
  2. Audit room code generation: verify collision loop safely generates unique 6-character alphanumeric codes.
  3. Audit `drawLineHandler`: verify strict turn checks prevent race conditions and illegal move submissions.
  4. Run `npx convex typecheck` to guarantee complete type safety.
- **Verification:** Run `npx convex typecheck`.

---

### Task 6: Network Clock Sync & Local Storage Reconnection Audit
- **Files to Modify:**
  - `src/timing/clock-sync.js`
  - `src/timing/turn-clock-controller.js`
  - `src/ui/LobbyManager.js`
  - `local-save-replay.js`
- **TDD / Steps:**
  1. Audit NTP exponential moving average algorithm in `clock-sync.js`.
  2. Verify that clock drift calculations handle negative RTT or client system clock alterations gracefully.
  3. Audit snapshot persistence in `localStorage`: test corrupted snapshot recovery and JSON parsing safety.
  4. Run `npx vitest run tests/clock-sync.test.js tests/online-snapshots.test.js`.
- **Verification:** Run `npx vitest run tests/clock-sync.test.js tests/online-snapshots.test.js`.

---

### Task 7: Accessibility (A11y) & Screen Reader Focus Flow Audit
- **Files to Modify:**
  - `src/ui/AccessibilityAnnouncer.js`
  - `src/ui/MenuNavigation.js`
  - `input-handler/keyboard-controls.js`
  - `ui-manager.js`
- **TDD / Steps:**
  1. Verify all modal screens (`#welcomeScreen`, `#lobbyScreen`, `#winnerScreen`, `#tutorialModal`) trap focus and set `aria-hidden` on inactive background elements.
  2. Verify game status announcements (`"Player X drew a line at ..."`, `"Square completed!"`) are communicated via `announceStatus()`.
  3. Run E2E accessibility verification test `tests/e2e/aria-hidden-verify.spec.js`.
- **Verification:** Run `npx playwright test tests/e2e/aria-hidden-verify.spec.js --project=chromium`.

---

### Task 8: Input Handling & Cross-Device Gesture Unification Audit
- **Files to Modify:**
  - `input-handler.js`
  - `input-handler/pointer-controls.js`
  - `input-handler/keyboard-controls.js`
- **TDD / Steps:**
  1. Audit touch and pointer event listeners: prevent default gesture scrolling on canvas touchmove without breaking UI button taps.
  2. Audit keyboard focus traversal (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Space`, `Enter`).
  3. Verify dot selection radius scaling for mobile touch targets (`getDotSelectionRadiusMultiplier()`).
  4. Run `npx vitest run input-handler.test.js`.
- **Verification:** Run `npx vitest run input-handler.test.js`.

---

### Task 9: Unit Test Suite Expansion
- **Files to Modify:**
  - `sound-manager.test.js`
  - `ui-manager.test.js`
  - `effect-system.test.js`
  - `animation-system.test.js`
- **TDD / Steps:**
  1. Add mock Web Audio API context tests for `SoundManager` muting and volume transitions.
  2. Add unit tests for `UIManager` DOM diffing and score badge animation triggers.
  3. Add unit tests for `EffectSystem` tile activation and modal dismissal.
  4. Run full Vitest suite to verify 100% test passing rate.
- **Verification:** Run `npm test`.

---

### Task 10: Multi-Browser & Responsive E2E Regression Pass
- **Files to Modify:**
  - `playwright.config.js`
  - `tests/e2e/smoke.spec.js`
  - `tests/e2e/browser-compatibility.spec.js`
  - `tests/e2e/lava-timer-online-sync.spec.js`
- **TDD / Steps:**
  1. Execute Playwright cross-browser compatibility matrix across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari.
  2. Verify zero console errors, zero layout overflows, and responsive board scaling on mobile screens (375px width to 4K displays).
- **Verification:** Run `npm run test:e2e:compat`.

---

## 7. Definition of Done & Success Criteria

1. **Clean Verification Pipeline:** `npm run verify` passes with 0 lint errors, 0 type errors, and all unit tests passing.
2. **Zero Native Config Warnings:** Vitest runs natively without ESM/CJS warnings.
3. **Rock-Solid Multiplayer Resiliency:** Clock drift smoothed within ±50ms across simulated 300ms network jitter; snapshots enable seamless match resumption.
4. **Stable 60 FPS Canvas Performance:** Frame rendering time < 16.6ms on 30×30 grids with active particle effects and lava countdown layer.
5. **WCAG 2.2 Level AA Compliance:** Full keyboard navigation, proper ARIA live regions, focus trapping on all modals, and color-contrast compliance.
