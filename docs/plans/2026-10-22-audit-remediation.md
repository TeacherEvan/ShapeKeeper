# Implementation Plan: Audit Remediation & Invariant Enforcement

## Goal Description
Implement the 3 core architectural and security recommendations identified in the surgical audit of ShapeKeeper (`8b8d3635`), plus restore the critical repository invariant for passcode generation:

1. **Passcode Confidentiality & Collision Checking (CRITICAL AGENTS.md Invariant):**
   - **Stop Passcode Leakage:** Remove `passcode` from `projectRoomForClient` in `convex/auth/token.js`. `passcode` must be returned ONLY to the host upon `createRoom` and never re-exposed by query handlers (`getRoom`, `getRoomByCode`, `getGameState`).
   - **Enforce `by_passcode` Collision Checking:** As mandated by `AGENTS.md:L53-L56`, silly passcode generation must be collision-checked at runtime against the live `by_passcode` index in `createRoom.ts` (currently missing; `passcode = generateSillyPasscode()` runs once without querying `by_passcode`).
   - **Client Handoff:** In `src/ui/menu/lobbyEvents.js`, deliver the passcode returned by `createRoom` to `lobbyManager.setIdentity({ passcode })`, and stop reading `room.passcode` in `LiveLobbyManager.applySnapshot()`.
2. **Public API Hardening & Dead Pipeline Deletion:**
   - Prune unauthenticated, unvalidated shadow mutation `mutations/drawLine.ts` along with unused companion service files (`lineValidator`, `lineApplier`, `lineResolver`, `triangleDetection`, `rooms/mutations.ts`, `rooms/queries.ts`) and their test files.
   - Restrict `sweepAllTurnDeadlines` from a public `mutation` to an `internalMutation`, and update `convex/crons.ts` to reference it via `internal`.
   - Add a contract test `tests/public-api-surface.test.js` asserting zero undeclared public endpoints.
3. **Turn-Timer Authority & Expiry Engine Unification:**
   - Enforce `ALLOWED_TURN_DURATIONS_MS` (0, 10s, 15s, 30s, 60s) in `updateTurnDuration.ts`, rejecting invalid values rather than silently defaulting to 0 / untimed.
   - Standardize game initialization in `startGame.ts` to always route turn arming through `armTurnTimer`.
   - Unify deadline enforcement: when a turn expires, trigger `expireTurnHandler` (`internal.games.expireTurn`), ensuring the authoritative random auto-line move is placed and a fresh turn is scheduled rather than racing with an un-scheduled skip loop.
4. **Test Suite Hygiene:**
   - Resolve shared test mock isolation in `tests/timeout-auto-move.test.js` where `Math.random` spying polluted `effectSystem.initializeMultipliers()`.

---

## User Review Required

> [!IMPORTANT]
> **Passcode Generation Collision Check (`by_passcode` index):**
> In `AGENTS.md`: *"Generation: `generateSillyPasscode()`. Collision-checked at runtime against the live `by_passcode` index."*
> `convex/schema.ts` defines `.index('by_passcode', ['passcode'])` on `rooms`. In `convex/mutations/createRoom.ts`, a collision loop currently exists for `roomCode` with `by_code`, but `generateSillyPasscode()` was called directly without querying `by_passcode`. We will add the collision loop for `passcode` using `by_passcode` before inserting the room document.

> [!IMPORTANT]
> **Convex Code Generation & Pruning:**
> Removing `convex/mutations/drawLine.ts` and related service modules requires running `npx convex dev --once` to regenerate `convex/_generated/api.d.ts`. As documented in `AGENTS.md`, any running sidecar `convex dev` process will be verified as dead before and restarted if necessary.

---

## Proposed Changes

### Component 1: Passcode Invariant & Secrecy (Recommendation 1 + AGENTS.md Invariant)

#### [MODIFY] `convex/mutations/createRoom.ts`
- Implement runtime collision checking against the `by_passcode` index for `generateSillyPasscode()`:
```ts
// Generate silly passcode [Adjective][Animal] with live by_passcode collision check
let passcode = generateSillyPasscode();
let existingPasscodeRoom = await ctx.db
  .query('rooms')
  .withIndex('by_passcode', (q: any) => q.eq('passcode', passcode))
  .first();

let passcodeCollisions = 0;
while (existingPasscodeRoom && passcodeCollisions < 10) {
  passcodeCollisions++;
  passcode = generateSillyPasscode();
  existingPasscodeRoom = await ctx.db
    .query('rooms')
    .withIndex('by_passcode', (q: any) => q.eq('passcode', passcode))
    .first();
}
```

#### [MODIFY] `convex/auth/token.js`
- Strip `passcode` from `projectRoomForClient` unconditionally alongside `hostTokenHash` and `hostPlayerId`.
```js
export function projectRoomForClient(room, requestingSessionId) {
    if (!room) return null;
    const projection = { ...room };
    const isHost =
        typeof requestingSessionId === 'string' &&
        requestingSessionId.length > 0 &&
        room.hostPlayerId === requestingSessionId;
    delete projection.hostTokenHash;
    delete projection.hostPlayerId;
    delete projection.passcode;
    projection.isHost = isHost;
    return projection;
}
```

