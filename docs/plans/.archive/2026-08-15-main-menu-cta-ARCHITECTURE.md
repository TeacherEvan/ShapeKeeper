# ARCHITECTURE — Main-Menu CTA Rename (edit zones outlined)

**Feature:** `FEATURE_PR: main-menu-cta-rename`
**Companion docs:** `2026-08-15-main-menu-cta-INDEX.md` (baseline) · `2026-08-15-main-menu-cta-PLAN.md` (todo)
**Convention:** `█ EDIT ZONE █` = file changed by this PR. `░ read-only ░` = verified untouched.

---

## 1. Boot → menu → screen graph

```
                         index.html  (single document, no bundler)
                                 │
                 ┌───────────────┴────────────────┐
                 │                                │
        ░ <head> CDN + Convex URL ░        <body> #appRoot
                                                  │
   ┌──────────────────────────────────────────────┴──────────────────────────────┐
   │                                                                            │
█ EDIT ZONE 1 ██████████████████████████████████████████            ░ read-only screens ░
│ <section id="mainMenuScreen" data-testid="main-menu-screen">     │  #localSetupScreen  (:100-203)
│   <h1 id="mainMenuTitle">ShapeKeeper</h1>            ░untouched░ │  #lobbyScreen       (:204-302)
│   <div class="menu-options">          ← DOM order == paint order │  #joinScreen        (:303-…)
│     [1] #localPlayBtn    "START GAME"            ← MOVED + RENAMED│  #gameScreen
│     [2] #createGameBtn   "HOST AGAINST FRIENDS"  ← MOVED + RENAMED│  #winnerScreen
│     [3] #joinGameBtn     "JOIN AGAINST FRIENDS"  ← RENAMED        │
│   </div>                                                          │
│   #themeToggle                                       ░untouched░  │
└███████████████████████████████████████████████████████████████████┘
                 │  ids + data-testids are IDENTITY → byte-identical after edit
                 ▼
        ░ src/ui/menu/eventBindings.js ░   (READ-ONLY — binds by getElementById)
          :42 createGameBtn  ──► Convex createRoom() ──► showScreen('lobbyScreen')
          :71 joinGameBtn    ──► showScreen('joinScreen')
          :93 localPlayBtn   ──► showScreen('localSetupScreen')
                 │
                 ▼
        ░ src/ui/ScreenTransition.js:13-42 ░  showScreen()
          focus → FIRST focusable of incoming screen  ⚠ SIDE EFFECT OF REORDER
          (was #createGameBtn, becomes #localPlayBtn "START GAME")
```

### Why no JS change is required
Handlers resolve elements by `id`, never by DOM index and never by text
(`eventBindings.js:42,71,93`). Renaming a text node and moving a `<button>` inside
`.menu-options` cannot break the wiring. **Any diff to `src/` in this PR is a red flag.**

---

## 2. Label → action mapping (TARGET state — matches PLAN header table exactly)

```
 USER SPEC (by menu POSITION)          RESOLVED TARGET (by ACTION, verified in code)
 ────────────────────────────          ────────────────────────────────────────────────
 1# LOCAL PLAY 2V2 → START GAME    ──► #localPlayBtn   → localSetupScreen   (offline 2P / AI)
 2# JOIN GAME → HOST AGAINST …     ──► #createGameBtn  → Convex createRoom  ★ HOST = create
 3# JOIN GAME → JOIN AGAINST …     ──► #joinGameBtn    → joinScreen (enter 6-char code)
```
★ The spec's word "JOIN" in line 2 is positional. Hosting is `createRoom()`
(`eventBindings.js:50`); binding "HOST AGAINST FRIENDS" to `#joinGameBtn` would send a host
into the code-entry screen. Mapping above is the only coherent reading.

> The pre-change **baseline** ordering (pos1 `createGameBtn` "Create Game", pos2 `joinGameBtn`
> "Join Game", pos3 `localPlayBtn` "Local Play (2 Players)") is documented in INDEX §2 and is
> intentionally NOT the same table as this one. Element `id ↔ data-testid ↔ route` triples are
> identical across both; only position, label text and primary/secondary class change.

---

## 3. Visual hierarchy change

```
        BEFORE                                AFTER
 ┌────────────────────────┐          ┌────────────────────────┐
 │      ShapeKeeper       │          │      ShapeKeeper       │
 │  Created by Teacher…   │          │  Created by Teacher…   │
 │ ┏━━━━━━━━━━━━━━━━━━━━┓ │          │ ┏━━━━━━━━━━━━━━━━━━━━┓ │
 │ ┃  Create Game       ┃ │ primary  │ ┃  START GAME        ┃ │ primary  ← fastest path
 │ ┗━━━━━━━━━━━━━━━━━━━━┛ │          │ ┗━━━━━━━━━━━━━━━━━━━━┛ │
 │ ┏━━━━━━━━━━━━━━━━━━━━┓ │          │ ┌────────────────────┐ │
 │ ┃  Join Game         ┃ │ primary  │ │ HOST AGAINST FRIEN…│ │ secondary
 │ ┗━━━━━━━━━━━━━━━━━━━━┛ │          │ └────────────────────┘ │
 │ ┌────────────────────┐ │          │ ┌────────────────────┐ │
 │ │ Local Play (2 Pla…)│ │secondary │ │ JOIN AGAINST FRIEN…│ │ secondary
 │ └────────────────────┘ │          │ └────────────────────┘ │
 └────────────────────────┘          └────────────────────────┘
   2 primaries competing               1 primary, 2 secondaries
```

