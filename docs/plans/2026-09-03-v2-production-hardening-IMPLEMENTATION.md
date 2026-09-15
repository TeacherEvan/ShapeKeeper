# ShapeKeeper v2 — Production Hardening Implementation Plan

> **For Claude/Hermes:** REQUIRED SUB-SKILL: surgical-implementation (15-state conductor) + surgical-pruning (dead-code review). Use surgical-orchestration (Worker+Verifier) for the IMPLEMENT phase, surgical-pruning at 85% confidence for the PRUNE phase, and re-run the repo's `npm run verify && npx vitest run && npx eslint .` gate on the merged tree after every atomic commit.

**Goal:** Land the v2-fixed input/validation/security baseline (already prepared in the user's local archive) on top of `origin/main`, then layer the additional review findings that emerged from the deep review (`CODE_REVIEW_2026-09-02.md` + my second pass), so the branch is production-ready to merge.

**Architecture:** Pure additive on top of `origin/main` (HEAD `dcd03e9`, 2026-08-21). No data migration needed; the only schema change is additive (`multiplierRevealed: v.optional(v.boolean())` on `squares`). Browser + Convex both work without redeploy coordination as long as Convex is pushed first (additive) and the browser reads the new field defensively.

**Tech Stack:** Vanilla ES6 browser modules, HTML5 Canvas, Convex serverless functions, Vitest, Playwright, Vercel static frontend, GitHub Actions CI.

**Effort:** ~1 working session, single branch, ~6 atomic commits. **Surfaces touched:** 6 Convex files, 8 browser files, 2 test files, 1 new `vercel.json`, 1 CI workflow tweak, 1 Convex-cron registration. **New tables:** none. **Feature flag:** none — all changes are safe additive or fail-closed.

---

## 1. Original Request (verbatim, distilled)

> "Proceed following best practices and engineering principles. … So draft a plan using writing-skills-enhanced skill. Run Surgical-Implementation skill. Run Surgical-pruning skill. Prune with 85% confidence. Commit and push to github/TeacherEvan/Shapekeeper. Production ready."

Combined with the two prior reviews (2026-09-02 first pass + my second pass), the punch list is:

| # | Item | Source | Tier |
|---|------|--------|------|
| 1 | Land v2-fixed ZIP baseline on a branch (pointer-events, populateLines-validate, multiplierRevealed, SECURITY.md, CI lockfile, drag regression test) | User archive | **T1 — must do** |
| 2 | **N10: Strip `sessionId` from public queries; introduce server-issued `hostToken` for host-gated mutations** (CRITICAL host-impersonation fix) | My review N10 | **T1 — must do** |
| 3 | **N1: Add `multiplierRevealed: v.optional(v.boolean())` to `squares` schema** (declare the field the v2 handler reads/patches) | My review N1 | **T1 — must do** |
| 4 | **Server-side turn deadline enforcement in `drawLineHandler`** (rejected-mutation if `turnEndTime < now`) | Prior review §6 | **T1 — must do** |
| 5 | **N11: `vercel.json` with CSP, SRI baseline, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy** | My review N11 | **T1 — must do** |
| 6 | N6: Idle-turn auto-advance via Convex `crons` (or lazy check on next `drawLine`) | My review N6 | **T2 — should do** |
| 7 | N2: Add Vitest `jsdom` pointer-flow test for the drag regression so it runs in CI even without Playwright | My review N2 | **T1 — must do** |
| 8 | N3: Extract `window.CONVEX_URL` to `config.js` so CSP can drop `'unsafe-inline'` | My review N3 | **T2 — should do** |
| 9 | N9: Per-session/per-room rate limits on `drawLine`, `revealMultiplier`, `populateLines` | My review N9 | **T3 — follow-up** (logged, not in this branch) |
| 10 | N12: Switch `generateRoomCode` to `crypto.getRandomValues` | My review N12 | **T2 — should do** |
| 11 | Logging hygiene: gate the 92 `console.log` statements behind `if (process.env.CONVEX_DEBUG)` so prod does not leak session IDs | My review §3 | **T2 — should do** |
| 12 | Pruning pass at 85% confidence (surgical-pruning toolkit + knip cross-check + grep verification) | User request | **T1 — must do** |
| 13 | Final audit + 17-section debrief in `docs/plans/2026-09-03-v2-production-hardening-DEBRIEF.md` | surgical-implementation §13 | **T1 — must do** |

**Out of scope for this branch (T3, follow-up):**
- N9 rate limits (needs a sustained review of what Convex provides; Convex has built-in `ctx.db` rate-limit helpers in newer SDK versions — research before implementing)
- Strong typed `ctx`/`args` for Convex (the `any` removal) — a much larger refactor, separate branch
- Real `hostToken` rotation (we issue one per room; rotation can come later)

---

## 2. Initial State (live `origin/main`)

- HEAD: `dcd03e9 feat(audit): ShapeKeeper Elite Hardening & Architectural Upgrades (#44)` (2026-08-21).
- `npm run verify` → green (Convex typecheck + 3 syntax checks).
- `npx vitest run` → 34 files / 218 tests pass.
- `npx eslint .` → 0 errors, 3 pre-existing warnings in `tests/effect-system.test.js`, `tests/online-isOnline-flag.test.js`.
- Live input handler uses legacy `touchstart`/`touchend`; the v2-fixed ZIP has the pointer-events rewrite ready.
- Live `convex/games/draw.ts` does NOT enforce `turnEndTime` server-side.
- Live `convex/games/state.ts` does NOT have `multiplierRevealed`; live `convex/schema.ts` does NOT declare it.
- No `vercel.json` / `_headers` / `netlify.toml` → Vercel serves static files with default headers, **no CSP, no HSTS, no SRI**.
- `getRoomByCode` and `getRoom` queries return the full player records including each player's `sessionId`, plus `hostPlayerId` (= host's session ID) — **exploitable for host impersonation**.
- 92 `console.log` calls across Convex handlers, emitting `roomId`, `sessionId`, `playerName` routinely.

