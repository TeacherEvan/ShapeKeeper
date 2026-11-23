# Surgical Audit — `games.expiredTurn` free-tier burn

**Date:** 2026-11-23 (UTC)
**Target:** ShapeKeeper, branch `main`, HEAD `4b7ac1243c1c508e4a66fe2c3ce58df3482231b2`
**Deployment inspected:** `evilevan:shapekeeper:production` (prod, S16 / Free)
**Scope:** Focused audit of the online turn-expiry path in response to "is `games.expiredTurn` blasting through my Convex free tier usage normal?"
**Baseline integrity:** `tree_integrity_sha256 = c4a71852b7e42474b997325c81bc6b9833c7650b7040f929ec5c5cebe6c51c0a`; `git status --porcelain` showed one pre-existing untracked plan file and no tracked modifications.
**Zero-mutation:** No source, config, or test file was modified. Only this report was added.

---

## Verdict

**No — this is not normal.** It is a P0 runaway retry loop: every `games.expireTurn` execution throws a schema-validation error, the transaction rolls back so the turn deadline never advances, and a 5-second cron re-enqueues the same doomed mutation forever. Two stuck rooms in the sample produced **exactly 2 failed `expireTurn` calls every 5 seconds**, day and night, with zero successful expiries.

This single loop, if left running for a full month, consumes **~156% of the entire 1,000,000 function-call/month Free allowance** and **~42× the 1 GB/month database-I/O allowance** on its own (Convex Free/Starter limits, per convex.dev/pricing and docs.convex.dev/production/state/limits, checked 2026-11-23).

---

## Evidence (live production logs)

Source: `npx convex logs --prod --history 3000 --jsonl --success` → `/tmp/sk-logs.jsonl` (CLI caps at 1000 events).
Observed window: **2026-11-20T06:29:45Z → 2026-11-20T06:57:25Z** (1660.0 s).

| Function | Calls | Failures | Caller |
| --- | ---: | ---: | --- |
| `games:expireTurn` | 666 | **666 (100%)** | Scheduler |
| `mutations/sweepAllTurnDeadlines:sweepAllTurnDeadlines` | 332 | 0 | Cron |
| `mutations/sweepStaleLobbies:sweepStaleLobbies` | 2 | 0 | Cron |

- 332 cron sweeps / 1660 s = one sweep every 5.0 s → `convex/crons.ts:13-18` confirmed.
- 666 / 332 = **2.01 `expireTurn` failures per sweep** → two rooms permanently stuck in the expired state.
- `expireTurn` success count: **0**. Every failure has the same cause; `willRetry: false` (Convex does not auto-retry — the cron is the retry driver).

Error, identical on all 666 events:

```
Uncaught Error: Failed to insert or update a document in table "rooms" because it does not match the schema:
Path: .lastTurnClientSentAt  Value: null  Validator: v.float64()
  at armTurnTimer (convex/games/turnTimer.ts:29)
  at applyLineForPlayer (convex/games/draw.ts:105)
  at expireTurnHandler (convex/games/turnTimer.ts:60)
```

Normalized consumption (linear extrapolation from the 1660 s window):

| Meter | Observed in 1660 s | Per day | Per 30 days | Free allowance / month |
| --- | ---: | ---: | ---: | ---: |
| `expireTurn` calls | 666 | 34,664 | 1,039,922 | 1,000,000 total |
| Cron sweep calls | 332 | 17,280 | 518,400 | (same shared pool) |
| **Total from this loop** | 998 | **51,944** | **1,558,322** | **~156%** |
| Database I/O read | 27.14 MB | 1.41 GB | 42.4 GB | **1 GB (~42×)** |
| Documents read | 91,908 | 4,783,642 | 143.5 M | — |

Per-call read cost: ~40.7 KB / ~138 documents. Two stuck rooms: one ~1.7 KB/5 docs, one ~79.8 KB/271 docs — the more populated game is the expensive one. `_creationTime` of the most recent log is 2026-11-20T06:57:20Z; as of 2026-11-23T06:28Z there are **no newer production log events**, so the loop appears to have stopped in the last 3 days (loop state cleared, deployment idled, or cron changed). The defective code path is still present and will recur on the next timed online game whose turn expires.

---

## Root-cause chain (P0)

1. **`convex/games/draw.ts:93-98`** builds `timingPatch` with `lastTurnClientSentAt: clientSentAt ?? null`. `clientSentAt` is `undefined` on both internal expiry call sites:
   - **`convex/games/turnTimer.ts:60-61`** — `applyLineForPlayer(ctx, room, currentPlayer, players, chosenLine)`, no 5th argument.
   - **`convex/games/draw.ts:201-207`** — late client `drawLine` expiry path, also no 5th argument.
