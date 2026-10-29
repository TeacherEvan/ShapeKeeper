# Mine penalties — level-gated, invisible, marked after they fire

**Date:** 2026-10-30 · **Owner:** Lea (product) / Fenrie (build) · **Status:** implementing

## The problem

Penalty boxes (the secret 0.2× squares) are seeded on **every** board, in **every**
mode, at **20% density**. Players read the penalty as their own mistake — "I did
something wrong" — instead of understanding the box was mined before they claimed
it. Nothing on the board tells them a mine exists, and nothing marks the box after
it fires, so the same confusion repeats every level.

## Product decisions (owner, 2026-10-30)

1. **A triggered box keeps a 💣 marker for the rest of the level.** The marker is
   the teaching signal: "that box was mined", not "you played badly".
2. **No mines before level 15.** Level 15 starts with **2** mines, placed at
   random, **invisible** until triggered.
3. **The count doubles every 10 levels but maxes out at 5 mines:** 2 → 4 → 5 (owner, later on 2026-10-30: “mines max out at 5”).
4. Chat collaboration stays quiet: no raw command output pasted into Telegram.
   Evidence lives in files; the owner gets short status lines.

## Mine count table (levels, with the boards they actually play on)

Board squares = (cols − 1) × (rows − 1) from `getGridSizeForLevel`.

| Levels | Board | Doubling rule | Cap | Shipped |
|---|---|---|---|---|
| 1–14 | 3×3 → 5×5 | 0 | — | 0 |
| 15–24 | 5×5 (16 boxes) | 2 | 5 | 2 |
| 25–34 | 7×5 (24 boxes) | 4 | 5 | 4 |
| 35–44 | 6×8 (35 boxes) | 8 | 5 | 5 |
| 45–100 | up to 10×15 (126 boxes) | 16 → 1024 | 5 | 5 |

**Why the cap:** unbounded doubling makes every box on the board a mine from
level 55 onward, which stops being a game; the owner settled it at **5 mines**
from level 35 up. `MAX_MINE_COUNT = 5` in `effect-system/mines.js` is the one
knob to turn.

## Scope

- Mines belong to **Levels mode**. Casual local hot-seat and online multiplayer
  construct the game with the default level (1), so they get zero mine squares.
  Online already has its own server-side multiplier table — the client-side 0.2×
  seed was a second, conflicting source of truth in that mode.
- Penalty effect itself is unchanged: the claiming player's score is multiplied by
  0.2 (−80%), once, at claim time.

## Second pass — making the rule legible for the whole level

The first pass marked the box and explained the rule once at level start. That
still left two gaps: the toast is gone in five seconds, and the level list gave
no warning before a mined board loaded.

- Footer chip `#mineCounter`: `2 hidden → 1 hidden → board clear`, `role=status`,
  `aria-live=polite`, refreshed on every UI pass so undo/redo cannot desync it.
- Levels grid: each button prints its board's mine count (`7×5 · 💣 4`), so the
  ramp is visible before entering.
- Toast copy now says the box "stays marked", naming the marker the player will
  see after the first hit.

## Implementation

| File | Change |
|---|---|
| `effect-system/mines.js` (new) | `FIRST_MINE_LEVEL`, `BASE_MINE_COUNT`, `MINE_LEVEL_STEP`, `MAX_MINE_COUNT`, `getMineCountForLevel(level, totalSquares)`, `placeMines(squareKeys, count, rng)`, `isMineMultiplier(data)`, `countHiddenMines(...)` — pure and deterministic under an injected RNG |
| `effect-system/init.js` | seed `mineCount` mines, tagged `{ type: 'multiplier', value: 0.2, isMine: true }`; set `game.mineCount`; no mines below level 15 |
| `dots-and-boxes-game.js` | mine-aware penalty branch; level-start toast; **footer chip that counts hidden mines down to "board clear"**; mine wording in the alert; stamp reads `💣 −80%` |
| `ui-manager.js` | refresh the chip on every UI pass so undo/redo/replay stay honest |
| `index.html` + `styles/game.css` | `#mineCounter` pill in the game footer (role=status, aria-live) |
| `src/ui/LevelsScreen.js` | every level button shows its board's mine count (`7×5 · 💣 4`) |
| `renderer/board.js` | revealed mine draws a 💣 at the bottom of the box plus a small `×0.2` in the corner |
| `src/ui/TurnNoticeBubble.js` | player penalty avatar becomes 💣 instead of 💥 |
| `AGENTS.md` + `README.md` | mine invariants, player-facing feature/version notes, collaboration protocol |

## Tests

- Add `MAX_MINE_COUNT = 5` to the tests' expectations: 2 (15–24), 4 (25–34), 5 (35+); no board ever seeds more than five.
- `effect-system.test.js` (updated): level 1 seeds nothing; level 15 seeds 2
  tagged mines; non-levels construction stays clean.
- `tests/e2e/mines.spec.js` (new): the Levels grid badge appears only at 15+;
  level 14 seeds nothing and hides the chip; level 15 shows the toast and the
  "2 hidden" chip, a real move-loop claim of a mined box flips the chip to
  "1 hidden" (or "board clear" if two fire), stamps `💣 −80%`, and leaves the
  `isMine` data the renderer needs.
- `tests/penalty-box-animation.test.js` unchanged and must stay green (the 0.2×
  path still fires the animation and bubble).

## Verification

`npm run lint` → `npx convex typecheck` → `npx vitest run` → `npm run build` →
`npm run test:e2e:smoke`, then push to `main` and confirm the Vercel deploy.

## Evidence

Recorded in `docs/plans/2026-10-30-mine-penalties-evidence.md` as each gate runs.
