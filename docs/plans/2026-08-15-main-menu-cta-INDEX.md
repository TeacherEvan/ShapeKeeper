# INDEX — Codebase State (pre-change baseline)

**Feature:** Main-menu CTA rename + reorder (`FEATURE_PR: main-menu-cta-rename`)
**Repo:** `ShapeKeeper` — https://github.com/TeacherEvan/ShapeKeeper
**Branch:** `feature/main-menu-cta-rename` (cut from `main` @ `02618d9`)
**Captured:** 2026-08-15 (SAST user / Asia-Bangkok host clock)
**Status of this document:** BASELINE — this is the **pre-change state of `main` @ `02618d9`**.
All `path:line` citations in §2 refer to HEAD `02618d9`, *not* to the working tree after the feature
lands. Retrieve them with `git show 02618d9:index.html`. Verified against live code at capture time;
§2 and §5 carry post-implementation reconciliation notes where the feature has since moved things.

---

## 1. Stack (verified from `package.json`, no framework)

| Layer | Reality |
|---|---|
| Frontend | Vanilla ES modules + `<canvas>`; **no bundler, no build step** (`package.json` `build` = `echo 'No build step required'`) |
| Entry | `index.html` (single document, 585 lines, all screens inline as `<section class="screen">`) |
| UI modules | `src/ui/*.js` + `src/ui/menu/*.js` |
| Backend | Convex (`convex/`), prod URL hardcoded in `index.html` (commit `2632f40`) |
| Unit tests | Vitest — **12 files / 78 tests, 78 passing** (baseline run 2026-08-15) |
| E2E | Playwright — 16 specs in `tests/e2e/`, static server `npx http-server . -p 9323` (`playwright.config.js:61`) |
| Lint | ESLint + Prettier — **14 pre-existing errors** in `tests/e2e/{achievement-panel,local-setup,settings-and-theme}.spec.js` (all `prettier/prettier`, all auto-fixable). Pre-dates this feature. |

---

## 2. The startup home menu — state at HEAD `02618d9` (BEFORE this feature)

**File:** `index.html:75-93` **at commit `02618d9`** (inside `<section id="mainMenuScreen"
data-testid="main-menu-screen">`, `index.html:63-98`). Reproduce with `git show 02618d9:index.html`.

DOM order, label text, id, testid, style class — **BASELINE (pre-change)**:

| DOM pos | Visible label | `id` | `data-testid` | class |
|---|---|---|---|---|
| 1 | `Create Game` (`:81`) | `createGameBtn` | `create-game-button` | `menu-btn` (primary) |
| 2 | `Join Game` (`:84`) | `joinGameBtn` | `join-game-button` | `menu-btn` (primary) |
| 3 | `Local Play (2 Players)` (`:91`) | `localPlayBtn` | `local-play-button` | `menu-btn secondary` |

> **POST-IMPLEMENTATION NOTE (2026-08-15):** the feature has since been applied, so the *working tree*
> now reads pos1 `localPlayBtn` "START GAME" (`menu-btn`), pos2 `createGameBtn` "HOST AGAINST FRIENDS"
> (`menu-btn secondary`), pos3 `joinGameBtn` "JOIN AGAINST FRIENDS" (`menu-btn secondary`), and
> prettier collapsed the `#localPlayBtn` tag onto one line, shifting subsequent line numbers.
> The TARGET table is the authoritative one and lives in the PLAN header + ARCHITECTURE §2.
> The baseline table above is deliberately different from it — that difference **is** the feature.

Sibling nodes in the same container: `<h1 id="mainMenuTitle">ShapeKeeper</h1>` (`index.html:72`),
`<p class="credit">` (`index.html:73`), `#themeToggle` (`index.html:94`).

### Behaviour bound to each button — `src/ui/menu/eventBindings.js`

