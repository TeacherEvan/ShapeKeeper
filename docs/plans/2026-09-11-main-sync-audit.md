# ShapeKeeper Main Sync Audit — 2026-09-11

**Prepared:** 2026-09-11 (local time, Pretoria)  
**Branch audited from:** `main` at `73fc11f` (clean, up to date with origin)  
**Purpose:** identify what is still off-main and should be synced, and what is already there.

---

## 1. Executive summary

`main` is clean and current with `origin/main`. Most of the named feature work has already landed, but two classes of work are still off-main:

1. **Live lobby / silly passcode** — `feat/live-lobby-silly-passcode` is the genuinely active feature branch and pulls in opponent-tap UX plus grid-size lock and a sync handshake. It is ahead of main and worth a proper merge/rebaseline.
2. **Convex rooms/mutations refactor** — `feature/refactor/convex-games` restructures room and player mutations into `convex/mutations/` with tests. It is a structural improvement, not yet on main.

The lava timer and online sync resilience work is **already on main** through the #36–#41 PR chain (commits `3859c33` → `c0e1d29`). The branch `feat/lava-timer-online-sync` is an ancestor of main; its implementation files are byte-identical to what is on main.

The "transparent gameboard" wording does not map to a single feature branch or commit on this repo. The existing visual surface already uses transparent backgrounds in CSS and a layered canvas stack. If you are referring to a specific visual proposal (e.g., a glassmorphic board, a translucent overlay, a transparent dot/line theme variant, or a background-blending mode), that is not yet present as a discrete branch and should be treated as a new enhancement rather than a sync target.

---

## 2. Branch inventory and disposition

### 2.1 Already on main (no sync action needed)

These branches are ancestors of `main`:

- `copilot/optimize-party-mode-display` → merged as `f41621b` (party mode overhaul v4.3.0) and `a630a13`
- `copilot/optimize-turn-based-gameplay` → merged as `3e948b3`
- `copilot/overhaul-code-for-production` → merged as `ea29565`
- `copilot/refactor-code-for-production-grade` → merged as `4497f1d`
- `copilot/fix-party-mode-validation-error` → merged as `fdb4389`
- `copilot/investigate-party-prompts` → merged as `3f6baee`
- `copilot/update-party-mode-tiles` → merged as `8cc8f00`
- `copilot/toggle-hypotheticals-checkbox` → merged as `645f378`
- `copilot/update-documentation-reviews` → merged as `eaddf63`
- `copilot/update-all-dependencies` → merged as `b5508f7`
- `copilot/fix-backend-integration-error` → merged as `efb66b9`
- `copilot/debug-backend-problems` → merged as `51a1b61`
- `copilot/investigate-screenshot-issue` → merged as `3647ae0`
- `copilot/normal-vole` → merged as `6e15379`
- `fix/e2e-lint-formatting` — no commits ahead of main; effectively empty or already applied
- `feature/main-menu-cta-rename` — shipped via `565300e` and ancestors; CTA labels already live

### 2.2 Still off main (candidate sync targets)

#### Priority A — actively developed feature work

- **`feat/live-lobby-silly-passcode`**
  - Ahead of main by multiple commits.
  - Contains: opponent-tap mechanic (server schema + mutations), opponent-tap UX (click handler + visual feedback), multiplayer test coverage, grid-size lock + multiplayer sync handshake, and an auto-commit checkpoint.
  - This is the most live of the feature branches and the clearest candidate for merge/review.

#### Priority B — structural refactor, lower risk but worth reviewing

- **`feature/refactor/convex-games`**
  - Refactors room and player mutations out of `convex/games.ts` into `convex/mutations/` with dedicated tests.
  - Also moves `drawLine` mutation and adds integration-style tests.
  - Worth reviewing for merge if the team wants cleaner Convex boundaries; not a user-facing feature.

#### Stale / unclear / likely no-op

