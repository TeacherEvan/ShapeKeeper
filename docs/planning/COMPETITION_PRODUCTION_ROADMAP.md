# ShapeKeeper Competition Production Roadmap

## Executive directive

This document is the **Phase 1 approval artifact** for preparing ShapeKeeper
for an international competition environment.

It is intentionally more opinionated than the first draft.

The goal is not to describe every nice idea. The goal is to decide:

- what must be stabilized first
- what must not be changed under deadline pressure
- which files will likely move in each execution slice
- how online match startup, sync, and recovery will be validated
- what quality bar must be met before a competition build is considered safe

**No gameplay or backend production code is to be modified until this roadmap is
approved.**

## Brutally honest assessment

ShapeKeeper is not a clean greenfield app. It is a strong prototype in a
half-refactored state.

The most important truth is this:

> The project's biggest current risk is not missing polish.
> It is runtime ambiguity.

The repository currently mixes:

- classic script loading in `index.html`
- ES module syntax in `game.js` and `welcome.js`
- root-level runtime files
- `src/` modules that are described as future code, but are already imported
  by `welcome.js`
- zero-build deployment assumptions in `vercel.json`
- light automated coverage in the exact areas that now matter most:
  startup, sync, reconnect, and online failure handling

That means a competition push should **not** attempt a full architectural
migration. That would be risky theater.

The competition plan should instead:

1. stabilize the current runtime model
2. harden multiplayer startup and reconciliation
3. add browser-level regression coverage
4. add minimum security and abuse resistance
5. apply competition-grade UX upgrades last

## Recommended strategic decision

### Decision

For the competition branch, ShapeKeeper should adopt:

- **browser-native ES modules**
- **no bundler in the first productionization pass**
- **the existing root entry files as the official runtime shell**
- **Convex browser bundle kept as a separate preloaded global dependency**

### Why this is the right move

This choice is the highest-confidence path because it:

- aligns with the code already being written as modules
- preserves the current no-build Vercel deployment model
- avoids introducing Vite, Rollup, or another toolchain under deadline pressure
- fixes the most dangerous current contradiction with the smallest blast radius
- allows Playwright and runtime hardening work to begin immediately afterward

### What this plan explicitly rejects

The competition branch should **not** attempt the following before stabilization:

- a full migration to `src/index.js` as the only app entrypoint
- a large-scale directory reorganization
- a full deletion of root files
- a broad rendering-engine rewrite
- a backend platform change
- speculative performance work before startup/sync reliability is fixed

In short:

> Do not perform a grand refactor when the match-start path itself is not yet
> deterministic.

## Verified codebase reality

### Runtime loading facts

Current runtime loading in `index.html`:

- `convex-client.js`
- `game.js`
- `welcome.js`

Current deployment assumptions:

- `vercel.json` uses static output with no framework and no build command
- `package.json` confirms a no-build frontend expectation

Current contradiction:

- `game.js` contains ES module imports
- `welcome.js` contains ES module imports
- `index.html` currently loads them as classic scripts

### Testing facts

Current test posture is not competition-ready.

The clearest example is `convex-client.test.js`, which is mostly placeholder
coverage rather than behavioral verification.

### Refactor facts

`docs/planning/REFACTORING_PLAN.md` describes a larger modularization effort.
That plan is useful as background, but it is too broad for the competition
branch as a first move.

The correct competition posture is:

- **stabilize first**
- **refactor deeper only where stabilization requires it**

## Architecture recommendation

## Official competition runtime contract

If this roadmap is approved, the official runtime contract for the competition
branch should be:

1. `index.html` is the browser entrypoint
2. Convex browser bundle remains loaded separately
3. `game.js` and `welcome.js` become explicit module entry scripts
4. root-level runtime modules remain authoritative for the competition branch
5. `src/` is treated as:
   - active only where already imported by the approved runtime path
   - otherwise non-authoritative until after competition hardening is complete

This is intentionally conservative.

It optimizes for shipping a reliable build, not for achieving aesthetic
architectural purity.

## Startup contract that must exist after implementation

Online multiplayer startup must become a real state machine.

The competition branch should not rely on loosely ordered side effects.