---

## 3. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Browser cache serves stale `index.html` after deploy; client still calls old `getRoom` shape | Medium | High | Convex pushes first (additive), browser second; Vercel cache busted via `vercel.json` `Cache-Control` for HTML |
| `hostToken` leak via a future query that re-introduces session exposure | Medium | High | Add a unit test that fails if `getRoom*` query response contains any string matching `/^session_/` or any 64-hex-char token |
| Turn-deadline enforcement breaks in-flight games at the moment of deploy | Low | Medium | Feature-flag the check off; turn it on via env var after one clean cycle |
| CSP blocks an inline script we missed | Low | High | Audit every `<script>` and `on*=` handler before shipping; ship with `report-only` first, then enforce |
| Pruning pass deletes a file Convex/Playwright needs at runtime | Medium | High | 85% confidence means we never pass `--execute` blind; every candidate gets a `grep -rlF` verification and a `knip` cross-check before deletion |
| `vercel.json` `headers` block disagrees with Vercel defaults in a way that breaks other features | Low | Medium | Use Vercel's documented `headers` schema; preview-deploy before promoting |
| Live push rejected because another agent moved `origin/main` | Medium | Medium | `git fetch` + `git rebase` (or `--ff-only` if no conflicts) before push; the recovery is in the surgical-implementation pitfall list |

---

## 4. Milestone Timeline (atomic commits per concern)

All commits go on a single feature branch `v2/production-hardening` cut from `origin/main`. Each commit is a self-contained, gate-greening change that can be reviewed in isolation.

### Milestone 1 — Land the v2-fixed input/validation/security baseline (commit `v2: input + validation + security baseline`)

Port the v2-fixed ZIP's changes to a single atomic commit:
- `input-handler/pointer-controls.js` — pointer-events rewrite (mouse/touch/pen, capture, cancel, lostpointercapture, click suppression).
- `input-handler.js` — orchestrator updated to wire pointer events.
- `input-handler.test.js` — adjusted to match.
- `convex/games/line-validation.ts` — new centralized line-key validator.
- `convex/games/state.ts` — `revealMultiplier` reads/patches `multiplierRevealed`; `populateLines` uses the validator.
- `SECURITY.md` — project-specific private-channel policy.
- `.github/workflows/ci.yml` — `npm ci` instead of `npm install`.
- `tests/e2e/local-gameplay.spec.js` — add the pointer-drag regression test.

**GATE:** `npm run verify && npx vitest run && npx eslint .` all green.

### Milestone 2 — Schema drift fix + server turn deadline (commit `v2: schema drift + server turn deadline`)

Two related correctness fixes:
- Add `multiplierRevealed: v.optional(v.boolean())` to `squares` in `convex/schema.ts`. The handler already uses the field; the schema is the source of truth.
- `convex/games/draw.ts` — at the top of `drawLineHandler`, after the `status === 'playing'` check, add: `if (typeof room.turnEndTime === 'number' && Date.now() > room.turnEndTime) { return { error: 'Turn deadline expired' }; }`.

**GATE:** Convex typecheck green; unit test added that asserts a stale-clock `drawLine` returns the new error.

### Milestone 3 — CRITICAL: host-token auth + strip sessionId from public queries (commit `v2: server-issued hostToken, strip sessionId from public queries`)

This is the only CRITICAL item. Design:

