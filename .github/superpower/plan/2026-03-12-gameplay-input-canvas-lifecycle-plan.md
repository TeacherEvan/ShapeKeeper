# Gameplay Input Canvas Lifecycle Fix Plan

## Goal

Restore local gameplay dot interaction for mouse and touch by fixing the
live runtime canvas/input lifecycle bug. Add regression coverage so canvas
replacement during startup, resize, and orientation changes does not
silently detach gameplay input again.

## Verified architecture scope

- Authoritative runtime path: root `dots-and-boxes-game.js`, `game-state.js`, `input-handler.js`
- Local game boot path starts in `src/ui/MenuNavigation.js`
- Validation commands from repo instructions: `npm run verify`,
  `npm test`, and targeted Playwright coverage when browser interaction
  changes

## Root cause summary

`DotsAndBoxesGame` creates `InputHandler` before `GameState.setupCanvas()`
runs. `setupCanvas()` clones and replaces `#gameCanvas`, so the root
runtime `InputHandler` remains attached to the old detached canvas. The
same replacement happens again on resize and orientation changes, so the
fix must handle both initial boot and later canvas swaps.

## Constraints

- Keep changes in the authoritative root runtime unless active runtime wiring requires a UI test hook.
- Do not change gameplay rules or multiplayer contracts.
- Prefer a lifecycle-safe fix over a one-time constructor reorder.

## Task breakdown

### Task 1 — Make root InputHandler rebindable and lifecycle-safe

Files:

- `input-handler.js`

Changes:

- Replace inline `.bind(this)` listener registration with stored bound
  handler references.
- Add explicit listener management methods so the root runtime handler
  can detach from an old canvas and attach to a replacement canvas.
- Add a `rebindCanvas(nextCanvas)` method that:
  - no-ops when the canvas is unchanged,
  - detaches listeners from the previous canvas,
  - updates `this.canvas`,
  - attaches listeners to the new canvas,
  - preserves input state safety by clearing transient selection/gesture
    state when needed.
- Add a `destroy()` method or equivalent cleanup helper for testability
  and future lifecycle safety.

Acceptance criteria:

- The root runtime input handler can move cleanly from one canvas element
  to another without duplicate listeners.
- Click and touch listeners are attached through stable function references.

### Task 2 — Wire canvas rebinding into the live game lifecycle

Files:

- `dots-and-boxes-game.js`
- `game-state.js`

Changes:
- Initialize the first canvas before creating the root `InputHandler`,
  or immediately rebind after the first `setupCanvas()` call.
- In `GameState.setupCanvas()`, after cloning/replacing the canvas and
  updating `this.game.canvas`/`this.game.ctx`, call the input handler
  rebinding hook if the handler already exists.
- Preserve existing renderer and system behavior.
- Ensure resize/orientation-triggered `setupCanvas()` calls keep
  gameplay input active on the latest canvas.

Acceptance criteria:

- Local gameplay input works immediately after starting a game.
- Input still works after resize/orientation canvas replacement.
- No duplicate listener behavior is introduced.

### Task 3 — Add regression coverage and validate

Files:

- New root runtime unit test file, e.g. `input-handler.test.js`
- New browser regression file, e.g. `tests/e2e/local-gameplay.spec.js`
- Optional stable test hook updates only if needed, preferably existing
  selectors first

Changes:
- Add a jsdom/Vitest test that verifies root
  `InputHandler.rebindCanvas()` moves listeners to a replacement canvas
  and that the handler tracks the current canvas reference.
- Add a Playwright local gameplay regression that:
  - launches the app,
  - enters local play,
  - starts a small game,
  - clicks/taps adjacent dots on the real `#gameCanvas`,
  - verifies local game state changes (selected dot/line count/current
    player progression) via browser evaluation.
- Run validation in this order:
  1. `npm run verify`
  2. `npm test`
  3. targeted browser regression for the new local gameplay spec (and
     broaden if needed)

Acceptance criteria:

- Unit test fails before the fix and passes after it.
- Browser test proves real local canvas interaction works.
- Validation commands pass.

## Expected outputs

- Root runtime input remains attached to the live canvas after startup and resize/orientation replacement.
- Regression coverage exists for the bug.
- Validation evidence is available from command output.