2. **`convex/schema.ts:32`** declares `lastTurnClientSentAt: v.optional(v.number())`. `v.optional` permits an *absent* field, **not `null`**; the patch fails validation with `Validator: v.float64()`.
3. **`convex/games/turnTimer.ts:60`**→`armTurnTimer` at `turnTimer.ts:29` performs the invalid `ctx.db.patch`. The mutation throws, Convex aborts the whole transaction: the line insert at `draw.ts:18`, the score patch, and crucially the **`turnEndTime` re-arm at `turnTimer.ts:28-29` are all rolled back**.
4. The room remains `status: 'playing'` with an expired `turnEndTime`. **`convex/mutations/sweepAllTurnDeadlines.ts:23-31`** sees `isTurnExpired(room) === true` and calls `ctx.scheduler.runAfter(0, internal.games.expireTurn, …)` every 5 s; **`convex/crons.ts:13-18`** supplies the cadence. Step 1–4 repeat forever.
5. The stale-lobby reaper (`convex/crons.ts:25-30`) only deletes `lobby` rooms, so nothing reclaims a permanently stuck `playing` room.

**Trigger:** any online game with a non-zero turn duration where a turn actually expires (scheduled expiry, or a late move). Casual/local modes never hit it.

---

## Contributing defects

| ID | Severity | Location | Mechanism / trigger |
| --- | --- | --- | --- |
| F2 | P1 | `convex/games/turnTimer.ts:39,46,49` | Early returns (stale schedule, `<2` players, missing `currentPlayer`) leave an expired `turnEndTime` in a `playing` room without re-arming or clearing it. Once F1 is fixed, these states would still let the cron re-enqueue forever. |
| F3 | P1 | `convex/games/turnTimer.ts:30` + `convex/mutations/sweepAllTurnDeadlines.ts:27` | Two schedulers target the same mutation: `runAt(turnEndTime)` per move *and* `runAfter(0)` per sweep. Even healthy expiries cost ~2 `expireTurn` calls per turn (the loser is a no-op). |
| F4 | P2 | `convex/games/turn_duration.js:20-31` | `resolveTurnDurationMs()` reads the legacy `turnDurationSeconds`; the authoritative field is `turnDurationMs` (`turnTimer.ts:23`). Used by the sweep guard (`sweepAllTurnDeadlines.ts:25`) and `draw.ts:187`. For rooms with only `turnDurationMs`, it returns the 10 s default, so the "no limit" guard can be wrong. |
| F5 | P2 | `convex/games/turnTimer.test.ts:117-170`, `convex/wiring.test.ts:18-22` | Tests mock `ctx.db.patch`/`insert`, so no test exercises Convex schema validation. `wiring.test.ts` asserts "client always sends it" while two internal call sites deliberately omit it — the assertion gives false confidence. |

---

## Test matrix / mental mutation analysis

`M_kill = 25% (1/4)` — basis: `convex/games/turnTimer.test.ts` (8 tests, all db calls mocked), `convex/wiring.test.ts:18-22` (surface-only assertion), `tests/turn-timer-parity.test.js` (pure constants only). No test uses a real Convex deployment or schema validator.

| Mutant | Result | Why |
| --- | --- | --- |
| M1 boundary flip (`isTurnExpired` `>` → `>=`) | killed | parity/unit assertions pin boundary semantics |
| M2 zero/empty (`clientSentAt ?? null` with absent clientSentAt) | **survives** | mocked `patch` accepts `null`; no schema-validating test |
| M3 side-effect deletion (remove re-arm) | killed | `turnTimer.test.ts:162-169` asserts `patch` contains `turnEndTime` |
| M4 async failure (`db.patch` throws) | **survives** | no failure-injection test; no retry/stop assertion |

Pathologies: Mock-Mirror (F5), Happy-Path Tunnel Vision (no expired-room-with-0-players case), Result-Only Assertions (no assertion that the sweep converges to zero scheduled jobs).

**MVTH (Tier 2):** run `expireTurnHandler` against `convex-test` with the real schema; assert (a) no throw, (b) `turnEndTime` advances, (c) exactly one line inserted, (d) a second cron sweep with the same room schedules no further `expireTurn`. Repeat for a room with 1 player and a full board.

---

## Fix blueprint (NOT applied — audit is read-only)

1. **Make the write schema-valid:** in `convex/games/draw.ts:93-98`, spread `clientSentAt` into `timingPatch` only when it is a number (omit the key otherwise); do the same for `lastTurnServerReceivedAt` if it can ever be null. This alone stops the rollback.
2. **Make the sweep idempotent:** remove the 5 s cron and rely on the durable `runAt` from `armTurnTimer` (preferred — halves function calls and removes the retry driver), or add a persisted `expiryClaimedAt`/attempt token and only enqueue when the deadline changed. Cap retries per deadline.
3. **Close the non-terminating early returns:** in `expireTurnHandler`, clear `turnEndTime`/`turnStartTime` (or finish the room) when `players.length < 2` or `currentPlayer` is missing, so `isTurnExpired` goes false and the cron stops.
4. **Unify duration fields:** have `sweepAllTurnDeadlines.ts` and `draw.ts:186-189` use `normalizeTurnDuration(room.turnDurationMs)` from `turnTimer.ts`; retire `turn_duration.js` usage in live handlers.
5. **Add the Tier 2 regression test** above, plus a monkeypatch-revert proof (copy fixed file to scratch, restore `?? null`, confirm the test fails with the schema error).
6. **Operational cleanup:** identify and finish/delete the two stuck `playing` rooms before deploying the fix, otherwise the existing stale deadlines will run one more cycle. Confirm recovery with `npx convex logs --prod --history 200 --jsonl --success` — expect no `games:expireTurn` errors after the first clean expiry.

