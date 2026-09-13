# ShapeKeeper — Multiplay + Grid Lock Fix Plan (2026-09-08)

Canonical cwd: /home/ewaldt/Documents/VS/GAMES/ShapeKeeper (verified readlink -f + git rev-parse).
Branch at audit: feat/live-lobby-silly-passcode. Fetched origin/main + new v2/production-hardening.

Two INDEPENDENT symptoms (two-opposite-symptom rule — treat separately, not one root):
A. Grid-size mechanism does not lock: LobbyManager.setGridSize() (line 116) updates this.gridSize locally only; convex/rooms/settings.ts updateGridSizeHandler exists but is never invoked by LobbyManager. Game-state.js (line 150) reads this.game.gridSize — if Lobby never writes Convex column gridSize, peers never see it, so "does not allow me to lock in a grid size".
B. Multiplayer connection/sync broken: LobbyManager (line 7 header) = "UI placeholder. Real multiplayer requires backend integration". No Convex subscription wiring; MultiplayerStartup.js has DESYNCED state (line 43). LiveLobbyManager supersedes it for online mode per AGENTS.md §Live lobby invariants.

Quality gates (pre-edit verified): lint=0, convex typecheck=0, vitest=0. Will re-run after edits.

Proposed fix (awaiting user approval before edit):
1. A: wire LobbyManager.setGridSize() → call Convex mutation updateGridSizeHandler (host-only, lobby-status gate preserved per settings.ts). Add gridSize propagation to createRoom (default 5 preserved) and joinRoom (sync from room state).
2. B: wire LobbyManager to subscribe via LiveLobbyManager.buildInviteUrl() / Convex rooms/queries; propagate lastRoomState through MultiplayerStartupController; eliminate DESYNCED false-positive by completing sync handshake before timeout.
3. Both: preserve passcode rules (§Passcode rules CRITICAL), no env-file misuse, word-word list ≥50.

Rollback: git checkout -- for edited files; backup current jobs.json already at /tmp (prior audit).
References: convex/rooms/settings.ts (updateGridSizeHandler), convex/rooms/shared.ts (passcode), src/ui/LobbyManager.js (placeholder), src/ui/MultiplayerStartup.js (desync), game-state.js (grid application), docs/plans/ (new plan file here).
External resources used: local source only; NO web_search/web_extract/curl (not needed; source is authoritative). Skill references: devils-dice-guardrails for verification discipline; convex-backend-patterns (loaded via skill_view if Convex edits needed).

---

## Resolution (2026-09-13, surgical-implementation dispatcher)

**Status: ARCHIVED — already implemented on main.**

Both claims A and B were verified against the live tree and found RESOLVED:

- **A (grid-lock):** `src/ui/menu/eventBindings.js:269` calls
  `window.ShapeKeeperConvex.updateGridSize(newSize)` (host-only guard) →
  `convex-client/room-operations.js:145` → `convex/rooms.ts:69` →
  `convex/rooms/settings.ts:4` (hostToken + lobby-status gate). Peer sync via
  Convex subscription; `syncHandlers.js` applies `roomState.gridSize` to the
  lobby manager and toggles `.lobby-grid-btn.selected`. Round-trip complete.

- **B (multiplayer sync):** `welcome.js:20` instantiates `LiveLobbyManager`
  (not the legacy placeholder). `MenuNavigation.subscribeToRoomUpdates()` wires
  `handleRoomUpdate` → `syncHandlers.handleRoomStateUpdate` → `lobbyManager`
  (the LiveLobbyManager instance). `DESYNCED` state is reachable on disconnect
  (`MenuNavigation.js:202`). `buildInviteUrl()` is the canonical invite-link
  builder per AGENTS.md.

No re-implementation performed. Plan archived as resolved.