- **`v2/production-hardening`**
  - Contains `b19c2b4` which is a client-side fix for consuming server-computed `isHost`/`isYou`. That fix is already on main as `73fc11f`. The rest of this branch is docs/audit scaffolding (`d761314`) and a per-session rate-limit commit (`b19c2b4`'s parent chain). Most of its substance appears to already be on main or superseded.
  - Recommend a direct diff review before merging anything; do not assume it is a clean superset.

- **`alert-autofix-1`, `alert-autofix-2`, `alert-autofix-3`**
  - No commits ahead of main. Appear empty or already integrated. Treat as no-op unless a specific alert payload is attached.

- **`copilot/` investigation branches that are not listed above**
  - Several `copilot/` branches are already merged. Any remaining unlisted ones should be checked individually, but the current remote list does not show other active feature branches beyond the two in 2.2.

---

## 3. What is already on main (so you do not re-sync it)

### 3.1 Lava timer + online sync resilience

On main via PRs #36, #39, #40, #41:

- Constants: `LAVA_*` constants, `FEATURE_FLAGS` (`FEATURE_LAVA_TIMER`, `FEATURE_SYNC_RESILIENCE`), and `TIMING_CONSTANTS` are present in `constants.js`.
- Implementation files present and identical to the lava branch:
  - `renderer/lava-timer.js`
  - `src/timing/turn-clock-controller.js`
  - `src/timing/clock-sync.js`
  - `particle-system/lava-particles.js`
  - `local-save-replay.js`
- Tests present:
  - `tests/lava-particles.test.js`
  - `tests/lava-renderer.test.js`
  - `tests/client-sync-integration.test.js`
  - `tests/clock-sync.test.js`
  - `tests/online-snapshots.test.js`
  - `tests/e2e/lava-timer-online-sync.spec.js`
- Feature flags default **OFF**; enabled at runtime via `window.FEATURE_LAVA_TIMER` / `window.FEATURE_SYNC_RESILIENCE`.
- The branch `feat/lava-timer-online-sync` tip is `4de3e78`; main's lava commits include that work plus follow-ups for wiring, testing, and defaulting the feature on. In other words, main is ahead of that branch for lava, not the other way around.

### 3.2 Visual and UX surface already shipped

The following are already on main and contribute to the current "gameboard look":

- Line draw animation, screen shake, invalid line flash, dot hover preview (`89e2039`)
- Dark mode dot colors and canvas background reading theme state (`d5013b1`, `6d1a458`)
- CSS layering with transparent backgrounds across `game.css`, `lobby.css`, `base.css`, `winner.css`, `toast.css`, `interactions.css`, and the blueprint grid styles
- Party mode CSS/UX polish (`13e595b`) and broader visual enhancements from the production-grade copilot branches
- README visual-enhancements detail (`b2a18dd`, `82c769f`)

If "transparent gameboard" means one of those already-shipped pieces, it is already on main. If it means something more specific, see section 6.

---

## 4. Recommended sync order

### Step 1 — Merge `feat/live-lobby-silly-passcode`

This is the most concrete off-main feature branch.

Before merging:

- Rebase or merge onto current `main` to resolve any drift.
- Run the existing test + lint gates:
  - `npm run lint`
  - `npm run test`
  - `npm run build` if there is a build step
- Pay attention to the lobby/multiplayer handshake and grid-size lock behavior, since those touch live game setup.
- Confirm the opponent-tap UX is intentional for the current product direction (it is multiplayer-facing and may need design sign-off).

### Step 2 — Review `feature/refactor/convex-games`

This is a structural change. Before merging:

- Verify the new `convex/mutations/` layout does not break existing Convex deployment or generated types.
- Check that tests actually run and cover the extracted mutations.
- Confirm there is no duplication with existing mutation paths still left in `convex/games.ts`.

If the team prefers to keep `convex/games.ts` as the facade and is happy with the extracted mutations, this can be merged after review. If it is exploratory, it can also be left as a reference branch.

### Step 3 — Decide on `v2/production-hardening`

Do not merge blindly. Diff it against main and extract only the pieces that are genuinely missing. Most of its visible content appears to already be on main.

### Step 4 — Clear the stale branches

Once the above are resolved, remove or close branches that are no longer needed:

- `alert-autofix-1/2/3` if confirmed empty
- `fix/e2e-lint-formatting` if confirmed no-op
- Any merged `copilot/` branches still present on the remote that are fully superseded

This is optional but reduces branch noise.

---

## 5. Test and safety checklist for any merge

For each merge into `main`:

1. Start from a clean working tree.
2. Pull latest `origin/main`.
3. Merge or rebase the candidate branch.
4. Resolve conflicts with the concrete code, not with assumptions.
5. Run lint and tests.
6. Run a build if the project has one.
7. If the change touches multiplayer/Convex, note that backend deployment is a separate step and not covered by local tests alone.
8. If the change touches the lobby or game setup flow, verify the startup path manually or via existing E2E where possible.

---

## 6. "Transparent gameboard" — clarification needed

There is no branch or commit on this repo that clearly corresponds to a discrete "transparent gameboard" feature.

Current relevant surface:

- Canvas-based game rendering with layered drawing order.
- CSS already uses transparent backgrounds in several places.
- Blueprint theme grid styling uses transparent grid-line gaps.

Possible interpretations and what they would mean:

- **Translucent/glassmorphic board styling:** a new CSS/theme enhancement, not yet on main.
- **Dot/line transparency or blend mode:** a rendering change, possibly in `renderer.js` or the relevant canvas draw path.
- **Background compositing / transparent game-area backdrop:** a layout + canvas-background change.
- **A specific prior proposal or screenshot:** would need the original reference to map it to code.

If you can point to the exact visual you mean — a screenshot, a prior message, a design note, or a specific behavior — I can map it to the relevant files and either find the branch that has it or write a concrete implementation plan for it.

---

## 7. Rough workload estimate

- **`feat/live-lobby-silly-passcode` merge:** medium effort. Mostly integration review, conflict handling, and multiplayer/lobby verification.
- **`feature/refactor/convex-games` merge:** low-to-medium effort if accepted as-is; mainly review and test verification.
- **`v2/production-hardening` triage:** small effort for diff review; only merge the genuinely missing bits.
- **Transparent gameboard:** unknown until the target visual is defined; could be small CSS work or a larger rendering change.

---

## 8. Suggested next action

If you want me to proceed now, the most useful first move is:

1. Confirm whether `feat/live-lobby-silly-passcode` is a go for merge.
2. Confirm whether `feature/refactor/convex-games` is wanted.
3. Describe the "transparent gameboard" you have in mind, or tell me it was a reference to already-shipped visual work.

If you want, I can also write a separate implementation plan for the transparent gameboard once you define it, and save it under `docs/plans/` alongside the other planning documents.

---

*Saved to `docs/plans/2026-09-11-main-sync-audit.md`.*
