# AGENTS.md — ShapeKeeper

> Operational rules for any AI agent (or human) working in this repo.
> Skills conform to the live source, not the reverse. If a rule here
> contradicts what the code does, **update this file to match the code**,
> not the other way around — the code is the source of truth.

## What this is

A vanilla-JS browser implementation of **Dots and Boxes** ("ShapeKeeper") with
local hot-seat and online (Convex realtime) multiplayer. Hosted on Vercel.

## Stack

- **Frontend:** Vanilla JS (ES modules), no build step, no framework.
- **Backend:** Convex (`convex/`). `convex dev` for typecheck.
- **Tests:** Vitest (`**/*.test.js`, `**/*.spec.js`), Playwright (`tests/e2e/`).
- **Lint:** ESLint flat config (`eslint.config.mjs`).
- **Hosting:** Vercel static. Build = `echo "No build step required"`.

## Working agreements

### Repo boundaries

- **The canonical ShapeKeeper repo is `/home/leandi-duplessis/github/workspaces/ShapeKeeper`.**
  Do NOT create a sibling/duplicate elsewhere. Do NOT scaffold a new project.
- Edit in place. No `create-next-app`, `npx sv create`, `git clone` into a new dir.

### Tool-owned directories — read-only at execution time

- `convex/_generated/` — owned by `npx convex dev` / `npx convex codegen`.
  It PRUNES any file it didn't create. Don't hand-write here; run `npx convex
  dev --once` to regenerate. If a sidecar `convex dev` is running, kill it
  before any schema change and restart after.
- `**/.vercel/output/**` — owned by Vercel.
- `playwright-report/`, `test-results/` — Vitest/Playwright scratch (gitignored).

Before writing any file under these paths, run the sidecar probe:
```bash
ps -ef | grep -E "convex" | grep -v grep
```
If a live `convex dev` is running for a DIFFERENT project (e.g. J-pay), it
only watches that project's `_generated/`. ShapeKeeper's `_generated/` is
unaffected. If a ShapeKeeper sidecar is running, kill it first.

### Passcode rules (CRITICAL — product owner 2026-08-25)

- **Passcode = silly `[Adjective][Animal]` TitleCase.** Examples: `EasterPig`,
  `SillyRabbit`, `BubblyBunny`. No numbers, no separators, no human names, no
  real places.
- Word lists live in `convex/rooms/shared.ts` (`ADJECTIVES`, `ANIMALS`).
  Both lists must have **≥ 50 entries** and be all-lowercase ASCII.
- Generation: `generateSillyPasscode()`. Collision-checked at runtime against
  the live `by_passcode` index. Default list size = 50×50 = 2500 combos
  (~11 bits entropy); expand the lists, do NOT add numbers/letters, if the
  space saturates.
- **Passcode is NOT an env file, NOT a static secret, NOT a random-letter
  code.** Generated server-side per lobby, returned ONLY to the host on
  `createRoom`, and never re-exposed by query handlers.
- Tests: `convex/rooms/shared.test.js` enforces the format invariants
  (regex, word-list membership, no human-name word starts, ≥ 50 entries).
  If you add a word that breaks the invariants, the test will catch it
  BEFORE the linter does.

### Live lobby invariants

- The host must be able to see players join **in realtime** without a refresh.
  The `LiveLobbyManager` (online mode) is fed by the Convex subscription
  callback via `applySnapshot({ room, players })`.
- The `joinRoom` mutation accepts an optional lobby name. Default lobbies
  use the code `LOBBY` with no passcode required. Legacy rooms (no passcode)
  still allow code-only joining.
- The invite link is `${origin}/?join=${roomCode}`.
  Build it via `LiveLobbyManager.buildInviteUrl()`, never by hand in the
  click handler.
- URL pre-fill: `getJoinParamsFromUrl(search)` parses `?join=`.
  `welcome.js` calls it on boot and routes the user to the join screen.
  This is the **only** supported way to deep-link into the join flow.

### Lava Timer (FR-1 / FR-2 / FR-3)

