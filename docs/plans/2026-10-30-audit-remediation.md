# Plan: 2026-10-30 Audit Remediation

## Objectives
- [x] OBJ-01 (Phase 1): Fix `[P0-1]` paywall configuration & checkout URL contract in `AGENTS.md` and `src/ui/LevelsProgress.js`.
- [x] OBJ-02 (Phase 1): Fix `[P0-2]` `populateLines` batch square completion in client (`game-state.js`) and server (`convex/games/state.ts`) to prevent match deadlocks.
- [x] OBJ-03 (Phase 1): Fix `[P0-3]` pointer cell interaction (`input-handler/pointer-controls.js`) and wire `tapSquare` in `dots-and-boxes-game.js`.
- [x] OBJ-04 (Phase 1): Fix `[P1-1]` missing `multiplayerGame.isOnline = true` in `src/ui/MenuNavigation.js` so online Lava Timer ticks continuously per frame.
- [x] OBJ-05 (Phase 2): Fix `[P1-2]` Minimax horizon polarity inversion on odd plies in `src/ai/MinimaxEngine.js`.
- [x] OBJ-06 (Phase 2): Fix `[P1-3]` dual local turn clocks (`dots-and-boxes-game.js`) background tab pause handling.
- [x] OBJ-07 (Phase 2): Fix `[P1-4]` `updateUI()` 60Hz DOM style thrashing and 16ms celebration banner overwrite (`ui-manager.js`, `ui-manager/celebrations.js`).
- [x] OBJ-08 (Phase 2): Fix `[P1-5]` and `[P1-8]` local save/load canvas setup (`dots-and-boxes-game.js`), tutorial reset timer re-init (`tutorial-system.js`), and mine initialization guard (`effect-system/init.js`).
- [x] OBJ-09 (Phase 2): Fix `[P1-6]` and `[P1-7]` WelcomeAnimation trail clearing (`src/ui/WelcomeAnimation.js`), plus server draw handler auth check (`convex/games/draw.ts`) and subscription square cache (`convex-client/subscriptions.js`, `convex-client/game-operations.js`).
- [x] OBJ-10 (Phase 3): Prune dead exports in `constants.js`, separate lobby debounce timers (`src/ui/menu/lobbyEvents.js`), and verify all quality gates.