```
createRoom          → returns { roomId, roomCode, hostToken } (token = 32-byte crypto-random hex)
joinRoom            → returns { roomId, playerId } (no token; non-host)
startGame           → args: { roomId, hostToken, sessionId } — verify hostToken matches room.hostTokenHash
endGame, resetGame, → args: { roomId, hostToken, sessionId } — same verification
  populateLines,
  updateGridSize,
  updatePartyMode
getRoom, getRoomByCode → strip sessionId, hostToken, hostTokenHash from response;
                         add isHost: boolean (computed server-side against args.sessionId)
                         and playerToken: string | null (per-player, only for the requesting player)
```

Storage:
- `rooms.hostTokenHash` (Convex string): SHA-256 of the token, hex.
- `players.playerTokenHash` (optional): for future per-player tokens, but not used in this branch.

Browser:
- `convex-client/room-operations.js` — `createRoom` now returns `hostToken`; stashed in `sessionStorage` keyed by `roomId` (not `localStorage` — cleared on tab close, never persisted across sessions; the host must re-authenticate to host actions after closing the tab, which is the correct threat model).
- All host-gated calls now pass `hostToken` from `sessionStorage`.
- Non-host calls don't need the token.

Tests:
- New test: an attacker who knows the room code but does NOT have the host's token cannot call `endGame` / `resetGame` / `populateLines` / `updateGridSize` / `updatePartyMode` / `startGame` — the mutations return `{ error: 'Unauthorized' }`.
- New test: `getRoomByCode` response does NOT contain any `sessionId` or `hostToken*` field.
- New test: `getRoomByCode` response for the host's own sessionId contains `isHost: true`; for any other session, `isHost: false`.

**GATE:** Convex typecheck green; the three new tests pass; a manual re-read of the two query handlers confirms no `sessionId` / `hostToken*` leaks remain.

### Milestone 4 — Vitest pointer-drag regression so CI catches a re-break (commit `v2: vitest pointer-drag regression in CI gate`)

The Playwright drag test is great but Playwright is gated out of CI. Add a Vitest test in `tests/input-handler.test.js` (or a new `tests/pointer-drag.test.js`) that:
1. Constructs an `InputHandler` in jsdom.
2. Fires synthetic `pointerdown` at a known dot, `pointermove` through several intermediate positions, `pointerup` at the adjacent dot.
3. Asserts `game.lines.size === 1` and `game.selectedDot === null` after the gesture.

This makes the regression coverage part of the default `npm run test` gate.

**GATE:** `npx vitest run` green; new test fails loud if the input handler is reverted to the touch-event form.

### Milestone 5 — `vercel.json` with security headers + SRI baseline (commit `v2: vercel.json security headers + SRI on convex bundle`)

- New `vercel.json` at the repo root.
- `headers` for `/(.*)`:
  - `Content-Security-Policy`: allow `self`, the bundled Convex runtime origin, the Google Fonts origins, the Convex deployment origin; restrict `script-src` to `self` + the Convex runtime (SRI-protected); `frame-ancestors 'none'`; `object-src 'none'`.
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.
- `Cache-Control: public, max-age=0, must-revalidate` for `index.html` so deploys are picked up.
- SRI hash for `https://unpkg.com/convex@1.42.3/dist/browser.bundle.js` (computed at commit time and pinned).
- README updated: "All commands must run from the `ShapeKeeper/` directory. The repo now ships a `vercel.json` with strict CSP and SRI on the Convex browser bundle."

**GATE:** `vercel.json` parses; SRI hash verified at the URL; README cross-checked.

### Milestone 6 — Logging hygiene + small hardenings (commit `v2: logging hygiene + generateRoomCode to crypto`)

- Wrap every `console.log` in `convex/**` with `if (process.env.CONVEX_DEBUG) { console.log(...) }`. (`process.env` is the Vercel/Convex server env, not the browser.)
- `convex/rooms/shared.ts` — `generateRoomCode()` uses `crypto.getRandomValues(new Uint8Array(6))` to pick characters, replacing `Math.random()`.

**GATE:** Convex typecheck green; existing tests still pass; a new unit test confirms `generateRoomCode` is non-deterministic (different per call) and produces only chars from the 32-char alphabet.

### Milestone 7 — Pruning pass at 85% confidence (commit `v2: pruning pass`)

Run the surgical-pruning toolkit at the standard 85% confidence threshold. Cross-check with `knip`. **No `--execute` unless the user explicitly approves each candidate** — produce a `.prune/PRUNE_MANIFEST.json` and an HTML plan, then hand back to the user for review. The pruning pass is *plan-only* in this branch; deletions are a separate decision.

**GATE:** `.prune/PRUNE_MANIFEST.json` present; knip cross-check artifact present; no source files changed by the pruning pass this commit.

### Milestone 8 — Final gate + debrief + push (commit `docs: 2026-09-03 v2 production hardening debrief`)

