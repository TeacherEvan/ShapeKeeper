# ShapeKeeper Development Jobcard

## Session: March 9, 2026

### Executive status

- **Phase addressed:** Phase 5 — browser regression gates, building on the Phase
  3 startup hardening slice
- **Status:** In progress, with the first practical browser automation slice now
  completed and validated
- **Outcome:** ShapeKeeper now has Playwright scaffolding, browser smoke
  coverage, startup timeout/retry/leave coverage, and a two-client host/guest
  startup test that exercises first-authoritative-state arrival on both clients
- **Competition impact:** startup and recovery behavior is no longer only a
  structural code claim; the approved browser path now has machine-detectable
  regression coverage for smoke boot, timeout recovery, and host/guest startup

### Release posture

- **Current recommendation:** **No-go** for competition deployment
- **Why:** the first browser-level regression gate now exists, but reconnect,
  desync, multiplayer sync, and security/input hardening coverage are still
  incomplete, and Phase 4 reliability work remains unproven in automation.
- **Earliest realistic go condition:** after the remaining Phase 3/4 work and
  Phase 5 critical criteria are met on the approved browser path.

### Focus

Phase 5 regression-gate startup for the competition roadmap, plus runtime doc
refresh and a first two-client startup proof on the approved browser path.

### Quality checkpoint

- The documentation now matches the verified browser/runtime state more closely
  than before.
- The roadmap is still strategic, but it now needs to be read alongside the
  current execution checkpoint rather than as a frozen pre-implementation note.
- Browser automation is already acting as an architecture audit tool, not just
  a QA wrapper.

### Work completed

- **Startup state machine slice:** added `src/ui/MultiplayerStartup.js` to own
  multiplayer startup phases, timeout lifecycle, retry tracking, and reset
  behavior.
- **Handshake gating:** multiplayer game boot now keeps the loading skeleton
  visible until the first authoritative game state is applied successfully.
- **Recovery UI:** `index.html` and `styles.css` now surface startup status
  copy, timeout messaging, and recovery actions (`Retry Sync`, `Leave Match`).
- **Flow orchestration:** `src/ui/MenuNavigation.js` now owns explicit room/game
  subscription wiring, startup teardown, and connection-state-aware recovery.
- **Game-shell fix:** `dots-and-boxes-game.js` no longer hides the loading
  skeleton unconditionally during multiplayer startup.
- **Test coverage:** added unit tests for the startup controller covering first
  authoritative state success, timeout failure, and retry/reset behavior.
- **Playwright foundation:** added `playwright.config.js`, browser test scripts,
  and generated-artifact ignore rules for the no-build runtime.
- **Smoke gate:** added a Playwright smoke test that boots the real browser
  entrypoint and checks the main menu path for blocking browser errors.
- **Startup recovery gate:** added a browser regression test for startup timeout,
  retry sync, and leave-match recovery using the loading overlay contract.
- **Shared multiplayer fixture:** added a shared browser-side mock backend for
  Playwright that synchronizes room and game state across host and guest pages.
- **Two-client startup proof:** added a host-create / guest-join / both-ready /
  host-start browser test that verifies both clients reach `in_match` through
  first-authoritative-state application.
- **Runtime bug fixes discovered by automation:** corrected `src/ui/MenuNavigation.js`
  to call `updatePopulateButtonVisibility()` and `updateUI()` through
  `game.uiManager`, where those helpers actually live.
- **Docs refresh:** updated `.github/copilot-instructions.md` and this jobcard
  to match the current runtime and QA posture.

### Files changed

- `playwright.config.js`
- `tests/e2e/helpers/bootstrap.js`
- `tests/e2e/smoke.spec.js`
- `tests/e2e/loading-state.spec.js`
- `tests/e2e/multiplayer-startup.spec.js`
- `package.json`
- `vitest.config.js`
- `src/ui/MultiplayerStartup.js`
- `src/ui/MultiplayerStartup.test.js`
- `src/ui/MenuNavigation.js`
- `dots-and-boxes-game.js`
- `index.html`
- `.github/copilot-instructions.md`
- `docs/planning/JOBCARD.md`

### Verification completed

- **`npm run verify`** — passed
- **`npm test`** — passed (`18` tests)
- **`npm run test:e2e`** — passed (`3` Playwright specs)
- **Browser boot over local HTTP** — passed on a fresh local origin
- **Startup recovery DOM** — present and asserted in browser validation
- **Create-room to lobby path** — passed in browser validation
- **Two-client host/guest startup path** — passed in Playwright validation

### Decisions made

- Keep the competition branch on browser-native ES modules with no bundler.
- Treat root runtime files as authoritative for gameplay and boot flow.
- Treat active `src/ui/` modules in the `welcome.js` path as production runtime
  code, not speculative refactor space.
- Keep multiplayer startup state orchestration centralized in
  `src/ui/MultiplayerStartup.js` rather than scattering startup flags across UI
  code.
- Prefer explicit subscription ownership and teardown over implicit globals when
  hardening multiplayer startup and reconnect behavior.
- Prefer stable `data-testid` hooks and observable startup-phase attributes over
  brittle DOM-shape assertions in browser automation.
- Use browser automation as a runtime correctness check, not just a QA nicety;
  the first two-client spec already exposed real production-path method-call
  bugs that unit tests and syntax checks did not catch.

