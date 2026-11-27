# ShapeKeeper — Plastic Surgery v3 (Incremental Visual Pass)

**Date:** 2026-11-27
**Baseline:** `main` @ `97edc55`; `preflight_visual_lint.py` = **100/100**, `0` defects
**Method:** Live headless-Chromium screenshots (`1280×800` + `390×844`, both themes) + DOM measurement; static scanner alone cannot see these defects.

---

## 1. Phase 0 Alignment (proven from repo — no owner questions needed)

| Axis | Classification | Evidence |
| :--- | :--- | :--- |
| Platform / input | **Hybrid** (touch + pointer/keyboard) | `styles/menu-responsive.css`, Playwright `mobile-chrome-compat` / `mobile-safari-compat` projects. |
| Product posture | **Commercial** (public Vercel freemium) | `checkout.html`, `donate.html`, hosted brand kit in `media/publish-kit.md`. |
| Audience | **All audiences** | Family/classroom board game by Teacher Evan; WCAG 2.2 AA/AAA required by `AGENTS.md`. |

## 2. Pre-op defects (live evidence, all visual-only)

| # | Surface | Evidence | Defect |
| :-- | :--- | :--- | :--- |
| D1 | Local Play | `styles/interactions.css:68-76`; measured `#localSetupScreen.scrollTop = 159`, `#localSetupTitle.y = -121` | `.setup-section { scroll-snap-align: start }` snaps the first section to the top on entry, so the screen opens with its **title scrolled off**. Manual `scrollTop = 0` is immediately overridden by the snap. |
| D2 | Local Play | measured `#localTutorialMode` = **595×13 px**; `styles/menu-layout.css:525-531` | `.setting-row` is `flex-direction: column; align-items: stretch`, so the native checkbox stretches into a full-width strip instead of a compact 24 px control (WCAG 2.5.8 target). |
| D3 | Local Play | screenshots `05-local-setup`; `styles/menu-layout.css:289-316`, `:543-562` | Native colour wells and number/select inputs keep OS chrome; no swatch radius, no tactile inset, inconsistent with the polished menu CTAs. |
| D4 | Background sprites | `src/ui/WelcomeAnimation.js:295-296`; screenshots `01/02/07/09` show a single 2–5 px speck | With 0 collected sprites (`getVisibleSpriteCount` floor = 1) the lone sprite reads as a stray pixel/rendering artefact, not a collected companion. |
| D5 | Game HUD | screenshots `06/09`; `styles/game.css:255-285` | `.controls-toggle-btn` and `.populate-btn` use a loud solid cobalt fill that fights the Arcade Classic amber/coral system; no specular/detent. |

## 3. Techniques mapped (2026 best practice)

1. **Tactile surfaces** — specular top hairline, hue-consistent tonal fills, 44 px minimum targets, `:active` detent, compositor-only transitions (`transform` / `opacity` / `border-color`).
2. **Native-control art direction** — `::-webkit-color-swatch*` / `::-moz-color-swatch` normalisation; checkbox isolated from flex stretch with `align-self: flex-start` and an explicit `24×24` box; `accent-color` from the locked token.
3. **Legible ambient motion** — raise the minimum sprite footprint and add a cheap translucent halo (two fills, **no** per-frame `createRadialGradient`), preserving `SpriteTrail.forEachRun()` teleport splitting and the ≥60% saturation / ≥3:1 palette contract.
4. **Scroll-snap hygiene** — snap only where it is wanted; never let it hide a screen's own heading.

## 4. Immutable contracts (Verified Preserved Bindings)

- **No DOM / ID / `data-testid` changes.** All selectors (`#localSetupTitle`, `#localTutorialMode`, `#gameControlsToggleBtn`, `.setup-section`, etc.) stay byte-identical.
- `styles/cosmic-identity.css` stays **imported last**; locked hex tokens (`#0b0e14`, `#f5b727`, `#5c9bff`, `#f7f4ec`) untouched. New rules live in existing files and a new `styles/tactile-controls.css` imported **before** `cosmic-identity.css`.
- No gridlines, no wordmark change, no sprite-count policy change, no timer/engine/Convex change, no `MAX_MINE_COUNT` change.
- Sprite halo uses existing colour + alpha only; trail geometry, `TRAIL_MAX_SEGMENT` and `forEachRun()` untouched.

## 5. Scope / non-goals

**In scope:** D1–D5 above. **Out of scope:** gameplay, state, auth, Convex, winner choreography, checkout/donate copy, paywall, performance refactors (covered by PS-v2 and Round-2 already).

## 6. Verification gate (after implementation)

```bash
python3 "$HOME/.config/opencode/skills/plastic-surgery/scripts/preflight_visual_lint.py" . --fail-on high --strict
npm run lint && npx convex typecheck && npx vitest run && npm run build && npm run test:e2e:smoke
```
Plus re-capture the same screenshots and confirm: `#localSetupTitle.y >= 0`, checkbox `24×24` and left-aligned, zero horizontal overflow at `390 px`, and no console errors.
