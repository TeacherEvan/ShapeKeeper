# ShapeKeeper — Plastic Surgery v4 (Signature Moments Pass)

**Date:** 2026-11-27 · **Baseline:** `main` @ `97edc55` + v3 local edits · **Static lint:** 100/100

## Phase 0 — Alignment (already proven)

Hybrid (touch + pointer), commercial (checkout/donate), all audiences. Same locked contracts as v3: IDs, tokens, wordmark, nebula-only substrate, trail invariants, timers, Convex.

## Why v3 was not enough

New live captures (`/tmp/opencode/shots/deep-*.png`) exposed the moments players actually remember:

| # | Surface | Evidence | Defect |
| :-- | :--- | :--- | :--- |
| E1 | Winner | `styles/winner.css:168-173` + `deep-winner-dark.png` | Winner row uses legacy `#ffd700` border and a gold-on-slate gradient that renders as **olive/mud** in Void theme; scores lack `tabular-nums`; card has no signature top rule; buttons lack detent. |
| E2 | Winner | `ui-manager/celebrations.js:241-287` + `deep-winner-*.png` | 150 flat `fillRect` confetti chips in pastel OS-ish colours — reads as confetti debugging, not celebration. |
| E3 | Board | `renderer/board.js:96-115` + `deep-game-*.png` | Lines have a 0.22 halo but no specular core, so they read as flat 4 px strokes; claimed tiles have no inner sheen. |
| E4 | Game background | `src/ui/WelcomeAnimation.js:928` + `deep-game-*.png` | `isDimmed` keeps sprites at alpha `0.25`, so the single collected sprite shows as a stray coloured pixel on the board. `AGENTS.md` scopes the sprite playground to home + side screens, not gameplay. |
| E5 | Side playground | `deep-side-left/right.png` | Intentionally empty interactive canvas — **no change** (sprite playground by design). |

## Techniques (popular 2026 craft)

1. **Signature moment hierarchy** — theme-aware amber victory ribbon, tabular numerals, specular card edge, tonal score rows (Linear/Raycast surface discipline).
2. **Celebration geometry** — mixed streamer / circle / diamond confetti with additive-friendly saturated ink, still capped at 150 pieces and 5 s.
3. **Jewel linework** — three-pass canvas stroke (halo → core → hairline specular) with round caps; no `shadowBlur` loop.
4. **Focus discipline** — remove gameplay noise instead of adding more decoration.

## Change set (all visual-only)

- `styles/winner.css` — E1: amber ribbon + trophy-safe score rows + tactile buttons, both themes.
- `ui-manager/celebrations.js` — E2: multi-shape confetti, no DOM/ID/timing changes.
- `renderer/board.js` — E3: specular core pass on drawn/animated lines and tile sheen.
- `src/ui/WelcomeAnimation.js` — E4: zero-alpha sprites on the game canvas.

## Verification

`preflight_visual_lint.py --fail-on high --strict`, `npm run lint`, `npx convex typecheck`, `npx vitest run`, `npm run build`, `npm run test:e2e:smoke`, plus re-capture of `deep-game-*`, `deep-winner-*` at `1280×800` in both themes and `390×844` mobile.