### Remaining risks

- Reconnect and desync recovery are improved structurally but not yet proven by
  browser automation.
- Browser automation now covers smoke, startup recovery, and host/guest startup,
  but it still lacks multiplayer sync, reconnect, lobby edge cases, and input
  hardening scenarios.
- The current shared browser-side multiplayer fixture proves startup behavior,
  but not yet live move propagation, duplicate rejection, or host-leave role
  transfer behavior.
- Security/input hardening work remains a later-phase requirement.

### Open blockers

1. Reconnect, desync, and resubscribe flows are not yet covered in Playwright.
2. Live multiplayer move propagation and duplicate-move handling are not yet
   validated in browser automation.
3. Go/no-go deployment criteria from the roadmap are not yet satisfied.

### Workstream ownership

- **Agent Alpha — Architecture**
  - maintain the runtime contract
  - keep root runtime files authoritative
  - prevent entrypoint ambiguity from returning
- **Agent Beta — Research & Security**
  - harden player-controlled input handling
  - review session identity strategy and mutation abuse controls
  - define safe rendering expectations for UI updates
- **Agent Gamma — QA Automation**
  - expand the new Playwright foundation into reconnect, sync, and security
    regression gates
  - add artifact capture for failures and reconnect scenarios
  - establish browser-level regression gates before competition release
- **Agent Delta — Netcode**
  - implement startup state machine and first-state handshake
  - add recovery path for loading-state timeout
  - harden reconnect, subscription lifecycle, and desync handling
- **Agent Epsilon — UX/UI**
  - surface connection/sync state clearly
  - improve recovery messaging and turn ownership cues
  - make host-only controls and failure states obvious under pressure

### Phase completion snapshot

- **Phase 1 — approval artifact:** complete
- **Phase 2 — runtime stabilization:** started, first slice complete
- **Phase 3 — startup/loading hardening:** started, first slice complete
- **Phase 4 — multiplayer reliability:** not started, but now partially
  unblocked by two-client browser startup coverage
- **Phase 5 — Playwright regression gates:** started, first slice complete
- **Phase 6 — security and UX completion:** not started

### Recommendations

#### Immediate

1. Add reconnect and resubscribe browser coverage using the new shared
  multiplayer fixture as the base.
2. Add multiplayer sync assertions for move propagation, turn ownership, and
  duplicate rejection across host and guest clients.
3. Keep using browser automation to flush out production-path object ownership
  and runtime call mismatches in `src/ui/MenuNavigation.js` and adjacent active
  runtime modules.
4. Update strategic docs whenever a roadmap assumption becomes stale, especially
   around runtime loading facts and current QA posture.

#### Near-term

1. Expand Playwright coverage to lobby lifecycle edges, reconnect happy-path,
  and desync recovery.
2. Add multiplayer sync and reconnect regression coverage before deepening
  further netcode changes.
3. Continue removing implicit globals from the active runtime only when they are
  encountered in the supported boot path.

#### Strategic

1. Use the roadmap go/no-go criteria as the release gate for competition builds.
2. Avoid merging Phase 3+ work without browser-level regression coverage.
3. Keep the no-build deployment model unless a future change proves it is the
  bottleneck rather than the runtime contract.

### Notes

- The repository remains hybrid, but the runtime contract is now clearer:
  `index.html` loads `convex-client.js` as a classic script and loads
  `game.js` and `welcome.js` as browser ES modules.
- `src/` is not fully inactive. `welcome.js` currently depends on active
  `src/ui/` modules.
- The Phase 3 slice introduced a dedicated startup controller in active
  `src/ui/` code, but it remains part of the approved runtime path through
  `welcome.js`.
- The first Phase 5 slice now adds Playwright coverage on the real browser
  entrypoint without changing the no-build deployment model.
- A shared browser-side multiplayer fixture now exists for host/guest browser
  automation, which should be reused for reconnect and sync scenarios rather
  than creating one-off mocks per spec.
- The first two-client startup spec exposed two real runtime bugs in
  `src/ui/MenuNavigation.js`, confirming that browser-level startup coverage is
  already paying for itself.
- The roadmap previously contained stale runtime-loading and QA-state details;
  those have now been refreshed so strategy and execution are back in sync.

### Next steps

#### P0

1. Add Playwright reconnect and resubscribe coverage using the two-client
  browser fixture.
2. Add host/guest move propagation and duplicate-move regression coverage so
  Phase 4 reliability work has a browser safety net.
3. Extend startup/reconnect handling so desync and resubscribe paths are
  verified under network disruption, not just coded structurally.

#### P1

1. Add lobby lifecycle edge-case coverage, including host-only controls and
  host-leave behavior.
2. Add reconnect and desync regression coverage with failure artifacts.
3. Review player-controlled text rendering and input validation for Phase 6
  hardening prep.

### Summary

ShapeKeeper now has the first meaningful Phase 5 regression-gate slice on top
of the Phase 3 startup hardening work. The repo has Playwright configuration,
browser smoke coverage, startup timeout/retry/leave coverage, and a validated
two-client host/guest startup flow. Full verify, unit tests, and browser tests
passed. The next milestone is to extend this shared browser harness into
reconnect, desync, and live multiplayer sync reliability coverage.