- Timer is configurable **Off/10/15/30/60 s, default 15 s**, one setting in local setup and the online lobby.
- Local engine `src/timing/local-turn-timer.js` ticks from `animate()`.
- Online enforcement is server-side (`convex/games/turnTimer.ts`, scheduled `expireTurn`).
- Clock resets after every move; expiry draws a random line on behalf of the current player.
- Local clock pauses when tab hidden and during AI turns.
- `FEATURE_LAVA_TIMER` default `false` in `constants.js`, enabled at runtime by `config.js`.
- `handleTurnExpiration()` handles auto-move on expiration.
- Timing constants live in `constants.js` (`TIMING_CONSTANTS`).
- The turn clock controller is at `src/timing/turn-clock-controller.js`.

### Levels invariants

- Max level = 100.
- Level 1 starts with 3x3 grid and 1 colorful sprite in the background.
- Grid tiers: Levels 1..25 (scales 3x3 up to 7x5), Levels 26..50 (6x8), Levels 51..89 (8x8), Levels 90..99 (10x10), Level 100 (10x15).
- Turn timer: 7s base + 2s per completed level, capped at 30s.
- **Donation edition (2026-10-25): all 100 levels are open.** `LevelsProgress.isLevelUnlocked()` returns true for 1..100; winning still records completion and awards a sprite, but `unlockedLevel` no longer gates entry. Keep the progress counters for stats and the Level 100 easter egg.
- The optional donation prompt appears at most once per 5 completed levels, is dismissible, never blocks play, and must not grant donor-only perks or cosmetics.
- Lose a level (defeat or tie): -1 sprite (floored at 1).
- Beating level 100 unlocks the fireworks sparkle easter egg permanently.
- Missed turn on timer expiry: a random free line is drawn on the player's behalf across local hot-seat, Levels mode, and online multiplayer.

### Mine/penalty invariants (2026-10-30)

- A **mine** is a hidden box that cuts the claiming player's score to **20% (−80%)** once.
- **No mines before level 15.** Level 15 opens with **2** mines; the count **doubles every 10 levels** (2, 4, 8, 16, …).
- Density is capped at `MAX_MINE_DENSITY = 0.25` of the board (`effect-system/mines.js`) so late boards never become all mines. Tune that one constant, not the doubling math.
- Mines are **invisible until triggered**. Once triggered the box keeps a **💣** marker for the rest of the level (plus a small `×0.2`), the level start shows a `💣 N hidden mines` toast, the footer chip (`#mineCounter`) counts the hidden mines left, and every Levels button shows its board's mine count (`N×M · 💣 K`). The marker and chip are the teaching signal — players must not read a penalty as their own mistake.
- Mines are a **Levels-mode** feature. Casual local hot-seat and online multiplayer build the game at the default level (1) and therefore seed zero mines; online keeps its server-side multiplier table as the single source of truth.
- Regression gates: `tests/mine-placement.test.js` (policy, placement, chip count, rendering), `effect-system.test.js` (seeding), `tests/penalty-box-animation.test.js` (the 0.2× path still fires), `tests/e2e/mines.spec.js` (grid badges, level-14 silence, level-15 toast + chip + fired box).

### Agent ↔ owner collaboration protocol

The product owner reads status on a phone. Keep the channel quiet and the evidence in the repo.

- **One short status line per milestone.** No raw command output, diffs, stack traces, or file dumps pasted into chat — those go to `docs/plans/YYYY-MM-DD-<work>-evidence.md`.
- **Cite a handle, not a feeling:** test name, commit SHA, file path, or deploy URL. "Done" without a handle is not done.
- **Batch questions.** Ask everything needed in one message; do not drip-feed clarification requests.
- **Ask before anything that leaves the machine** (push, deploy, email, public post). Local edits, tests, and docs do not need a check-in.
- **Never re-paste the plan.** Write it to `docs/plans/`, then report the path and the 3-line summary.

### Background sprite invariants

- The floating background sprites live in `src/ui/WelcomeAnimation.js`; their
  ink lives in `src/ui/sprite-palette.js` and their motion history in
  `src/ui/sprite-trail.js`. Do not inline either back into the animation class.
