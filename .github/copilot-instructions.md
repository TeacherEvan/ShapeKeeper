# Copilot Instructions: ShapeKeeper

## 🚨 CRITICAL ARCHITECTURE WARNING 🚨

**This project is in a hybrid state.**

- **Browser entrypoint:** `index.html`
- **Loaded at runtime:** `convex-client.js` as a classic script, then `game.js` and `welcome.js` as browser ES module entry scripts
- **Authoritative runtime shell for the competition branch:** root-level runtime files (`game.js`, `welcome.js`, `convex-client.js`, `dots-and-boxes-game.js`, and the root modules they import)
- **Important nuance:** `src/` is **not globally inactive**. `welcome.js` currently imports active `src/ui/` modules, so those files are part of the live runtime path. Do **not** treat the whole `src/` tree as safe speculative refactor territory.

### Practical edit rule

- **Edit root runtime files first** when changing gameplay, boot flow, Convex integration, or rendering behavior.
- **Edit active `src/ui/` modules only when the current runtime already imports them** (for example `MenuNavigation.js`, `ThemeManager.js`, `LobbyManager.js`, `WelcomeAnimation.js`).
- **Do not perform broad `src/` migration work** unless the task is explicitly about the refactor.

## Project Overview

ShapeKeeper is a Dots and Boxes game with local and online multiplayer.

- **Frontend:** Vanilla JavaScript (No build step), HTML5 Canvas.
- **Backend:** Convex (TypeScript) for real-time state.
- **Hosting:** Vercel.

## Key Files & Components

- **`index.html`**: Browser entrypoint. Loads Convex first, then the runtime entry scripts.
- **`game.js`**: Thin ES module entry script that exposes `DotsAndBoxesGame` to the browser runtime.
- **`dots-and-boxes-game.js`**: Main `DotsAndBoxesGame` class and orchestrator for root-level game systems.
- **`welcome.js`**: ES module entry script for menu bootstrapping, theme initialization, and Convex update wiring.
- **`src/ui/MenuNavigation.js`**: Active multiplayer menu and startup-flow orchestration used by `welcome.js`.
- **`src/ui/MultiplayerStartup.js`**: Startup state controller for multiplayer match boot, timeout handling, and first-authoritative-state tracking.
- **`playwright.config.js`**: Browser regression configuration for the no-build runtime, serving the app over local HTTP during Playwright runs.
- **`tests/e2e/`**: Playwright smoke and multiplayer regression coverage, including startup recovery, host/guest startup validation, reconnect-turn recovery, longer reconnect outage recovery, repeated reconnect-cycle recovery, duplicate-move sync checks, in-match host-leave recovery, and lobby host-transfer validation.
- **`src/ui/`**: Active UI support modules currently used by `welcome.js`.
- **`utils.js`**: Shared root-level runtime utilities used by active gameplay modules.

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
- **Reconciliation**: `handleGameStateUpdate` (implemented in `src/ui/MenuNavigation.js` and exposed by `welcome.js`) receives the authoritative state from Convex and updates the local `game` instance.

### 3. Multiplayer Startup Contract

- Startup should progress through explicit client states rather than loosely ordered side effects.
- The loading skeleton must remain visible for multiplayer startup until the first authoritative game-state payload is applied successfully.
- Startup timeout and retry behavior are orchestrated through `src/ui/MultiplayerStartup.js`; prefer extending that controller rather than scattering new startup flags through the UI.
- When changing multiplayer startup or reconnect behavior, keep subscription setup/cleanup explicit in `src/ui/MenuNavigation.js` and avoid relying on ad hoc globals.
- Browser regression coverage should assert observable startup phases through the loading overlay rather than relying only on console timing or implicit animation state.
- Treat reconnect recovery as a sequence, not just a final state; when possible, assert recovery through visible phase transitions and fixture-side artifact logs rather than only the last synchronized board snapshot.

### 4. UI Helper Ownership

- UI refresh helpers such as `updatePopulateButtonVisibility()` and `updateUI()` live on `game.uiManager`, not on the `DotsAndBoxesGame` instance itself.
- When reconciling authoritative multiplayer state in `src/ui/MenuNavigation.js`, call UI refresh methods through `game.uiManager` after mutating the `game` model.

### 5. Coordinate System

- Grid is 0-indexed.
- `lines` are stored as a Set of keys.
- `squares` are stored as a Map/Object.

## Development Workflow

- **Start Dev Server**: `npm run dev` (Runs `convex dev` and serves frontend).
- **Serve Frontend Over HTTP**: Use `npm run start`, `python -m http.server 8000`, or equivalent. Do **not** open `index.html` with `file://` because the app boots with browser ES modules.
- **Verify Code**: `npm run verify` (Typechecks Convex and validates JS syntax).
- **Run Unit Tests**: `npm test`
- **Run Browser Regression Tests**: `npm run test:e2e`
- **Deploy**: `npm run deploy`.

## Runtime Contract

