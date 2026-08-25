# Opponent-Tap Mechanic

> Added 2026-08-25. Multiplayer-only hand-eye coordination layer: opponents
> can TAP each other's completed boxes to reduce the effective multiplier
> from the raw value (typically **2x**) down to **0.5x** before the owner
> reveals. The owner races to reveal; the opponents race to tap.

## Why

Dots-and-Boxes on the multiplayer side is turn-based and slow: you draw one
line, hand the turn to the opponent, wait. This adds a real-time skill layer
on TOP of the turn-based game: as soon as a square is completed, both
players' hands are now on the canvas. The owner's instinct is to **reveal
fast** (to lock in 2x). The opponent's instinct is to **tap fast** (to drop
it to 0.5x). The faster reflexes win.

The mechanic is intentionally lightweight — a single tap on the box, no
button, no menu. Just touch the box. That's what makes it hand-eye
coordination: there's no time to think, only to act.

## Rules

1. **Multiplayer only.** Local hot-seat (no Convex backend) supports the
   mechanic too, but the visual race is meaningless when both players share
   an input device.
2. **The owner CANNOT tap their own box.** Owners tap their own boxes via the
   existing `revealMultiplier` path. Server rejects self-taps with
   `error: 'You cannot tap your own square'`.
3. **Revealed boxes cannot be tapped.** Tapping a revealed square is a no-op.
4. **The first tap collapses any non-truthOrDare multiplier to 0.5x.**
   Subsequent taps are idempotent (still 0.5x). Tapping does NOT halve each
   time — the design says "collapse, not halve" so the rule is easy to teach.
5. **`truthOrDare` squares are immune.** The tap mutation returns
   `error: 'Truth-or-dare squares cannot be tapped'`. Tapping them has no
   effect.
6. **The room must be in `playing` state.** Tapping during the lobby or
   after the game is finished returns `error: 'Game is not in progress'`.

## Score impact

The owner reveals and scores `(effectiveMultiplier - 1)`:

| Raw multiplier | Tapped? | Effective at reveal | Score delta |
|---|---|---|---|
| 2x | no | 2x | +1 |
| 2x | yes | 0.5x | **-0.5** |
| 3x | no | 3x | +2 |
| 3x | yes | 0.5x | -0.5 |
| 5x | no | 5x | +4 |
| 5x | yes | 0.5x | -0.5 |
| 10x | yes | 0.5x | -0.5 |
| truthOrDare | n/a | unchanged | n/a (different mechanic) |

A successful tap "steals" up to 1.5 points from the owner (2x → 0.5x is the
worst case). For higher multipliers the steal is larger. The opponent does
NOT gain points directly — the score flows from the owner's reveal, and the
tap reduces that flow.

## Schema

`convex/schema.ts → squares` gains two new optional columns:

```ts
taps: v.optional(v.number()),                          // count of opponent taps
effectiveMultiplier: v.optional({                      // post-tap value, cached
    type: v.union(v.literal('multiplier'), v.literal('truthOrDare')),
    value: v.optional(v.number()),
}),
```

Old rooms (rows pre-dating this feature) default to `taps = 0` and
`effectiveMultiplier = multiplier`. The reveal handler reads
`effectiveMultiplier ?? multiplier` so legacy rows keep working.

## Server flow

`tapSquare(roomId, sessionId, squareKey)`:

1. Look up the room. Reject if not `playing`.
2. Look up the square by `(roomId, squareKey)`. Reject if not found.
3. Look up the owner. Reject if `owner.sessionId === sessionId`.
4. Reject if `square.multiplier.type === 'truthOrDare'`.
5. Compute `nextTaps = (square.taps ?? 0) + 1`.
6. Compute `nextEffective = computeEffectiveMultiplier(square.multiplier, nextTaps)`.
7. Patch the row: `{ taps: nextTaps, effectiveMultiplier: nextEffective }`.
8. Return `{ success: true, squareKey, taps, effectiveMultiplier: nextEffective }`.

`computeEffectiveMultiplier(multiplier, taps)` is a pure function in
`convex/games/state.ts` — see `convex/games/state.test.ts` for the 9
invariants.

`revealMultiplier(roomId, sessionId, squareKey)` was updated to read
`square.effectiveMultiplier ?? square.multiplier` so the score reflects the
post-tap state.

