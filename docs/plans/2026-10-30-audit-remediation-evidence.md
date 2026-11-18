# Audit Remediation Evidence — 2026-10-30

## Verification Handles

1. **Lint & Typecheck:**
   - `npm run lint`: exit code 0 (clean).
   - `npx convex typecheck`: exit code 0 (`tsc --noEmit` passed).

2. **Unit & Integration Tests:**
   - `npx vitest run`: **90 test files passed (90/90), 639 tests passed (639/639)**.
   - New regression suites:
     - `tests/populate-invariants.test.js`: 2/2 passed (validates incremental non-completing line selection and initial snapshot synchronization).
     - `tests/minimax-odd-ply.test.js`: 2/2 passed (validates odd-ply depth 1 and depth 3 horizon polarity fix).
     - `tests/color-utils.test.js`: 6/6 passed (validates `formatHexAlpha` for 3-digit, 6-digit, 8-digit hex, bounds clamping for negative and overflow alpha, and rgb fallback).
     - `tests/celebrations-lifecycle.test.js`: 4/4 passed (validates cancellation of intervals/RAFs, removal of celebration canvases, and de-duplication on repeated launches).

3. **Playwright E2E Tests:**
   - `npm run test:e2e:smoke` (`tests/e2e/smoke.spec.js`): 1/1 passed (6.5s).
   - `npx playwright test tests/e2e/opponent-tap.spec.js --project=chromium`: 2/2 passed (33.0s).

## Changes Summary

- **`AGENTS.md`**: Updated Levels invariants to document the Paid Edition rule (`FREE_LEVELS = 19`, paywall flag `window.PAYWALL_ENABLED`, grandfathering progress past 19) to match live source.
- **`game-state.js` & `convex/games/state.ts`**: Incremental populate line selection ensuring batches never complete 4-sided squares together.
- **`input-handler/pointer-controls.js` & `dots-and-boxes-game.js`**: Re-enabled opponent-tap cell interaction and added `tapSquare` delegation.
- **`src/ui/MenuNavigation.js`**: Set `multiplayerGame.isOnline = true` so the online Lava Timer ticks continuously per frame.
- **`src/ai/MinimaxEngine.js`**: Inverted 3-edge square polarity at odd search depths when `isMaximizing === false`.
- **`dots-and-boxes-game.js`**: Respected `pausedRemainingMs` during hidden tabs and invoked `maybeAnnounceTimeLow` in `tickLocalTurnClock`; added canvas setup and accessible grid rebuild to `applyValidatedLocalPayload`.
- **`ui-manager.js` & `ui-manager/celebrations.js`**:
  - Added `turnBannerLockUntil` to prevent 60Hz DOM thrashing and banner destruction after 16ms.
  - Implemented `stopCelebrationAnimations()` and wired it into `hideGameOverSplash()`, `uiManager.stopCelebrations()`, and re-launch triggers to cancel lingering `requestAnimationFrame` and `setInterval` loops and remove lingering `#confettiCanvas` / `#fireworksCanvas` elements.
- **`utils.js`, `renderer/effects.js`, `renderer/board.js`, `ui-manager/celebrations.js`**:
  - Created and exported `formatHexAlpha(color, alpha)` in `utils.js` that clamps alpha to `[0, 1]`, properly handles 3-, 6-, and 8-digit hex and `rgb()` fallbacks, completely preventing invalid negative hex values (e.g. `#ff0000-5`).
  - Replaced manual hex alpha string concatenations with `formatHexAlpha` across all particle effects and board animations.
- **`particle-system/effects.js` & `particle-system.js`**:
  - Removed orphaned `this.soaPool = new TypedParticlePool(...)` heap allocation from `ParticleSystem` constructor.
  - Replaced hardcoded `800×600` and `20px` coordinates across all 16 particle spawners with dynamic logical dimensions and offset/cell sizes from `system.game`.
- **`tutorial-system.js`**: Re-initialized ambient particles and turn timer upon match reset.
- **`effect-system/init.js`**: Guarded multiplayer from local mine initialization.
- **`src/ui/WelcomeAnimation.js`**: Cleared sprite trails during viewport resize and screen transitions.
- **`convex/games/draw.ts`**: Authenticated `callingPlayer` prior to running turn deadline expiry.
- **`convex-client/subscriptions.js` & `convex-client/game-operations.js`**: Passed `sessionId` in queries and mapped square state for deduplication.
- **`src/ui/menu/lobbyEvents.js`**: Separated player name and color debounce timers.
- **`constants.js`**: Pruned dead party-mode arrays (`HYPOTHETICALS`, `DARES`, `TRUTHS`, `PHYSICAL_CHALLENGES`).