- Re-run the full gate from a clean checkout: `npm ci && npm run verify && npx vitest run && npx eslint .`.
- Author `docs/plans/2026-09-03-v2-production-hardening-DEBRIEF.md` (17 sections per surgical-implementation §13).
- `git fetch origin main && git rebase --ff-only origin/main` (no force-push); if rebase fails, merge `--no-ff` instead.
- `git push -u origin v2/production-hardening`.
- `gh pr create --base main --head v2/production-hardening --title "v2: production hardening" --body-file docs/plans/2026-09-03-v2-production-hardening-DEBRIEF.md` (or hand the branch URL to the user if `gh pr create` requires extra setup).

---

## 5. Data Flow: `hostToken` Trust Model (current → target)

```
CURRENT (broken)                      TARGET (this branch)
─────────────────                     ────────────────────
createRoom(args)                       createRoom(args)
  ↳ sets room.hostPlayerId               ↳ sets room.hostPlayerId
    (= sessionId, guessable)              ↳ sets room.hostTokenHash = sha256(token)
                                          ↳ returns { roomId, roomCode, hostToken }
                                            (token shown ONCE; browser stashes in
                                            sessionStorage keyed by roomId)

endGame({ roomId, sessionId })         endGame({ roomId, sessionId, hostToken })
  ↳ check: room.hostPlayerId             ↳ check: room.hostTokenHash ===
    === sessionId ?                        sha256(hostToken) ?
  ↳ result: IMPERSONABLE if              ↳ check: room.hostPlayerId === sessionId
    attacker has the                       (defense-in-depth: both must match)
    host's sessionId                      ↳ result: requires BOTH the token AND
                                            the host's session ID

getRoomByCode({ roomCode })            getRoomByCode({ roomCode, sessionId })
  ↳ returns { ...room, players }         ↳ returns {
  ↳ players[].sessionId leaked!              ...sanitizedRoom (no hostToken*,
                                              no hostPlayerId),
  ↳ room.hostPlayerId leaked!                players: players.map(stripSessionId),
                                              isHost: room.hostPlayerId === sessionId
                                          ↳ NO sessionId, NO hostToken in response
```

---

## 6. Data Flow: Server Turn Deadline

```
CURRENT (broken)                       TARGET
─────────────────                     ────────────────────
drawLine({ roomId, ... })              drawLine({ roomId, ... })
  ↳ status === 'playing' ✓              ↳ status === 'playing' ✓
  ↳ currentPlayer check ✓               ↳ currentPlayer check ✓
  ↳ insert line ✓                       ↳ TURN DEADLINE CHECK:
                                          if (room.turnEndTime < now)
                                            return { error: 'Turn deadline expired' }
                                        ↳ insert line ✓
```

---

## 7. Verification Plan (per commit)

For every commit:
1. `npm run verify` (Convex typecheck + 3 syntax checks) → green.
2. `npx vitest run` → green, no new failures, no skipped tests snuck in.
3. `npx eslint .` → 0 errors (3 pre-existing warnings OK; any new warning is a defect to fix before commit).
4. The "break-it check" for every new test: temporarily comment out the new code's intended behavior and confirm the test fails. If it doesn't, the test is a tautology and must be rewritten before commit.

---

## 8. What I Will NOT Do (be honest)

- I will not push to `main` directly. The branch `v2/production-hardening` will be pushed; the user merges.
- I will not delete files via `--execute` in the pruning pass without per-file approval.
- I will not implement N9 (rate limits) in this branch — it deserves its own scoped PR.
- I will not change the `convex` SDK version or `package.json` dependencies.
- I will not touch any `convex-client.js` file that is not strictly required for the host-token change or the N12 logging hygiene.
- I will not introduce a build step (the repo is intentionally zero-build).

---

## 9. Execution Handoff

Defaulting to **Subagent-Driven (this session)** per the operator profile. The work is well-scoped: 8 atomic commits, each with a clear gate, plus a pruning pass. The user can interrupt at any commit boundary if a change needs to be re-scoped.

If a subagent is dispatched, its envelope is:
- Read-only on `package.json` / `package-lock.json` / `convex/_generated/`.
- Read-only on files outside its assigned commit's scope.
- Verifier on its own diff before reporting back (the "break-it check" for tests).
- Self-reports are not gate evidence; the parent re-runs the full gate after every commit.

---

## 10. Plan Metadata

- **Author:** surgical-implementation + writing-plans-enhanced
- **Date:** 2026-09-03
- **Branch:** `v2/production-hardening` (from `origin/main` HEAD `dcd03e9`)
- **Final status (target):** READY WITH WARNINGS (T2/T3 items deferred to follow-up branches; branch is mergeable as-is)
- **PR target:** `TeacherEvan/ShapeKeeper:main` from `v2/production-hardening`