## Client flow

`pointer-controls.js` already had a placeholder for opponent clicks (lines
41-45 / 156-163) — it just consumed the click without doing anything. The
mechanic fills in the placeholder:

```js
if (handler.game.isMultiplayer) {
    const isSquareOwner = ...;
    if (!isSquareOwner) {
        handler.game.tapSquare(clickedCell);   // ← new
        return true;
    }
}
```

`game.tapSquare(squareKey)` is the public API; in online mode it fires the
Convex mutation. In local hot-seat it applies the 2x→0.5x collapse
directly to local state (so the user can experiment offline).

`syncHandlers.js` was extended: when a NEW tap arrives on an already-known
square (i.e. the local cache has the square but `squareTaps` is stale), the
local `effectiveMultiplier` is refreshed and the `squareTaps` counter is
updated. No re-animation — taps should feel snappy.

## Visual feedback

`renderer/board.js` draws a small red ✋ in the top-right of any square
where `squareTaps[key] > 0` AND the square has not been revealed. The
indicator is a public signal — both players see it, the owner knows
they've been hit, the tapper sees their strike land. The indicator
disappears as soon as the owner reveals (the multiplier animation takes
over).

## Manual smoke

```bash
# 1. Start the dev backend + frontend
npx convex dev
npx http-server -p 8000

# 2. Browser A: HOST AGAINST FRIENDS
# 3. Browser B: paste the invite link, JOIN
# 4. Both ready, host starts the game
# 5. Host draws the 4th line of a small box, completing it.
# 6. Both see the new box appear.
# 7. GUEST: tap the box. Host should see a ✋ pop in the top-right.
# 8. HOST: tap your own box to reveal. The score update is +1 (untapped 2x)
#    OR -0.5 (if the guest tapped before the reveal).
```

## Files touched

| File | Change |
|---|---|
| `convex/schema.ts` | + `taps`, + `effectiveMultiplier` on `squares` |
| `convex/games.ts` | + `tapSquare` mutation |
| `convex/games/state.ts` | + `computeEffectiveMultiplier` (pure), + `tapSquareHandler`, `revealMultiplierHandler` now reads `effectiveMultiplier` |
| `convex/games/squares.ts` | initialises `effectiveMultiplier = multiplier`, `taps = 0` on creation |
| `convex/games/state.test.ts` | **NEW** — 9 invariants on `computeEffectiveMultiplier` |
| `convex-client/game-operations.js` | + `tapSquare(squareKey)` |
| `convex-client.js` | exposes `tapSquare` on the public API |
| `effect-system.js` | re-export of `tapSquare`; `game.tapSquare(key)` |
| `effect-system/gameplay.js` | + `tapSquare(system, squareKey)` (online → Convex; offline → local) |
| `input-handler/pointer-controls.js` | fills the placeholder in both mouse and touch paths |
| `src/ui/menu/syncHandlers.js` | handles the "new tap on known square" case |
| `game-state.js` | initialises `game.squareTaps = {}` |
| `renderer/board.js` | + red ✋ overlay when `squareTaps[key] > 0` and not yet revealed |
| `tests/e2e/opponent-tap.spec.js` | **NEW** — 2 E2E specs (tap + owner-rejected) |
| `tests/e2e/helpers/bootstrap-shared-multiplayer.js` | + `tapSquare` mock matching the server validation |
| `vitest.config.mjs` | now picks up `*.test.ts` |
| `AGENTS.md` | "Opponent tap" section added to live-lobby invariants |
| `README.md` | feature row added |

## Out of scope (deliberately)

- **No penalty for the owner if they DON'T reveal fast.** If the owner
  never reveals, the square sits there with the (post-tap) effective
  multiplier forever. The owner's only loss is the 1 base point they were
  going to score on reveal. The game is fair — no time pressure, no
  punishment, just an opportunity to score more.
- **No "steal-back" tap.** Once a square is at 0.5x, it stays. Tapping
  again is idempotent. The cap-at-0.5x design keeps the mechanic simple.
- **No anti-spam rate limit on the server.** The handler is cheap and
  per-square; the client should respect the existing
  `pointerInteractionThrottleMs` (50ms). Server-side rate limiting is
  noted in AGENTS.md as a future TODO if abuse becomes an issue.
