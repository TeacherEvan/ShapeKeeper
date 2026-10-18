# ShapeKeeper Project Plan

> Central project plan for ShapeKeeper — a vanilla-JS browser implementation of
> Dots and Boxes with local hot-seat and online (Convex realtime) multiplayer.
> Hosted on Vercel.
>
> This plan consolidates direction and cross-references the detailed planning
> documents under `docs/planning/` and `docs/plans/`. It is the file referenced
> by `AGENTS.md` as `docs/project-plan.md (or equivalent)`.

## Stack

- Frontend: Vanilla JS (ES modules), no build step, no framework.
- Backend: Convex (`convex/`). `convex dev` for typecheck.
- Tests: Vitest (`**/*.test.js`, `**/*.spec.js`), Playwright (`tests/e2e/`).
- Lint: ESLint flat config (`eslint.config.mjs`).
- Hosting: Vercel static. Build = `echo "No build step required"`.

## Canonical Location

`/home/leandi-duplessis/github/workspaces/ShapeKeeper` — do not scaffold a
sibling/duplicate project. Edit in place.

## Related Planning Documents

| Document | Purpose | Status |
| --- | --- | --- |
| docs/planning/COMPETITION_PRODUCTION_ROADMAP.md | Competition go/no-go criteria; runtime contract | Active |
| docs/planning/JOBCARD.md | Session work tracking; phase completion snapshot | Active |
| docs/planning/MULTIPLAYER_PLANNING.md | Online multiplayer architecture | Background |
| docs/planning/REFACTORING_PLAN.md | ES6 module refactoring plan | Background |
| docs/planning/CounterPlan.md | Visual evolution roadmap | Complete |
| docs/plans/2026-10-13-concept-enhancements.md | Concept enhancements | Reference |
| docs/project-plan.md | This file — central plan + cross-references | Active |

## Current Feature State (v4.5.0)

- Core Dots and Boxes gameplay (squares-only; triangles removed in v4.3.0)
- Turn-based online multiplayer with Convex backend (ACID transactions)
- Open lobby browser — JOIN LOBBY lists open lobbies in realtime
- Silly passcode infra retained (`convex/rooms/shared.ts`, 50x50 word lists,
  unit-tested in `convex/rooms/shared.test.js`); the generator produces a
  TitleCase adjective-animal combo (for example "EasterPig"); new rooms carry
  no passcode, legacy rooms may still have one
- Allowed Time turn timer (Off/10/15/30/60s) in local hot-seat and online
- Rematch system (local instant, online consent-based)
- Opponent Tap mechanic (multiplayer)
- Accessibility: reduced motion, colour-blind-safe Okabe-Ito palette, 44px
  touch targets
- Provisional shutdowns: triangles and Party Mode temporarily disabled in the
  supported runtime path

## Documentation Conventions

- Conventional commits: feat(scope), fix(scope), docs(scope), etc.
- Convex files under `convex/` must match `[A-Za-z0-9_.]` (no hyphens),
  camelCase.
- `convex/games.ts` must register every handler it imports.
- `convex/_generated/` is owned by `npx convex dev` — never hand-edit.
- Passcode format: TitleCase adjective-animal combo, no numbers, word lists >=
  50 entries each, all-lowercase ASCII, no human names.

## Quality Gates (run before pushing)

1. npm run lint — eslint .
2. npx convex typecheck — tsc --noEmit on convex/
3. npx vitest run — all unit tests
4. npm run build — echo no-op
5. npm run test:e2e:smoke — Playwright smoke (chromium)

## Cross-References

- AGENTS.md — operational rules, passcode rules, live lobby invariants
- README.md — user-facing feature list, quick start, deployment, version history
- docs/README.md — documentation index (sibling of this file)
- docs/feature-multiplayer-lobby.md — open lobby browser flow + passcode rules
- docs/feature-opponent-tap.md — Opponent Tap mechanic