Required client startup states:

1. `idle`
2. `creating_or_joining_room`
3. `room_subscribed`
4. `room_ready_to_start`
5. `initializing_game_shell`
6. `awaiting_first_authoritative_state`
7. `in_match`
8. `reconnecting`
9. `desynced`
10. `fatal_startup_failure`

Required transition rule:

- The loading skeleton may appear during startup.
- The loading skeleton may **not** disappear until the first authoritative
  game-state payload is processed successfully.
- If that payload does not arrive within a bounded window, the user must see a
  recovery path, not a dead screen.

## Workstreams by specialist role

### Agent Alpha — architecture and runtime stabilization

#### Objective

Make the production runtime singular, documented, and executable.

#### Deliverables

- one authoritative browser execution path
- corrected script loading semantics in `index.html`
- runtime documentation that matches real behavior
- removal or quarantine of ambiguous entrypoint expectations

#### Likely files touched in Phase 2

- `index.html`
- `game.js`
- `welcome.js`
- possibly `docs/planning/REFACTORING_PLAN.md`
- possibly `.github/copilot-instructions.md`

#### Acceptance criteria

- no module/classic-script mismatch at boot
- no implicit second entrypoint competing with the official runtime
- clean startup in a browser without relying on undocumented behavior

### Agent Beta — research, reliability, and security baseline

#### Objective

Raise the current trust model from prototype-friendly to competition-safe.

#### Risks already visible

- predictable client-side session ID generation
- insufficiently hardened input boundaries for player-facing fields
- unsafe DOM rendering patterns in parts of the UI layer
- no documented abuse throttling for repeated room and move actions
- concurrency-sensitive move and score transitions that need explicit testing

#### Deliverables

- stronger session identity generation strategy
- input constraints and server-side validation rules
- safe rendering policy for player-supplied text
- mutation abuse controls and dispute-friendly logging

#### Likely files touched later

- `convex-client.js`
- `convex/rooms.ts`
- `convex/games.ts`
- `src/ui/MenuNavigation.js`
- `src/ui/Toast.js`
- any UI helper that writes player-controlled content into the DOM

#### Acceptance criteria

- malicious names render as inert text
- malformed room and move inputs are rejected server-side
- repeated mutation abuse is throttled or at least logged with enough fidelity
  for review

### Agent Gamma — Playwright environment and monitoring

#### Objective

Create a browser-level safety net for startup, sync, reconnect, and security
regressions.

#### Deliverables

- Playwright project scaffolding
- dual-context multiplayer fixtures
- failure artifact collection
- network-throttled regression scenarios
- preview-deployment smoke coverage

#### Likely files added later

- `playwright.config.js` or `playwright.config.ts`
- `tests/e2e/smoke.spec.*`
- `tests/e2e/lobby.spec.*`
- `tests/e2e/loading-state.spec.*`
- `tests/e2e/multiplayer-sync.spec.*`
- `tests/e2e/reconnect.spec.*`
- `tests/e2e/security-inputs.spec.*`
- helper fixtures under `tests/fixtures/`

#### Acceptance criteria

- a two-player match can be created and validated in automation
- startup and reconnect failures emit traceable artifacts
- the loading-state regression becomes machine-detectable

### Agent Delta — netcode, match startup, and online state recovery

#### Objective

Eliminate static loading states and reduce desync risk during online play.

#### Primary problem

The current system optimizes update frequency, but that is not the same as a
formal synchronization contract.

Right now the likely failure zone is this boundary:

- room status changes to `playing`
- UI transitions into game mode
- game instance is created
- game-state subscription attaches
- first state arrives later or not at all
- loading UI depends on constructor timing rather than authoritative sync

That is exactly how a polished prototype becomes a tournament liability.

#### Deliverables

- explicit startup state machine
- first-state handshake requirement
- subscription lifecycle guards
- reconnect and resubscribe behavior
- desync detection and recovery path
- structured logging around startup and in-match reconciliation

#### Likely files touched later

- `src/ui/MenuNavigation.js`
- `convex-client.js`
- `dots-and-boxes-game.js`
- `ui-manager.js`
- possibly `game-state.js`

