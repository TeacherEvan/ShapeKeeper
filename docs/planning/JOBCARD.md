# ShapeKeeper Development Jobcard

## Session: March 9, 2026

### Executive status

- **Phase addressed:** Phase 3 — startup state-machine and loading-state hardening
- **Status:** In progress, with the first meaningful hardening slice completed
- **Outcome:** multiplayer startup now has explicit client-side state control,
  first-authoritative-state gating, timeout recovery UI, and unit coverage for
  the startup controller
- **Competition impact:** reduces the risk of silent static loading during live
  match startup and gives the runtime a more diagnosable recovery path

### Release posture

- **Current recommendation:** **No-go** for competition deployment
- **Why:** startup hardening has begun, but the release still lacks full
  two-client startup validation, reconnect coverage, browser automation, and
  security/input completion work required by the roadmap.
- **Earliest realistic go condition:** after the remaining Phase 3/4 work and
  Phase 5 critical criteria are met on the approved browser path.

### Focus

Phase 3 startup handshake hardening for the competition roadmap, plus updated
runtime guidance and planning notes.

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
- **Docs refresh:** `.github/copilot-instructions.md` is being updated to match
  the current Phase 3 runtime reality.

### Files changed

- `src/ui/MultiplayerStartup.js`
- `src/ui/MultiplayerStartup.test.js`
- `src/ui/MenuNavigation.js`
- `dots-and-boxes-game.js`
- `index.html`
- `styles.css`
- `.github/copilot-instructions.md`
- `docs/planning/JOBCARD.md`

### Verification completed

- **`npm run verify`** — passed
- **`npm test`** — passed (`18` tests)
- **Browser boot over local HTTP** — passed on a fresh local origin
- **Startup recovery DOM** — present in browser validation
- **Create-room to lobby path** — passed in browser validation

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

### Remaining risks

- Two-client startup has not yet been browser-automated or validated as a
  full host/guest handshake.
- Reconnect and desync recovery are improved structurally but not yet proven by
  end-to-end multiplayer automation.
- Browser automation coverage is still missing for boot, lobby, reconnect, and
  sync regressions.
- Security/input hardening work remains a later-phase requirement.

### Open blockers

1. No Playwright regression gate exists yet for startup timeout, retry, or
   reconnect behavior.
2. Two-player startup and recovery paths are not yet validated in automation.
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
  - build Playwright config and smoke coverage
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
- **Phase 4 — multiplayer reliability:** not started
- **Phase 5 — Playwright regression gates:** not started
- **Phase 6 — security and UX completion:** not started

### Recommendations

#### Immediate

1. Build a browser-level two-client check for host start, guest join, and first
  authoritative state arrival.
2. Extend the current startup controller to cover reconnect and resubscribe
  timing explicitly under degraded connection conditions.
3. Add structured validation for the timeout and retry controls so they become
  machine-detectable regressions.

#### Near-term

1. Add Playwright smoke coverage for homepage boot, local play start, lobby
  create/join, loading-state timeout, and retry regression.
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
- Browser module caching on the original local origin obscured one validation
  pass; a fresh local origin confirmed the updated runtime path and recovery DOM.
- Current validation proved clean browser boot and lobby entry, but not yet a
  full automated host/guest gameplay handshake.

### Next steps

#### P0

1. Add Playwright coverage for the startup timeout, retry action, and recovery
  exit path.
2. Validate a two-player host/guest startup path so the first-authoritative-state
  handshake is exercised beyond single-client smoke checks.
3. Extend startup/reconnect handling so desync and resubscribe paths are
  verified under network disruption, not just coded structurally.

#### P1

1. Build the broader Playwright configuration and smoke suite for runtime
  startup and multiplayer sync.
2. Add reconnect and desync regression coverage with failure artifacts.
3. Review player-controlled text rendering and input validation for Phase 6
  hardening prep.

### Summary

Phase 3 startup hardening has now started meaningfully. ShapeKeeper has a
dedicated multiplayer startup controller, first-authoritative-state gating,
timeout recovery UI, and unit tests for the startup-state core. Local verify,
tests, and browser validation passed. The next milestone is to turn this
structural hardening into browser-automated, two-client proof for startup,
retry, reconnect, and sync reliability.
