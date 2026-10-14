# Multiplayer Lobby (Open Lobby Browser)

> Rewritten in v4.5.0 (2026-10-14). Replaces the v4.4.0 code + silly-passcode
> join flow with an open lobby browser: anyone joins by selecting **JOIN
> LOBBY** — no room codes, no passcodes. Legacy rooms (created before v4.5.0)
> keep working via the old `?join=` deep link.

## Flow

### Host opens a lobby

1. Player clicks **CREATE LOBBY** on the main menu.
2. Client calls `convex.rooms.createRoom` with
   `{ sessionId, playerName, gridSize, partyMode }`.
3. Server:
   - Generates a 6-char `roomCode` — an **internal handle only** (never shown
     to players; only the legacy deep link uses it).
   - Inserts the `rooms` row with `status: 'lobby'` and **no passcode**.
   - Inserts the host as the first `players` row.
4. Server returns `{ roomId, roomCode, hostToken }`. The hostToken lives in
   this tab's sessionStorage only.
5. Client subscribes to the room state via Convex. The lobby UI updates in
   realtime as players join.
6. The host sets Game Settings in the lobby: grid size and **Allowed Time**
   (seconds per turn; 0 = no limit).

### Anyone joins from the browser

1. Player clicks **JOIN LOBBY**.
2. `#lobbyBrowserScreen` opens; the client subscribes to `listOpenLobbies`
   (live — lobbies appear and disappear as they open, fill, and start).
3. Each entry shows host name, player count, grid size, and Allowed Time.
4. One click calls `joinRoom(roomCode, name)` — the code is passed silently;
   the player never types it. They land in the lobby.

### Deep link (legacy)

`?join=ROOMCODE` still works: `welcome.js` dispatches
`shapekeeper:joinFromUrl`, the menu bindings join that lobby directly
(bypassing the browser). Passcodes are never required for new rooms.

## listOpenLobbies

`convex/queries/roomQueries.ts` returns rooms with `status === 'lobby'`,
newest first, each with `{ roomId, roomCode, hostName, playerCount,
maxPlayers, gridSize, turnDurationSeconds, partyMode, createdAt }`. Player
counts and the host name are joined in-memory — the room count for a party
game stays small, so this avoids a schema migration. The client streams it
via `subscribeToOpenLobbies` (`convex-client/subscriptions.js`), torn down
by `cleanupRoomResources`.

## Allowed Time (both modes)

- **Online**: the host sets it in the lobby; the server stores
  `turnDurationSeconds` and re-arms `turnEndTime` per turn — only when the
  turn changes players (a completed shape retains the turn and its
  deadline). Expired turns are skipped server-side; a late move is rejected
  with `turnExpired: true` and a toast.
- **Local hot-seat**: players pick it on the local setup screen.
  `tickLocalTurnClock()` (`dots-and-boxes-game.js`) arms a per-turn
  countdown in `animate()`; expired turns skip via
  `gameState.switchToNextPlayer()` (bonus/frozen house rules preserved).
  AI mode is never timed. The value round-trips through local saves.

## Files

| File | Role |
|---|---|
| `convex/queries/roomQueries.ts` | `listOpenLobbies` — lobby-status rooms + counts |
| `convex/rooms.ts` | exports `listOpenLobbies` |
| `convex-client/subscriptions.js` | `subscribeToOpenLobbies` streaming subscription |
| `convex-client.js` | exposes it on `window.ShapeKeeperConvex` |
| `src/ui/menu/eventBindings.js` | browser screen wiring: subscribe, render entries, `joinLobbyByCode` (shared with the deep link) |
| `index.html` | `#lobbyBrowserScreen` (name input, live list, refresh) |
| `styles/lobby.css` | `.lobby-entry` styles |
| `welcome.js` | dispatches `shapekeeper:joinFromUrl` for `?join=` links |
| `tests/e2e/lobby-invite.spec.js` | browser smoke + deep-link safety |

## Manual smoke

```bash
# 1. start the dev server
npx convex dev
npx http-server -p 8000

# 2. open the host URL
open http://127.0.0.1:8000
# click CREATE LOBBY → set grid + Allowed Time → wait

# 3. open the app in a different browser profile
open http://127.0.0.1:8000
# click JOIN LOBBY → the host's lobby is listed → click it
# both players now see each other in realtime

# 4. legacy deep link
open "http://127.0.0.1:8000/?join=ABC123"
# joins that lobby directly (no browser step)
```

## Backwards compatibility

Rooms created before v4.5.0 may carry a `passcode`. `joinRoom` still
validates it when present (`convex/mutations/joinRoom.ts`), so old invite
links keep working. New rooms never get a passcode — the
`generateSillyPasscode()` machinery in `convex/rooms/shared.ts` is legacy
and retained only for those old rooms.
