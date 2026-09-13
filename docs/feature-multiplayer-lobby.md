# Multiplayer Lobby & Invite Link

> Added in v4.4.0 (2026-08-25). Replaces the previous code-only lobby with a
> live waiting room + shareable invite URL. The passcode scheme uses silly
> `[Adjective][Animal]` codes (e.g. `EasterPig`) that are dynamically generated
> per lobby — never env, never random letters.

## Flow

### Host creates a lobby

1. Player clicks **HOST AGAINST FRIENDS** on the main menu.
2. Client calls `convex.rooms.createRoom` with `{ sessionId, playerName, gridSize, partyMode }`.
3. Server:
   - Generates a 6-char `roomCode` (`generateRoomCode`, no I/O/0/1).
   - Generates a silly `passcode` (`generateSillyPasscode`, e.g. `EasterPig`).
   - Collision-checks both against the `by_code` and `by_passcode` indexes.
   - Inserts the `rooms` row with `status: 'lobby'`.
   - Inserts the host as the first `players` row.
4. Server returns `{ roomId, roomCode, passcode }` to the host. The passcode
   is shown ONLY to the host (it's the auth secret for joiners).
5. Client subscribes to the room state via Convex. The lobby UI updates in
   realtime as players join.

### Host shares the invite

- **Copy Invite Link** button (lobby screen) writes the URL to the clipboard.
  URL format: `https://<host>/?join=<roomCode>&passcode=<passcode>`.
- Fallback path (insecure context, no `navigator.clipboard`): a hidden
  readonly `<input>` is created, selected, and copied via `document.execCommand`.
- The host can also share the two codes verbally (room code is short, passcode
  is the silly word).

### Guest joins via link

1. Guest opens the invite URL. `welcome.js` reads `?join=&passcode=` and:
   - Hides every screen except `#joinScreen`.
   - Pre-fills `#joinRoomCode` and `#joinRoomPasscode`.
   - Focuses the name input.
2. Guest enters their name and clicks **Join Room**.
3. Client calls `convex.rooms.joinRoom` with `{ roomCode, sessionId, playerName, passcode }`.
4. Server validates the passcode against the stored one. Mismatch → error.
5. On success, server inserts the player and returns `{ roomId, playerId }`.
6. Client subscribes to the room. Both the host and the new guest see the
   updated player list in realtime.

### Guest joins by code (no link)

The passcode input is also present when the guest navigates to **JOIN AGAINST
FRIENDS** without a link. They type the room code AND the passcode the host
shared verbally.

## Passcode generation

See `convex/rooms/shared.ts` — `generateSillyPasscode()`:

- 50+ adjectives × 50+ animals (each list lives in the same file).
- Returns `[Adjective][Animal]` in TitleCase. **No numbers, no separators, no
  human names, no real places** — see the inline comments and the
  `convex/rooms/shared.test.js` invariant tests.
- Collision-checked against the live `by_passcode` index. If the practical
  space saturates, extend either word list rather than falling back to
  numbers or random letters (see AGENTS.md "Passcode rules").

## Why a separate passcode?

| Concern | roomCode | passcode |
|---|---|---|
| Visible to joiners? | yes | only on the URL / told by host |
| Length | 6 chars | ~12 chars (`EasterPig`-style) |
| Brute-force risk | high (visible) | low (private) |
| Server-validated? | no | yes |
| Lives in env / config? | no | no |
| Generation | `generateRoomCode` | `generateSillyPasscode` |

The room code is the public "what game is this?" identifier. The passcode is
the auth secret. Both are required to join a new lobby. Legacy rooms without a
passcode still allow code-only joining (backward compat for rooms created
before this feature).

## Files touched

| File | Change |
|---|---|
| `convex/schema.ts` | + `passcode: v.optional(v.string())`, + `by_passcode` index |
| `convex/rooms/shared.ts` | + `ADJECTIVES`, `ANIMALS`, `generateSillyPasscode()` |
| `convex/rooms/mutations.ts` | createRoom generates passcode, joinRoom validates it |
| `convex/rooms.ts` | joinRoom arg accepts `passcode: v.optional(v.string())` |
| `convex-client/room-operations.js` | joinRoom forwards passcode as optional 3rd arg |
| `src/ui/LiveLobbyManager.js` | **NEW** — state holder + URL builder + `getJoinParamsFromUrl` |
| `src/ui/LobbyManager.js` | preserved as the no-backend fallback (not deleted) |
| `src/ui/menu/eventBindings.js` | createGameBtn stores passcode; new copy-invite-link handler; join forwards passcode |
| `src/ui/menu/lobbyView.js` | renders passcode section when present |
| `welcome.js` | URL pre-fill on page load |
| `index.html` | new `#joinRoomPasscode` input; `#lobbyPasscodeSection`; `#copyInviteLinkBtn` |
| `convex/rooms/shared.test.js` | **NEW** — word-list + generation invariants |
| `src/ui/LiveLobbyManager.test.js` | **NEW** — applySnapshot, buildInviteUrl, getJoinParamsFromUrl, round-trip |
| `tests/e2e/lobby-invite.spec.js` | **NEW** — Playwright smoke for URL pre-fill + passcode input |
| `AGENTS.md` | **NEW** — operational rules (see "Passcode rules" + "Live lobby invariants") |
| `README.md` | feature row + multiplayer section updated |

## Manual smoke

```bash
# 1. start the dev server
npx convex dev
npx http-server -p 8000

# 2. open the host URL
open http://127.0.0.1:8000
# click HOST AGAINST FRIENDS → note the room code (e.g. ABC123) and passcode (e.g. EasterPig)

# 3. open the invite URL on a different browser profile
open "http://127.0.0.1:8000/?join=ABC123&passcode=EasterPig"
# join screen should pre-fill; both the host and the guest should see 2 players

# 4. try the wrong passcode
open "http://127.0.0.1:8000/?join=ABC123&passcode=WobblyOtter"
# server should reject with "Incorrect passcode"
```

## Backwards compatibility

Old rooms in the database (created before this feature) have no `passcode`
field. They keep working — `joinRoom` checks `if (room.passcode)` and only
enforces the passcode when one is set. New rooms always have a passcode.

The `passcode` column is `v.optional(v.string())` so it doesn't break the
schema for any existing rows. No migration needed.
