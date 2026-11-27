# Plastic Surgery v3 — Phase 4 Evidence

**Date:** 2026-11-27 · **Baseline:** `main` @ `97edc55` · **Status:** local edits only — **not committed, pushed, or deployed**.

## 1. Changes (visual skin only — file:line handles)

| Defect | Fix | Handle |
| :--- | :--- | :--- |
| Local Play opened with its heading scrolled off (`scrollTop = 159`) | Replaced the blanket `.setup-section` scroll-snap target with opt-in `.snap-start` | `styles/interactions.css:68-78` |
| Tutorial checkbox stretched to `595×13` by the column flex row | Row layout for checkbox rows + explicit `24×24` control, `accent-color` from locked token, focus ring, reduced-motion guard | `styles/tactile-controls.css:10-43` |
| Native colour wells / utility pills looked like OS chrome | Inset jewelled swatches (`-webkit-/-moz-color-swatch`), tonal specular `.controls-toggle-btn` / `.populate-btn`, primed-state cue | `styles/tactile-controls.css:46-96` |
| One collected sprite rendered as a 2–5 px stray pixel | `7–11` px footprint + one cheap translucent halo for flocks `<= 6` (no gradient, no extra cost at 300 sprites) | `src/ui/WelcomeAnimation.js:296-300`, `:835-850`, `:980-987`; comment `src/ui/sprite-palette.js:11` |
| New skin must not repaint locked brand tokens | New sheet imported **before** `cosmic-identity.css` | `styles.css:10-11` |

**Preserved:** all IDs / `data-testid` hooks, wordmark spans, theme tokens, nebula substrate (no gridlines), sprite palette saturation/contrast, `SpriteTrail.forEachRun()` teleport guard, timer/engine/Convex code.

## 2. Automated gates

| Gate | Result |
| :--- | :--- |
| `preflight_visual_lint.py . --fail-on high --strict` | **100 / 100**, `0` defects (933 files) |
| `npm run lint` | **PASS** (`0` errors) |
| `npx convex typecheck` | **PASS** |
| `npx vitest run` | **102 / 102** files, **728 / 728** tests PASS |
| `npm run build` | **PASS** (no-op) |
| `npm run test:e2e:smoke` | **1 / 1** PASS |

## 3. Live Chromium measurements (1280×800 + 390×844 touch, both themes)

| Metric | Before | After |
| :--- | :--- | :--- |
| `#localSetupScreen.scrollTop` on entry | `159` | `0` |
| `#localSetupTitle` viewport `y` | `-121` (hidden) | `38` desktop / `20` mobile |
| `#localTutorialMode` box | `595×13` | `24×24` (left-aligned with label) |
| `#player1Color` box | bare `80×48` well | `80×48` rounded, inset swatch |
| Horizontal overflow at `390 px` | `0` | `0` |
| Console errors from app code | `0` | `0` (one external Convex DNS error in the offline sandbox) |

Screenshots (captured at `/tmp/opencode/shots/`): `v3-01-menu-dark.png`, `v3-02-local-setup-dark.png`, `v3-03-local-setup-mobile.png`, `v3-04-game-dark.png`, `v4-menu-dark.png` (halo), `v4-game-dark.png`. Baseline set: `01-menu-dark-desktop.png` … `12-checkout-dark.png`.

## 4. Out of scope / not changed

Gameplay, timers, Convex, checkout/donate copy, paywall, winner choreography, prior plans, and the pre-existing untracked `docs/plans/2026-11-11-cloning-sprites-to-teacherevan.md` (left untouched).
