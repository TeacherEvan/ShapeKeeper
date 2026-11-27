# Plastic Surgery v5 — Menu & Levels Redesign: Evidence

**Date:** 2026-11-27 · **Baseline:** `main` @ `97edc55` + local v3–v4 skin · **Status:** ready to merge.

## 1. Changes (file:line handles)

| Surface | Change | Handle |
| :--- | :--- | :--- |
| Home | Editorial two-column hero on `>=900px` using `grid-template-areas` over the existing children; chapter eyebrow, byline rules, non-text CTA arrows | `styles/menu-redesign.css:1-133` |
| Playgrounds | Context hint appears only when a side pager page is active | `styles/menu-redesign.css:135-160` |
| Levels | Numbered chapter rails, 104px mission cards, tabular numerals, amber completed state, cobalt next-level marker | `styles/menu-redesign.css:162-256` |
| Levels/Local | Landscape compaction so LOCAL PLAY clears the pager rail | `styles/menu-redesign.css:258-283` |
| Lobby | Toast moved below the invite/copy controls | `styles/tactile-controls.css:5-16` |
| Local setup | Revealed the AI difficulty control (`hidden` attribute removed); it remains disabled for human opponents | `index.html:260` |

**Preserved:** three CTA labels/order/IDs/classes, exact wordmark gradients, 16:9 plate, radial-only screen backgrounds, `level-btn unlocked|locked|completed` strings, `data-level` values, sprite policy, timers, engine, Convex. No new DOM nodes — all decoration is generated content or pseudo-elements.

## 2. Regression caught and fixed during Phase 4

Chromium folds pseudo-element text into accessible names. The first CTA-arrow draft changed `LET'S GO!` to `LET'S GO! →`, failing `tests/e2e/main-menu.spec.js` exact-name locators. Replaced the glyph with a non-text CSS chevron; all 26 focused menu/brand/layout/paywall E2E tests now pass.

## 3. Gates (final)

| Gate | Result |
| :--- | :--- |
| `preflight_visual_lint.py . --fail-on high --strict` | **100 / 100**, `0` defects |
| `npm run lint` | **PASS** |
| `npx convex typecheck` | **PASS** |
| `npx vitest run` | **102 / 102** files, **728 / 728** tests PASS |
| `npm run build` | **PASS** |
| `npm run test:e2e:smoke` | **1 / 1** PASS |
| `npx playwright test --project=chromium` | **91 passed**, `3 skipped`, `0` failed |
| Focused menu/brand/layout/paywall E2E | **26 / 26** PASS |

## 4. Visual QA

Fresh captures at `1280×800` (Void + Dawn) and `390×844` touch: `v5-menu-dark.png`, `v5-menu-light.png`, `v5-menu-mobile.png`, `v5-levels-dark.png`, `v5-levels-light.png`, `v5-levels-mobile.png`, `v5-playground-dark.png`, `v5-playground-light.png` in `/tmp/opencode/shots/`. Zero horizontal overflow at both widths; zero app-origin console errors; no interactive overlaps (landscape included).