#### Acceptance criteria

- no silent infinite loading after room start
- one duplicate move cannot produce divergent client views
- reconnect restores authoritative board state without forcing a full reload

### Agent Epsilon — competition UX and player confidence

#### Objective

Make the experience trustworthy under pressure.

#### Deliverables

- visible connection and sync status
- startup and reconnect messages with recovery actions
- stronger turn ownership cues
- clearer host permission cues in lobby and match contexts
- cleaner score, status, and failure communication

#### Acceptance criteria

- a new player can identify whether it is their turn immediately
- a reconnecting player can tell whether the game is resyncing or broken
- a host can tell which controls are exclusive and why

## File-level implementation map

This section is the missing layer the first draft did not spell out clearly
enough.

### Slice 1 — runtime stabilization

Primary target files:

- `index.html`
- `game.js`
- `welcome.js`
- docs that currently describe the wrong runtime truth

Expected effect:

- runtime ambiguity removed
- official module loading path established

### Slice 2 — startup contract and loading-state hardening

Primary target files:

- `src/ui/MenuNavigation.js`
- `dots-and-boxes-game.js`
- `ui-manager.js`
- `convex-client.js`

Expected effect:

- game shell and authoritative state handshake become separated concerns
- loading skeleton behavior becomes deterministic
- startup timeout and recovery UX become possible

### Slice 3 — multiplayer reliability and reconciliation

Primary target files:

- `convex-client.js`
- `convex/games.ts`
- `convex/rooms.ts`
- `src/ui/MenuNavigation.js`

Expected effect:

- stronger subscription lifecycle
- cleaner reconnect logic
- stricter move validation and duplicate handling

### Slice 4 — Playwright environment

Primary target files:

- `package.json`
- Playwright config file
- new `tests/e2e/` suite
- helper fixture files

Expected effect:

- browser-level confidence for every high-risk online flow

### Slice 5 — security and UX completion pass

Primary target files:

- `convex-client.js`
- backend Convex mutations
- UI rendering helpers
- styles and text feedback paths

Expected effect:

- safer inputs
- clearer player feedback
- competition-grade operational polish

## Playwright environment specification

### Recommendation

Use `@playwright/test` with a multi-project setup.

### Minimum projects

1. `chromium`
2. `firefox`
3. `webkit`
4. optional `chromium-slow-network`

### Reporters and artifacts

Required:

- HTML report
- trace on first retry
- screenshot on failure
- video on retry for multiplayer specs

### Test topology

Recommended structure:

- `tests/e2e/smoke.spec.*`
- `tests/e2e/lobby.spec.*`
- `tests/e2e/loading-state.spec.*`
- `tests/e2e/multiplayer-sync.spec.*`
- `tests/e2e/reconnect.spec.*`
- `tests/e2e/security-inputs.spec.*`
- `tests/fixtures/multiplayer.fixture.*`
- `tests/fixtures/network.fixture.*`
- `tests/utils/console-capture.*`
- `tests/utils/match-helpers.*`

### Required browser scenarios

#### Smoke

- homepage loads
- no blocking boot errors in console
- local play starts
- loading skeleton disappears correctly

#### Lobby lifecycle

- host creates room
- guest joins room
- ready state toggles correctly
- host-only settings are enforced
- game start transitions both clients correctly

#### Match startup

- both clients receive the first authoritative board state
- loading UI disappears only after that state is applied
- startup timeout produces visible recovery controls when handshake fails

#### Match sync

- turn ownership updates on both clients
- a line drawn by one player appears on the other client
- square completions update scoreboards consistently
- duplicate move attempts are rejected without UI corruption

#### Reconnect and resilience

- guest disconnects and returns
- state resubscribes and reconciles
- host leaves in lobby and role transfer remains coherent
- degraded connection does not strand the UI in an unknowable state

#### Security and hardening

- player name XSS payload remains inert
- oversized names do not break layout or crash join flow
- malformed move requests fail cleanly
- invalid room codes produce stable UI feedback

### Monitoring hooks to include

The Playwright environment should collect:

- console errors
- failed network requests
- startup handshake duration
- loading skeleton visible duration
- reconnect attempt count when applicable