#### [MODIFY] `src/ui/LiveLobbyManager.js`
- In `applySnapshot`, remove fallback `this.passcode = room.passcode ?? this.passcode;`.

#### [MODIFY] `src/ui/menu/lobbyEvents.js`
- When the host creates a lobby via `window.ShapeKeeperConvex.createRoom`, store the returned `result.passcode`:
```js
if (result.passcode) {
    lobbyManager.setIdentity({ passcode: result.passcode });
}
```

#### [MODIFY] `tests/auth-token.test.js` & `convex/queries/roomQueries.test.ts`
- Assert that `passcode` is never returned in `projectRoomForClient`, `getRoom`, `getRoomByCode`, or `getGameState`.

#### [MODIFY] `convex/mutations/joinRoom.test.ts`
- Add tests for missing/incorrect/correct passcode on `joinRoom`.

---

### Component 2: Public API Hardening & Dead Pipeline Removal (Recommendation 2)

#### [DELETE] Unused Shadow Mutation Pipeline
- `convex/mutations/drawLine.ts`
- `convex/mutations/drawLine.expiry.test.ts`
- `convex/services/lineValidator.ts`
- `convex/services/lineValidator.test.ts`
- `convex/services/lineApplier.ts`
- `convex/services/lineApplier.test.ts`
- `convex/services/lineResolver.ts`
- `convex/services/lineResolver.test.ts`
- `convex/services/triangleDetection.ts`
- `convex/services/triangleDetection.test.ts`
- `convex/rooms/mutations.ts`
- `convex/rooms/queries.ts`

#### [MODIFY] `convex/mutations/sweepAllTurnDeadlines.ts`
- Switch from `export const sweepAllTurnDeadlines = mutation({...})` to `export const sweepAllTurnDeadlines = internalMutation({...})`.

#### [MODIFY] `convex/crons.ts`
- Update cron registration to reference `internal.mutations.sweepAllTurnDeadlines.sweepAllTurnDeadlines`.

#### [NEW] `tests/public-api-surface.test.js`
- Add contract test scanning `convex/_generated/api.d.ts` to ensure only authorized endpoints (`rooms:*`, `games:*`) are exposed as public mutations/queries.

---

### Component 3: Single Authoritative Turn Timer & Expiry Engine (Recommendation 3)

#### [MODIFY] `convex/mutations/updateTurnDuration.ts`
- Validate that the requested duration matches `ALLOWED_TURN_DURATIONS_MS` (0, 10s, 15s, 30s, 60s).
- Reject unsupported custom durations (e.g. 20s) with an informative error.
- Store normalized values consistently across both `turnDurationMs` and `turnDurationSeconds`.

#### [MODIFY] `convex/mutations/startGame.ts`
- Standardize game initialization to always route turn arming through `armTurnTimer` in `convex/games/turnTimer.ts`.

#### [MODIFY] `convex/mutations/sweepAllTurnDeadlines.ts` & `convex/mutations/sweepTurnDeadline.ts`
- Refactor the scheduled deadline sweep to avoid competing skip logic:
  - If a room's `turnEndTime` has expired, schedule or invoke `expireTurnHandler` (`internal.games.expireTurn`), ensuring the authoritative random auto-line is placed and a fresh turn is scheduled.
  - Delete `convex/services/turnDeadlineEnforcer.ts`.

#### [MODIFY] `tests/turn-duration.test.js` & `convex/mutations/updateTurnDuration.test.ts`
- Update unit tests to reflect the strict duration options and verify rejection of invalid durations.

---

### Component 4: Test Suite Isolation Fix

#### [MODIFY] `tests/timeout-auto-move.test.js`
- In `tests/timeout-auto-move.test.js`, ensure `game.squareMultipliers = {};` is explicitly set in tests creating custom boards, preventing interaction between mocked `Math.random` and `initializeMultipliers()`.
- Add `vi.restoreAllMocks()` in `afterEach`.

---

## Verification Plan

### Automated Tests
Execute the project verification gates in sequence as mandated by `AGENTS.md`:

```bash
# 1. Lint check
npm run lint

# 2. Convex TypeScript compilation
npx convex typecheck

# 3. Unit test suite
npx vitest run

# 4. Build sanity check
npm run build

# 5. Playwright smoke tests
npm run test:e2e:smoke
```

### Manual Verification
1. Host creates lobby: confirm `by_passcode` collision check succeeds and silly passcode (e.g. `EasterPig`) is issued.
2. Query `getRoom` or inspect network traffic for `getRoomByCode`: confirm `passcode` is `undefined`.
3. Try joining a room with a mismatched passcode: confirm join fails with user-friendly error.
4. Host selects turn duration: confirm server validates against `ALLOWED_TURN_DURATIONS_MS`.
5. Online turn timeout: verify authoritative random auto-line move is placed and turn advances.