Suggested commit series: `fix(timer): omit null clientSentAt from turn timing patch` → `fix(cron): make turn-deadline sweep idempotent` → `test(timer): schema-validating expiry regression` → `refactor(timer): unify duration field reads`.

---

## Lens coverage (10-principal board)

| Lens | Result |
| --- | --- |
| 1 Systems Architect | F3 (competing schedulers), F4 (dual duration models) |
| 2 Frame-Budget & Performance | P0 quantified above: ~52k calls/day, ~1.41 GB DB I/O/day |
| 3 Mathematical / Algorithmic | N/A — no numeric instability in this path |
| 4 Concurrency / Async & Determinism | F3; transaction rollback leaves invariant broken; cron acts as unbounded retry |
| 5 Memory & Resource Lifecycle | N/A — no long-lived in-process handles |
| 6 Security & Trust-Boundary | N/A — internal mutation, no untrusted input in the failing path |
| 7 Reliability & Fault Tolerance | P0 core: uncaught validation error with no retry cap or dead-letter path; F2 |
| 8 Type Systems / Schema & Contracts | P0 core: `null` written to `v.optional(v.number())`; F4, F5 |
| 9 Platform / Viewport | N/A — server-side only |
| 10 Cognitive Load / Maintainability | F4, F5; false-confidence assertion in `wiring.test.ts:18` |

**Deterministic health score** (`score_audit.py`, telemetry `/tmp/shapekeeper-telemetry.json`, P0=1 P1=2 P2=2 P3=1, M_kill=1/4): **S_health = 86/100, RISK = HIGH** (one P0 forces High regardless of score). Score is dominated by the very large codebase denominator; the P0 finding is the actionable signal.

---

## Zero-mutation verification

- Telemetry integrity before audit: `c4a71852b7e42474b997325c81bc6b9833c7650b7040f929ec5c5cebe6c51c0a`.
- `git status --porcelain` at capture: `?? docs/plans/2026-11-11-cloning-sprites-to-teacherevan.md` (pre-existing, untouched).
- After audit: only this report was added; no tracked file changed. See final status line in the chat response.
- All scratch artifacts (`/tmp/shapekeeper-telemetry.json`, `/tmp/sk-logs.jsonl`) live outside the repository; Python invoked with `-B` (no `__pycache__` debris).

---

## Remediation outcome (2026-11-23, local commits only)

Fixes were applied test-first (each regression test watched RED before the source edit) and landed as a green commit series:

| Commit | Concern |
| --- | --- |
| `7ba5fa2` | `fix(timer)`: omit `null` `clientSentAt` — kills the P0 rollback loop |
| `77ccc9f` | `fix(cron)`: retire the redundant 5 s sweep and its generated API entry |
| `f059826` | `fix(timer)`: clear stale deadlines when expiry cannot proceed |
| `467ef18` | `refactor(timer)`: read duration from `turnDurationMs` |
| `d923ca8` | `feat(levels)`: archive the payment lock (separate owner request) |
| `2c96ee1` | `docs(audit)`: this report |

Verification after the final edit: `npm run lint` exit 0; `npx convex typecheck` exit 0; `npx vitest run` **97 files / 697 tests passed**; `npm run build` exit 0; `npm run test:e2e:smoke` 1 passed; `npx playwright test tests/e2e/paywall-level-gate.spec.js --project=chromium` 3 passed.

## Release evidence (2026-11-23)

- Convex: `npm run deploy:prod` exit 0 — functions pushed to `https://precise-ladybug-504.convex.cloud`, schema validation complete, no indexes deleted.
- Vercel: `npx vercel --prod --yes` exit 0 — deployment `shape-keeper-905x6hyd8-teacher-evans-projects.vercel.app`, production URL `https://shape-keeper.vercel.app`.
- Deployed artefact verified, not just HTTP 200: `vercel curl https://shape-keeper.vercel.app/config.js?cb=<ts>` returns the archived config with `window.PAYWALL_ENABLED = false` at line 41 and an empty `PAYSTACK_PUBLIC_KEY`.

**Blocker found during post-deploy verification:** the Convex deploy output warned "Your projects are disabled because the team exceeded Free plan limits", and a harmless production query (`queries/roomQueries:listOpenLobbies`) failed with `[Request ID: db5c3aa7d91f46e9] You have exceeded the free plan limits, so your deployments have been disabled`. The code fix is live on Convex, but no function can execute until the team resolves the overage (upgrade/Starter or Convex support). The burn loop's retry driver is gone, so it cannot grow further; no local command can re-enable the deployment.

**Not done:** no `git push` was performed (commits are local only).