## Operational targets

These are target thresholds for the competition branch.
They are not measurements from this session.
They are shipping goals.

### Startup and sync targets

- first meaningful screen paint: fast and non-blocking
- loading skeleton never remains indefinitely without recovery UI
- startup handshake timeout should fail visibly rather than silently
- reconnect should either recover the session or offer a clear exit path

### Product quality targets

- zero uncaught boot errors in the browser console during smoke path
- no silent online match freeze in the supported path
- no known reproducible duplicate-move desync remaining in the approved build

### Test targets

Minimum browser-level must-pass set before competition build:

- smoke
- lobby lifecycle
- loading-state regression
- multiplayer sync happy path
- reconnect happy path
- XSS/input hardening smoke path

## Delivery plan

## Phase 1 — approval gate

Deliverable:

- this roadmap

Exit rule:

- no gameplay or backend production code changes until user approval

## Phase 2 — runtime stabilization

### Scope

- fix module loading truth
- define official runtime shell
- update docs to match reality

### Success criteria

- app boots through one documented runtime path
- no classic-script/module contradiction remains
- zero-build deployment remains intact

## Phase 3 — startup state machine and loading-state remediation

### Scope

- separate game-shell initialization from authoritative match readiness
- keep loading UI until first authoritative state is applied
- add timeout and recovery path

### Success criteria

- no silent infinite loading on approved startup path
- startup failures become diagnosable and recoverable

## Phase 4 — multiplayer reconciliation and reliability

### Scope

- harden subscriptions
- improve reconnect behavior
- validate move ordering and duplicate handling

### Success criteria

- two-client sync remains consistent in tested path
- reconnect behaves predictably

## Phase 5 — Playwright environment and regression gates

### Scope

- add E2E coverage and artifact collection
- cover startup, sync, reconnect, and security smoke paths

### Success criteria

- critical online regressions become automation-detectable
- preview environment can be smoke-validated before release

## Phase 6 — security and UX completion pass

### Scope

- input validation
- safer rendering
- connection and sync status UX
- turn and host clarity

### Success criteria

- safer inputs
- clearer player confidence signals
- no obvious tournament-hostile failure messaging remains

## Go / no-go criteria for competition deployment

The competition build should be **no-go** if any of the following remain true:

- runtime entrypoint behavior is still ambiguous
- online match start can freeze without visible recovery
- duplicate moves can still desync clients in reproducible tests
- reconnect path is untested
- browser console shows boot-time exceptions in smoke flow
- player-supplied text can still execute markup or break core UI

The competition build becomes **go** only when:

- the runtime contract is singular and documented
- startup handshake is deterministic
- reconnect and loading-state regressions are covered in Playwright
- core abuse and input hardening is in place
- UX communicates sync state, turn ownership, and failure recovery clearly

## Risks and mitigation

- **Risk: Over-refactoring under deadline**
  - Mitigation: freeze broad architecture cleanup until after runtime
    stabilization and test scaffolding.
- **Risk: Fixing sync bugs without browser automation**
  - Mitigation: add Playwright before deep multiplayer changes spread.
- **Risk: Static no-build deployment constrains options**
  - Mitigation: prefer browser-native module fixes over toolchain churn.
- **Risk: Security hardening causes UI regressions**
  - Mitigation: pair hardening work with browser-level input tests.
- **Risk: Preview environment diverges from local assumptions**
  - Mitigation: require preview smoke validation before competition use.

## What changed from the first roadmap draft

This revised document makes several stronger calls:

- it recommends a specific runtime path instead of presenting broad options
- it explicitly says **do not do a full refactor first**
- it introduces a file-level implementation map
- it defines a startup contract and state machine expectation
- it defines go/no-go deployment criteria
- it frames Playwright as a required safety net, not an optional enhancement

That is the correct posture for productionizing a strong prototype under
competition constraints.

## Approval gate

**Stop here for review.**

If this roadmap is approved, implementation should begin with:

1. runtime stabilization
2. startup state-machine and loading-state hardening
3. Playwright scaffolding
4. multiplayer reconciliation hardening
5. security and UX completion pass

No production code changes should be made before explicit approval.
