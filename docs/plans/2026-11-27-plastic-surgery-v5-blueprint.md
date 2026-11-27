# ShapeKeeper — Plastic Surgery v5 (Menu & Levels Redesign)

**Date:** 2026-11-27 · **Baseline:** local edits through v4 · **Static lint:** 100/100

## Phase 0 — Alignment

Hybrid / commercial / all audiences (unchanged). Locked contracts: three CTA labels, order, IDs and `secondary` classes (`tests/e2e/main-menu.spec.js`), exact wordmark gradients and radial-only screen backgrounds (`tests/e2e/brand-identity.spec.js`), `level-btn unlocked|locked` class strings (`tests/e2e/paywall-level-gate.spec.js`), no interactive overlap at mobile widths (`tests/e2e/layout-overlap-mobile.spec.js`), no gridlines, no DOM additions to gameplay screens.

## Phase 1 — Live diagnosis (why a redesign, not more tweaks)

- **Main menu** (`01-menu-dark-desktop.png`, `07-menu-dark-mobile.png`): a single vertically centred stack on every viewport. No editorial hierarchy, the brand plate and three CTAs compete as equal blocks, and the two "Playground" pager pages are blank canvases with only a return pill — no indication of what they are for.
- **Levels** (`03-levels-light-desktop.png`, `08-levels-dark-mobile.png`): 100 identical small cards under plain text separators; no chapter rhythm, no completed/unlocked distinction beyond a faint tint, no tabular numerals.

## Phase 2 — Blueprint

| Surface | Technique | Implementation |
| :--- | :--- | :--- |
| Main menu | Editorial two-column hero (Linear/Stripe dashboard discipline) on `>=900px`; plate + wordmark/byline left, CTA stack right; mobile keeps the centred stack | CSS grid with `grid-template-areas` on the existing `.welcome-container` children — **no new DOM** |
| Main menu | Chapter eyebrow above the plate, "CHOOSE YOUR PATH" label above the CTAs, flanking byline rules, directional CTA chevrons | `::before` / `::after` generated text + hairlines (generated content is invisible to `textContent`, so exact-label E2E assertions stay green) |
| Playground | Context hint that appears only when a side page is active | `#homePagerDots:has(.pager-dot[data-page="-1"].active)::before` etc. |
| Levels | Five chapter rails with numbered badges; larger tactile mission cards; amber completed state, cobalt "next" marker, tabular numerals | CSS counters on `.level-tier-header`, pseudo-element badge/rail, existing `.level-btn` state classes |
| Both | Nebula depth via radial-gradient layers only; compositor-only hover transforms; reduced-motion guards; `prefers-contrast` safety | New sheet loaded after blueprint/menu-layout, before `cosmic-identity.css` |

## Phase 3 — Preserved bindings

All IDs, `data-testid`s, button labels, `.menu-btn.secondary` classes, `data-level` values, `level-btn unlocked|locked|completed` strings, wordmark spans, 16:9 plate, locked hex tokens, sprite-count policy, timers, Convex, engine code.

## Phase 4 — Verification

Full `AGENTS.md` gate suite plus fresh captures at `1280×800` and `390×844`, Void + Dawn, menu / side pages / levels; assert no horizontal overflow and no interactive overlaps.
