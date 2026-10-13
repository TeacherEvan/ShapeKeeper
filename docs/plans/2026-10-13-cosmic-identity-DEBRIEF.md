# Cosmic Identity — SHAPE KEEPER / PICKABOO (2026-10-13)

## What shipped

The supplied promo art (a hooded Keeper holding a glowing octahedron inside a
constellation of neon polyhedra) is now the game's identity:

| Piece | File |
| --- | --- |
| Full promo art (social/OG card, README) | `assets/branding/shape-keeper-hero.jpg` |
| Artwork-band crop used as the menu hero | `assets/branding/shape-keeper-plate.jpg` |
| Hexagonal brand mark (favicon / touch icon) | `assets/branding/shape-keeper-mark.svg` |
| Token + wordmark + substrate layer (loaded LAST) | `styles/cosmic-identity.css` |
| Cosmic particle palette + canvas ink | `src/ui/WelcomeAnimation.js` |
| Default theme = void | `src/ui/ThemeManager.js`, `index.html` |

### Palette (sampled from the art)

| Role | Void (`data-theme="dark"`, default) | Dawn (`data-theme="light"`) |
| --- | --- | --- |
| Backdrop | `#030611` cosmic void | `#f4f1ff` daylight nebula |
| Keeper ink (primary action) | `#00f0ff` electric cyan | `#0a6d95` deep cosmic cyan |
| Party ink (secondary action) | `#e000ff` neon magenta | `#7a12d6` nebula magenta |
| Warning | `#ffc700` solar amber | `#a2590a` |
| Success | `#22ff00` neon lime | `#0d7a6a` |

### Design decisions

- **The crop is baked into the asset, not done with CSS.** The promo art carries
  its own `SHAPE KEEPER` title (~y225) and PICKABOO lockup (~y280); the menu
  plate is a real `384x216` (16:9) JPEG of the artwork band, so the menu shows
  the Keeper once and the live wordmark carries the name.
- **The wordmark is one accessible word.** `<span class="wordmark-shape">Shape</span><span class="wordmark-keeper">Keeper</span>`
  has no whitespace text node, so the accessible name stays `ShapeKeeper` while
  the two halves carry the cyan→blue and magenta→violet gradients. The visual
  break is flex `gap`.
- **Void is the default theme** (`<html data-theme="dark">` in the shell, plus
  `DEFAULT_THEME = 'dark'`), because the identity is the dark art. The toggle
  still works and now yields the dawn nebula variant.
- **No grid lines.** The substrate is a three-stop radial nebula wash; the
  product owner's earlier "Remove colour gridlines!!!" decision is enforced by a
  regression test that fails if a repeating line pattern returns.

## Verification (2026-10-13)

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 errors (6 pre-existing warnings) |
| `npx vitest run` | 64 files, 454 passed / 1 skipped (was 442 + 12 new) |
| `npm run build` | no-op by design (`echo`) |
| Playwright chromium, full `tests/e2e` | 56 passed / 6 failed / 3 skipped |
| Same suite against unmodified `origin/main` | **the same 6 failures** — all pre-existing |

The new tests:

- `tests/cosmic-identity.test.js` — parses the shipped stylesheet, proves the
  inverse-text contrast ratios by the WCAG formula (≥ 4.5:1 on every action ink,
  both themes), proves the substrate has no grid, proves the canvas ink resolves
  to the same backdrop the CSS declares, and proves the default theme.
- `tests/e2e/brand-identity.spec.js` — reads the computed style of the live page:
  void tokens, the plate's real pixels and 16:9 box, the split wordmark gradients,
  the nebula substrate, the dawn toggle, and the short-viewport fallback.

### Environment notes

- **GitHub Actions is dead account-wide**: every run since 2026-09-28 fails at
  0 s with *"The job was not started because your account is locked due to a
  billing issue."* The merge cannot wait on a green CI run; the gates above were
  run locally instead.
- **Playwright's bundled chromium and ffmpeg do not exist for Ubuntu 26.04**
  ("Playwright does not support ffmpeg on ubuntu26.04-x64"). Drive system Chrome
  with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome` and a config whose
  `use.video` is `'off'` — otherwise `newPage()` dies looking for
  `ms-playwright/ffmpeg-1011/ffmpeg-linux`.