- `index.html` is the only supported browser entrypoint.
- `convex-client.js` remains a classic script because it exposes
    `window.ShapeKeeperConvex`.
- `game.js` and `welcome.js` are explicit browser ES module entry scripts.
- `window.DotsAndBoxesGame`, `window.handleRoomUpdate`, and
    `window.handleGameStateUpdate` are still part of the current runtime
    contract.
- If a browser load appears blank after a change, inspect the module graph for
    missing exports, stale global assumptions, or import path errors before
    changing architecture.

## Validation Expectations

- For runtime changes, validate in this order:
    1. `npm run verify`
    2. `npm test`
    3. `npm run test:e2e` when browser flows, startup, lobby, sync, or reconnect behavior is touched
    4. browser boot over local HTTP when validating the live runtime manually
- For multiplayer startup changes, also verify that the loading overlay copy renders, the recovery controls exist, and the supported create/join flow still reaches the lobby or match screen as expected.
- For browser automation changes, prefer stable `data-testid` selectors and test observable startup phases such as `awaiting_first_authoritative_state`, `fatal_startup_failure`, and `in_match`.
- For reconnect-path browser changes, prefer assertions that combine visible UI state (`desynced`, `reconnecting`, `in_match`, turn indicator, host-only controls) with shared-fixture evidence such as connection transitions or delivery logs.
- When a new browser regression test exposes a production-path bug, fix the runtime path first and preserve the test; do not “solve” the problem by weakening the assertion unless the assertion is genuinely incorrect.
- Do not consider a runtime change complete if syntax passes but the browser
    entry modules fail to initialize.
- Prefer fixing explicit dependency edges over reintroducing broad globals.

## Game Logic Reference

- **Square Detection**: Checked after every line draw. A square is formed when all 4 surrounding lines exist.
- **Multipliers**: Hidden in squares. Distribution: 65% (x2), 20% (x3), 10% (x4), 4% (x5), 1% (x10).
- **Party Mode**: Enables "Tile Effects" (Traps/Powerups) on squares.
- **Animations**: Handled in `game.js` `animate()` loop. Includes particles, emojis, and line pulses.

## Common Modifications

- **Adjust Grid/Canvas**: `DotsAndBoxesGame` constructor and `setupCanvas` in `dots-and-boxes-game.js` / root runtime modules.
- **Change Colors/Theme**: CSS variables in `styles.css` and theme wiring in `src/ui/ThemeManager.js`.
- **Update Menu/Lobby Flow**: `welcome.js` and active `src/ui/` modules, especially `MenuNavigation.js`.
- **Update Multiplayer Startup / Recovery**: `src/ui/MenuNavigation.js`, `src/ui/MultiplayerStartup.js`, `index.html`, and `styles.css`.
- **Update Browser Regression Coverage**: `playwright.config.js`, `tests/e2e/`, `tests/e2e/helpers/bootstrap.js`, and any stable DOM hooks in `index.html` required for supported runtime flows.
- **Update Sounds**: `sound-manager.js` and any related root runtime integration.

## Phase 2 / Phase 3 / Phase 5 Documentation Notes

- The classic-script/module mismatch at boot has been removed.
- If the browser loads but nothing initializes, inspect the module graph for missing exports or old global assumptions before changing architecture.
- For runtime stabilization tasks, prefer small explicit imports over broad refactors.
- Phase 3 has started with a dedicated multiplayer startup controller, first-authoritative-state gating, timeout recovery UI, and unit coverage for the startup state machine.
- Phase 5 has now started with a working Playwright configuration, smoke coverage, startup timeout/retry/leave coverage, and a two-client host/guest startup check using a shared browser-side multiplayer fixture.
- The first two-client browser tests exposed real runtime regressions in `src/ui/MenuNavigation.js`; use browser coverage to validate object ownership and runtime call paths rather than assuming parity with local/unit-only checks.
- The shared browser-side multiplayer fixture in `tests/e2e/helpers/bootstrap.js` should be extended for reconnect, sync, host-leave, and artifact-logging edge cases instead of duplicating ad hoc mocks across new specs.
- `tests/e2e/multiplayer-sync.spec.js` now validates reconnect recovery through the visible turn indicator, longer outage recovery, repeated reconnect-cycle recovery, duplicate-line rejection without UI drift, in-match host-leave recovery, and lobby host transfer when the original host leaves.
- The shared fixture now records lightweight reconnect artifacts such as connection transitions and room/game delivery events; prefer building on those hooks before adding one-off debug state to the runtime.
- Treat the browser-visible turn indicator and loading overlay phases as part of the regression contract for multiplayer reliability; if they drift during sync or reconnect flows, treat it as a real product bug.
- The current startup hardening lives in active `src/ui/` code, but it still participates in the approved runtime path through `welcome.js`; treat it as production runtime code, not speculative refactor space.
- Use the competition roadmap in `docs/planning/COMPETITION_PRODUCTION_ROADMAP.md`
    as the source of truth for phase sequencing and go/no-go criteria.
