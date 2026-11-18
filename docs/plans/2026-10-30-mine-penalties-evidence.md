# Evidence — mine penalties (2026-10-30)

Every command below ran in `/home/leandi-duplessis/github/workspaces/ShapeKeeper` on
the working tree that was pushed to `main`.

## Quality gates

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0, no findings |
| Convex types | `npx convex typecheck` | `✔ Typecheck passed` |
| Unit | `npx vitest run` | **86 files, 622 tests passed** (27.5 s) |
| Build | `npm run build` | `No build step required` (expected) |
| Smoke e2e | `npm run test:e2e:smoke` | `1 passed` — boots to main menu without page errors |

Targeted run before the full suite: `tests/mine-placement.test.js`,
`effect-system.test.js`, `tests/penalty-box-animation.test.js`,
`dots-and-boxes-game.test.js` → 4 files, 32 tests passed.

## Live browser verification (local server, Chromium)

Served with `python3 -m http.server 8123`, localStorage progressed to
`unlockedLevel: 100, entitled: true`.

1. **Level 15 start**
   - Toast text: `💣 2 hidden mines on this board — a mined box cuts your score to 20%.`
   - Captured instance: `mineCount = 2`
   - Seed sample: `{"2,1":{"type":"multiplier","value":0.2,"isMine":true},"1,1":{...}}`
   - No marker is visible on the board before a mine fires.
2. **Triggered mine (box `1,1`)**
   - Scores: `{"1":0,"2":0}` → `{"1":0,"2":0.2}` (claim +1, then ×0.2)
   - `revealedMultipliers`: `["1,1"]`
   - Penalty stamp text: `💣 −80%`
   - Speech bubble: `💣` avatar + `Boxed! Your score just shrank.`
   - 6× zoom of the claimed box: bomb glyph bottom-left, `×0.2` top-right,
     player number `2` centred — the permanent marker survives the animation.
3. **Renderer harness** importing `/renderer/board.js` directly onto a scratch
   canvas: the fired-mine branch draws `💣` and `×0.2`; an unrevealed mine draws
   neither.

## Production verification

- Push: `e84a0b5..9cba478 main -> main`; local `HEAD` and `origin/main` both
  `9cba4789e0a9874b6292494492b0b2919e5cd0b8`.
- Vercel deployment `dpl_7zft9ZFR828nj3LAmttTruxpHKeq`: `state READY`,
  `target production`, `githubCommitSha 9cba478…`, aliased to
  `shape-keeper.vercel.app`.
- `curl https://shape-keeper.vercel.app/effect-system/mines.js` → 200 and
  contains `FIRST_MINE_LEVEL` / `MAX_MINE_COUNT`; `renderer/board.js` contains
  `💣`; `dots-and-boxes-game.js` contains `announceMineBoard`.
- Live Chromium on production: level 15 start toast reads
  `💣 2 hidden mines on this board — a mined box cuts your score to 20%.`,
  `mineCount = 2`, triggering the first seeded mine (box `3,1`) put it in
  `revealedMultipliers` and showed the `💣 That was a mine, not a prize!` bubble.

## Second-pass verification (chip + grid badges + e2e)

- `npm run lint` → clean.
- `npx vitest run` → **86 files, 624 tests passed**.
- `npx playwright test tests/e2e/mines.spec.js --project=chromium` → **3 passed**:
  grid badge only at 15+, level 14 silent, level 15 toast + chip + real
  move-loop mine claim (`💣 −80%`, chip `1 hidden`).
- Browser check at 1280×577: level cards read `5×5` (14) → `5×5 · 💣 2` (15) →
  `7×5 · 💣 4` (25); footer chip `2 hidden` before the first hit, `1 hidden`
  after, `aria-label` "2 hidden mines left on this board", no overlap with the
  turn indicator.
- Phone check (390×844, level 100, 38 px boxes): before the fix the bomb
  overlapped the owner number; mine boxes now draw a smaller owner number in both
  passes and a 10 px bomb tucked into the lower-left, confirmed at 6× zoom with
  no glyph collisions.

## Files

- `effect-system/mines.js` (new) — policy + placement + `isMineMultiplier`
- `effect-system/init.js` — level-gated seeding, `game.mineCount`
- `dots-and-boxes-game.js` — mine branch, level-start toast, mine wording
- `renderer/board.js` — permanent 💣 marker
- `src/ui/TurnNoticeBubble.js` — 💣 avatar for player penalties
- `tests/mine-placement.test.js` (new), `effect-system.test.js` (updated)
- `AGENTS.md` — mine invariants, collaboration protocol
- `docs/plans/2026-10-30-mine-penalties.md` — the plan