**CSS edit zone:** class attribute swap only, inside `index.html` — `menu-btn secondary`
moves from `#localPlayBtn` to `#createGameBtn` + `#joinGameBtn`. **No `.css` file is edited.**
Existing rules already cover it: `styles/menu-layout.css:300-325`, `styles/blueprint.css:203-222`.

Grounded in current guidance (verified 2026-08-15):
- WCAG 2.2 target size — `.menu-btn` `min-height:48px` (`menu-layout.css:301`) already ≥44px, unchanged.
- CTA hierarchy: exactly one visually dominant primary; secondaries recede (designstudiouiux, 2026).
- Action-first verb labels ("START GAME") over noun-phrase labels ("Local Play (2 Players)").

---

## 4. Test architecture — edit zones

```
 tests/e2e/
 ├── █ main-menu.spec.js  ← NEW FILE (edit zone 2)
 │     getByRole('button', { name: 'START GAME' })            ← label contract
 │     getByRole('button', { name: 'HOST AGAINST FRIENDS' })
 │     getByRole('button', { name: 'JOIN AGAINST FRIENDS' })
 │     + DOM-order assertion   (nth 0/1/2 → id map)
 │     + label→route assertions (3 clicks → 3 screens)
 │     + focus-landing assertion after #exitGame
 │     + 44px target-size assertion
 ├── ░ smoke.spec.js ░                testids only  → unaffected
 ├── ░ browser-compatibility.spec.js ░ testids + #ids → unaffected
 ├── ░ aria-hidden-verify.spec.js ░    #localPlayBtn  → unaffected
 ├── ░ local-gameplay / winner-screen / achievement-panel / local-setup / settings-and-theme ░
 │                                     #localPlayBtn  → unaffected
 └── ░ multiplayer-*.spec.js, reconnect, loading-state, tutorial ░ → unaffected
```

**Locator policy (Playwright docs + 2026 locator guidance, verified 2026-08-15):**
`getByRole(name:)` FIRST for the new label contract — it is the only locator that actually
fails if a label regresses. `getByTestId`/`#id` retained for routing, so a future copy change
breaks exactly one spec (`main-menu.spec.js`) instead of thirteen.

---

## 5. Blast radius summary

| Path | Change | Risk |
|---|---|---|
| `index.html:75-93` | text ×3, DOM order, `secondary` class ×3 | LOW — no id/testid touched |
| `src/ui/ScreenTransition.js:13-48` | **UNPLANNED, ADDED MID-RUN** — focus-order defect fix, see §7 | LOW — covered by 3 tests |
| `tests/e2e/main-menu.spec.js` | NEW | none (additive) |
| `docs/plans/2026-08-15-main-menu-cta-*.md` | NEW ×3 + DEBRIEF | none |
| `styles/**` | **NONE** | any diff = investigate |
| `convex/**` | **NONE** | — |

## 6. Verification chain

```
edit index.html
  └─► npx eslint .                         (no NEW errors vs. 14 baseline)
  └─► npx vitest run                       (78/78, untouched)
  └─► npx playwright test tests/e2e/main-menu.spec.js --project=chromium   (new contract)
  └─► npx playwright test --project=chromium                               (no regression)
  └─► git diff --stat                      (index.html + ScreenTransition.js + tests + docs ONLY)
```

---

## 7. AMENDMENT — focus-order defect uncovered by objective C7

**Recorded 2026-08-15, mid-implementation. This section supersedes the original
"no `src/` change expected" claim above and in the PLAN's Phase B.**

Objective C7 (focus lands on the primary action after exiting a game) FAILED on first run.
It was not a bad assertion — it exposed a pre-existing ordering bug in `showScreen()`.

### Empirical evidence (temporary probe spec, since deleted)

```
{"afterMenuClick":"BODY","inGame":"gameCanvas","immediately":"BODY","settled":"BODY",
 "firstFocusable":"localPlayBtn"}
TABSEQ=["BODY","skip-link","localPlayBtn","createGameBtn"]
```

`firstFocusable` correctly resolved to `localPlayBtn`, yet `document.activeElement` was `BODY`:
the focus call was landing on nothing.

### Root cause

Original `ScreenTransition.js` order of operations was:

```
1. compute focusTarget inside the INCOMING screen
2. focusTarget.focus()          ← incoming screen is still hidden + inert here
3. flip .active / hidden / aria-hidden / inert on every .screen
```

`HTMLElement.focus()` on an element inside a `hidden`/`inert` subtree is a **silent no-op** —
focus falls back to `<body>`. The intent of the original code (avoid the
"aria-hidden on a focused element" warning) was satisfied only by accident: focus left the
outgoing screen because it went nowhere at all.

### Fix (`src/ui/ScreenTransition.js:13-48`)

Split into two beats around the visibility flip:

```
1. activeEl.blur()              ← outgoing control released BEFORE aria-hidden is applied
2. flip .active / hidden / aria-hidden / inert
3. focusTarget.focus()          ← incoming screen is now visible + interactive
```

### Proof

- `tests/e2e/main-menu.spec.js` "lands focus on START GAME when returning from a game" → PASS
- `tests/e2e/aria-hidden-verify.spec.js` (2 pre-existing guard tests) → still PASS,
  i.e. the original warning the code defended against has not regressed.

### Interaction with the rename

The reorder made the bug *observable*: `localPlayBtn` is now the first focusable in
`#mainMenuScreen`, so keyboard/AT users returning from a match should land on `START GAME`.
Without this fix they land on `<body>` and must Tab past the skip-link to reach any action.

