# AGENTS.md — ShapeKeeper

> Operational rules for any AI agent (or human) working in this repo.
> Skills conform to the live source, not the reverse. If a rule here
> contradicts what the code does, **update this file to match the code**,
> not the other way around — the code is the source of truth.

## What this is

A vanilla-JS browser implementation of **Dots and Boxes** ("ShapeKeeper") with
local hot-seat and online (Convex realtime) multiplayer. Hosted on Vercel.
Adult-friendly party mode with tile effects.

## Stack

- **Frontend:** Vanilla JS (ES modules), no build step, no framework.
- **Backend:** Convex (`convex/`). `convex dev` for typecheck.
- **Tests:** Vitest (`**/*.test.js`, `**/*.spec.js`), Playwright (`tests/e2e/`).
- **Lint:** ESLint flat config (`eslint.config.mjs`).
- **Hosting:** Vercel static. Build = `echo "No build step required"`.

## Working agreements

### Repo boundaries

- **The canonical ShapeKeeper repo is `/home/ewaldt/Documents/VS/GAMES/ShapeKeeper`.**
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

- The lava timer renders for **all game modes** (local and online), not
  just online matches. The `isOnline` gate was removed from `renderer.js`.
- Feature flag `FEATURE_LAVA_TIMER` (default OFF) controls rendering.
  Enable at runtime via `window.FEATURE_LAVA_TIMER`.
- `handleTurnExpiration()` in `dots-and-boxes-game.js` handles the
  local lava timer house rule: when a player's turn expires, the turn
  advances to the next player.
- Timing constants live in `constants.js` (`TIMING_CONSTANTS`).
- The turn clock controller is at `src/timing/turn-clock-controller.js`.

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