- **A sprite may never paint a line across the canvas.** Any teleport (edge
  wrap, grab-drag, resize) must `trail.clear()`, and `drawTrails()` only strokes
  `SpriteTrail.forEachRun()`, which splits on any segment longer than
  `TRAIL_MAX_SEGMENT` (160 px). Regression gate:
  `tests/welcome-animation-trail-lines.test.js`.
- **The ink is a full spectrum, not a cyan wash.** Every hue band (red, orange,
  amber, green, cyan, blue, purple, magenta, pink) must be present in both
  themes, every ink HSL-saturated >= 60%, and every ink >= 3:1 non-text contrast
  against its theme backdrop (WCAG 1.4.11). Regression gate:
  `tests/cosmic-identity.test.js` -> "sprite ink covers the full spectrum".
- **No gridlines, anywhere.** The board substrate is a nebula wash only —
  `drawDynamicBackground()` must not stroke full-span straight lines (the 40 px
  canvas grid was removed on 2026-10-24; the CSS sheet of grid lines was removed
  earlier).

### Convex naming rule

- Files under `convex/` must match `[A-Za-z0-9_.]` (no hyphens); use camelCase. Enforced by `tests/convex-module-hygiene.test.js`.

### Live API rule

- `convex/games.ts` must register every handler it imports; enforced by `convex/wiring.test.ts`.

### Code style

- ES modules everywhere. `'use strict'` at the top of IIFE scripts in
  `convex-client/` and `src/ui/` (legacy pattern; new code uses ESM).
- TypeScript for `convex/**/*.ts` (strict mode, see `convex/tsconfig.json`).
- Vanilla JS for everything outside `convex/`.
- No `any` in new Convex code. Existing `any` in handler args is tolerated
  for now; tighten when refactoring.

### Quality gates (run in this order before pushing)

```bash
npm run lint                       # eslint .
npx convex typecheck               # tsc --noEmit on the convex/ project
npx vitest run                     # all *.test.js + *.spec.js (NOT tests/e2e)
npm run build                      # echo no-op; kept for CI parity
npm run test:e2e:smoke             # Playwright smoke (chromium)
```

CI runs the same gates plus a multi-browser compatibility pass. Don't push
without lint + typecheck + unit + smoke green.

### Convex schema changes

- Always update `convex/schema.ts` first.
- Run `npx convex dev --once` (NOT `dev`) to regenerate `_generated/`.
- The `passcode` column is `v.optional(v.string())` to keep legacy rooms
  valid. If you add a required field, write a migration plan in
  `docs/plans/YYYY-MM-DD-…` first.

### Conventional commits

```
feat(lobby): …
fix(join): …
docs(lobby): …
chore(deps): …
test(lobby): …
```

Scope to the area you touched. Body explains WHY, not WHAT (the diff shows
WHAT). One concern per commit; do not mix a refactor with a feature.

## Pitfalls (dated)

- **2026-08-25 — passcode-vs-env confusion.** Earlier draft proposals tried
  to use a static passcode from env or a per-process secret. The product
  owner explicitly rejected this: "use random generate names as passcodes not
  random letters, its not a fucking env file!" Passcode is per-lobby, server
  generated, never persisted outside the `rooms` table.
- **2026-08-25 — passcode-number drift.** First-pass implementation included
  a numeric suffix for collision resistance. The owner rejected it: "No
  numbers." Pure word combos, period.
- **2026-08-25 — human-name pitfall.** "Bobcat" + "Cosmic" reads as
  "CosmicBobcat" → contains "Bob" as a word start. Removed "bobcat" from the
  animal list to satisfy the "no human names" intent without sacrificing
  the whimsy of the format.
- **Pre-2026-08-25 — lobby placeholder.** The legacy `LobbyManager` is
  described in its own header as "a UI placeholder. Real multiplayer requires
  backend integration (Convex/Firebase/etc.)". The new `LiveLobbyManager`
  supersedes it for online mode; the legacy class is kept for the no-backend
  fallback (no Convex deployment available).
- **Pre-2026-08-25 — Convex sidecar ownership.** A live `npx convex dev`
  regenerates `convex/_generated/` on every change and **prunes any file it
  didn't create**. Hand-editing files there is a guaranteed loss; use
  `npx convex dev --once` and let it own that directory.