| Button | Handler | Effect |
|---|---|---|
| `createGameBtn` | `eventBindings.js:42-69` | **HOST path.** `ShapeKeeperConvex.createRoom(name, gridSize, false)` → `subscribeToRoomUpdates()` → `showScreen('lobbyScreen')`; falls back to local `lobbyManager.createRoom()` when Convex absent |
| `joinGameBtn` | `eventBindings.js:71-73` | **JOIN path.** `showScreen('joinScreen')` only (code entry happens on `#joinScreen`, `index.html:303-320`) |
| `localPlayBtn` | `eventBindings.js:93-103` | **LOCAL path.** Resets `#localTutorialMode` + `#localOpponentType='human'`, `syncLocalAIControls()`, `showScreen('localSetupScreen')` |

**Semantic conclusion (drives the rename):** the button that *hosts* a match against friends is
`createGameBtn`, NOT `joinGameBtn`. The user's line `2#JOIN GAME=NEW_NAME(HOST AGAINST FRIENDS)`
refers to menu **position 2**, and the host action must therefore land on `createGameBtn`.

---

## 3. Downstream screens (unchanged by this feature, listed to bound the blast radius)

| Screen | `index.html` | Heading text |
|---|---|---|
| `localSetupScreen` | 100-203 | `<h1 id="localSetupTitle">Local Play</h1>` (`:110`), `<p class="credit">2 Player Mode</p>` (`:111`) |
| `lobbyScreen` (Create Game / Lobby) | 204-302 | comment `<!-- Create Game / Lobby Screen -->` (`:204`) |
| `joinScreen` | 303-… | `<h1 id="joinScreenTitle">Join Game</h1>` (`:314`) |

---

## 4. Styling of the menu buttons

| Rule | File:line | Effect |
|---|---|---|
| `.menu-options` flex column, `gap:20px` | `styles/menu-layout.css:89-94` | vertical stack; DOM order == visual order |
| `.menu-btn` base — `min-height:48px`, `padding:14px 28px` | `styles/menu-layout.css:275-316` | already ≥44px WCAG 2.2 target size |
| `.menu-btn.secondary` — cobalt `--accent-secondary` | `styles/menu-layout.css:318-325`, repainted `styles/blueprint.css:214-222` | secondary visual weight |
| Mobile: `.menu-options` becomes `flex-direction:row; flex-wrap:wrap` | `styles/menu-responsive.css:190-200` | **order-sensitive**: on landscape/short viewports the buttons wrap left→right in DOM order |

**Consequence:** reordering the DOM is sufficient to reorder the menu on every breakpoint —
no CSS `order` property affects `.menu-options`. Verified with a property-isolated grep —
`grep -rnE 'order:[[:space:]]' styles/ | grep -v 'border:'` returns exactly two `order:` property
declarations, `styles/game.css:291` and `styles/winner.css:13`, **neither inside `.menu-options`**,
so nothing overrides menu paint order. (A naive `grep -rn "order:"` also matches `border:`, giving
39 lines — that substring match is excluded by the property-isolated command above.)

---

## 5. Focus / accessibility machinery that touches the menu

`showScreen()` — `src/ui/ScreenTransition.js:13-42` — before flipping `aria-hidden`/`inert`, moves focus to
**the first focusable element of the incoming screen** (`querySelector('button:not([hidden]):not([disabled]), …')`,
`ScreenTransition.js:29-33`).

**Consequence:** whichever button is FIRST in `#mainMenuScreen` DOM becomes the focus landing target when
returning from a game (`#exitGame` → `eventBindings.js:379-394`) or after `#playAgain` (`:396-405`).
After the reorder that is `START GAME` — an improvement (primary action receives focus).

**DEFECT FOUND & FIXED (see ARCHITECTURE §7):** the original `showScreen()` called `focus()` on the
incoming target while it was still `hidden`/`inert`, a silent no-op that dropped focus to `<body>`.
Objective C7 caught this. Fixed by blurring the outgoing control before the flip and focusing the
incoming target after it (`ScreenTransition.js:13-48`). This makes `src/ui/ScreenTransition.js` a
changed file in this PR, contrary to the original "no `src/` change" expectation.
Guarded today by `tests/e2e/aria-hidden-verify.spec.js` (2 tests) + `main-menu.spec.js` C7.

---

## 6. Test coupling to the main menu (the real regression surface)

