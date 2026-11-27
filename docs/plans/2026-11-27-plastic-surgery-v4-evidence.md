# Plastic Surgery v4 — Signature Moments: Evidence

**Date:** 2026-11-27 · **Baseline:** `main` @ `97edc55` + v3 local edits · **Status:** local edits only — not committed, pushed, or deployed.

## 1. Live-defect fixes (file:line handles)

| Defect | Fix | Handle |
| :--- | :--- | :--- |
| Winner card had no signature; victory row rendered **olive/mud** because `blueprint.css` paints it with `--status-success-surface` | Amber victory ribbon, uppercase display headline, glow on the semantic headline, tabular score numerals; amber row override loaded after blueprint | `styles/winner.css:22-56`, `:209-244`; `styles/tactile-controls.css:74-88` |
| Fireworks painted dotted sparks **over the player name / score** | Fireworks canvas behind the card (`z-index:0` vs card `1`); rockets spawn in the side gutters; continuous streak instead of a column of fading dots | `ui-manager/celebrations.js:341`, `:358-361`, `:411-426`; `styles/winner.css:24` |
| Confetti was 150 flat pastel rectangles | Mixed streamer / disc / diamond geometry with saturated Arcade Classic hues (same 150-piece / 5 s budget) | `ui-manager/celebrations.js:245`, `:289-305` |
| Lines read as flat 4 px plastic strips; tiles had no edge detail | Three-pass jewel stroke (halo `0.22→0.30`, core, hairline white specular) and an inset tile sheen — no `shadowBlur` loop | `renderer/board.js:99`, `:119-132`, `:211` |
| A dimmed sprite showed as a stray coloured pixel on the game board | Sprites are hidden on the game canvas (`particleAlpha 0.25→0`); home + side playgrounds unchanged | `src/ui/WelcomeAnimation.js:931` |

**Preserved:** all IDs / `data-testid` hooks, workflow copy (`Game Over!`, `Play Again`), score values and winner logic, confetti/fireworks timing and teardown, `destination-out` fade, trail geometry, theme tokens, timers, Convex.

## 2. Gates

| Gate | Result |
| :--- | :--- |
| `preflight_visual_lint.py . --fail-on high --strict` | **100 / 100**, `0` defects |
| `npm run lint` | **PASS** |
| `npx convex typecheck` | **PASS** |
| `npx vitest run` | **102 / 102** files, **728 / 728** tests PASS |
| `npm run build` | **PASS** |
| `npm run test:e2e:smoke` | **1 / 1** PASS |

## 3. Visual QA (headless Chromium, `1280×800`, Void + Dawn; `390×844` touch)

- Winner: amber ribbon above a clean card, amber victory row with `10`/`4` in tabular numerals, mixed-shape confetti, side-gated fireworks streaks that no longer overlap text (`deep-winner-dark.png`, `deep-winner-light.png`, final `v7` capture).
- Board: jewel lines and sheened tiles; no stray sprite pixel on either theme (`deep-game-dark.png`, `deep-game-light.png`).
- Local Play: title visible at `y=38` / `20`, `24×24` checkbox, `0` horizontal overflow (v3 evidence).
- No app-origin console errors (the offline sandbox emits one external Convex DNS error).

Captures: `/tmp/opencode/shots/deep-*.png` (before/after `v=deep` → `v=v7`) and `v3-*`, `v4-*` from v3.