**Inventory method (EXHAUSTIVE):**
`grep -rn "local-play-button\|create-game-button\|join-game-button\|localPlayBtn\|createGameBtn\|joinGameBtn" tests/`
Every coupled file is listed below — 14 files at baseline (13 pre-existing + `main-menu.spec.js` added
by this feature). None couples on visible label text.

### Coupled by **`data-testid`** (survives a label change)
- `tests/e2e/smoke.spec.js:23-24` — `create-game-button`, `join-game-button`
- `tests/e2e/browser-compatibility.spec.js:5,15-17,34-35,52,71`
- `tests/e2e/tutorial.spec.js:7` — `local-play-button`
- `tests/e2e/loading-state.spec.js:10` — `create-game-button`
- `tests/e2e/reconnect.spec.js:46,50` — `create-game-button`, `join-game-button`
- `tests/e2e/multiplayer-startup.spec.js:38,44` — `create-game-button`, `join-game-button`
- `tests/e2e/helpers/multiplayer-sync.js:44,48` — `create-game-button`, `join-game-button`

### Coupled by **`#id`** (survives a label change)
- `tests/e2e/browser-compatibility.spec.js:19,36,67`
- `tests/e2e/aria-hidden-verify.spec.js:18,19,38`
- `tests/e2e/local-gameplay.spec.js:21,32,194,233,311`
- `tests/e2e/winner-screen.spec.js:6`
- `tests/e2e/achievement-panel.spec.js:7`
- `tests/e2e/local-setup.spec.js:6`
- `tests/e2e/settings-and-theme.spec.js:34`

### Coupled by **visible text** — full audit result
`grep -rn "Local Play|Create Game|Join Game|getByText|has-text|toHaveText" tests/ src/ *.test.js`
→ at HEAD `02618d9`: **ZERO** assertions on main-menu button *text*. The only `has-text('Local Play')`
occurrence is `Triangle/canvasBonusFeature.md:1537` — a **markdown design doc, not executed code**.

> **POST-IMPLEMENTATION NOTE:** the same grep now returns 1 hit —
> `tests/e2e/main-menu.spec.js` `RETIRED_LABELS = ['Create Game', 'Join Game', 'Local Play (2 Players)']`.
> That is this feature's own new spec asserting the old labels are **absent** (count 0). The
> "zero text-coupling" finding is scoped to the 13 pre-existing specs, which is what makes the
> rename behaviour-safe.

**@DONE / DO-NOT-REBUILD:** no pre-existing test needs rewriting to keep the suite green. Label changes
are therefore behaviour-safe; at baseline the new labels were **unasserted**, which is the actual gap
this feature closes (see PLAN objectives C1-C8).

---

## 7. Identity vs. display classification (per `rebrand-display-strings` skill)

| Token | Class | Action |
|---|---|---|
| Button text nodes `index.html:81,84,91` | DISPLAY | **REBRAND** |
| `id="createGameBtn"` / `joinGameBtn` / `localPlayBtn` | IDENTITY | **LEAVE** — 13 test references |
| `data-testid="create-game-button"` etc. | IDENTITY | **LEAVE** — 7 test references |
| `getElementById('…')` in `eventBindings.js:42,71,93` | IDENTITY | **LEAVE** |
| `showScreen('localSetupScreen'/'joinScreen'/'lobbyScreen')` | IDENTITY | **LEAVE** |
| `docs/planning/MULTIPLAYER_PLANNING.md:203-211,318` ASCII menu | DOC PROSE | **LEAVE** (historical planning record) |
| `docs/technical/TESTING_BACKEND_LOGGING.md:50,79` "Click Join Game" | DOC PROSE | out of scope; flagged in PLAN obj. 12 as optional |

---

## 8. Gates (literal commands, as run for the baseline)

```bash
npx eslint .                 # 14 pre-existing errors (3 e2e specs, prettier-only)
npx vitest run               # 78/78 PASS  (baseline 2026-08-15)
npx playwright test --project=chromium
npx playwright test tests/e2e/main-menu.spec.js --project=chromium
```

## 9. @BAN — never edit / never commit

```
convex/_generated/**   node_modules/**   playwright-report/**   test-results/**
.vercel/**   .env.local   package-lock.json (unless a dep actually changes)
AGENTS.md   CLAUDE.md   .agents/**   .claude/**
```
