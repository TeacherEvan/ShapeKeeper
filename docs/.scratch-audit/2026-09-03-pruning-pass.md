# ShapeKeeper — Pruning Pass (2026-09-03)

> **For Claude/Hermes:** This is the output of the surgical-pruning toolkit
> at 85% confidence (REVIEW_REQUIRED range). It is **plan-only** — no files
> were deleted. See `.prune/PRUNE_MANIFEST.json` for the full machine-readable
> inventory and `surgical-pruning-0903-ShapeKeeper.html` for the interactive
> plan.
>
> **Deletions require per-file approval.** The recommended path is one
> follow-up commit per concern, each scoped to a single function or file.

## Summary

| Stage | Output |
|---|---|
| SP toolkit | 7 agents implemented; planner returned 153 entries, **0 auto-prune candidates** at 85% confidence |
| knip cross-check | 10 issues, 19 with non-empty export lists; **8 confirmed-unused exports** after `grep -rlF` |
| HTML plan | `surgical-pruning-0903-ShapeKeeper.html` (320 KB, filterable by confidence) |
| Manifest | `.prune/PRUNE_MANIFEST.json` (28 KB) |
| Audit | `.prune/audit-report.json` (15 smells, 153 orphans — most are live-source false positives on the Convex barrel re-export pattern, as the SP skill's documented pitfall) |
| Suggestions | `.prune/suggestions.json` (21 ranked items) |

## Confirmed-unused symbols (grep-verified, awaiting approval)

| File | Symbol | Confidence (manual) | Notes |
|---|---|---|---|
| `tests/e2e/helpers/multiplayer-sync.js` | `expectScores` | 95% | Exported but no caller. Safe to remove. |
| `local-save-replay.js` | `isValidSnapshot` | 90% | Exported but no caller. Verify no Playwright test imports it; if clean, safe to remove. |
| `src/ui/ThemeManager.js` | `updateThemeButton` | 90% | Exported but no caller. Likely dead UI helper. |
| `effect-system/gameplay.js` | `stealConnectedTerritory` | 80% | Exported; check if it is called via `import * as` or `dynamic import` before removing. |
| `effect-system/gameplay.js` | `getConnectedSquareRegion` | 80% | Same caveat. |
| `effect-system/gameplay.js` | `giftRandomShape` | 80% | Same caveat. |
| `effect-system/gameplay.js` | `applyWildcardPowerup` | 80% | Same caveat. |
| `effect-system/gameplay.js` | `activateOracleVision` | 80% | Same caveat. |
| `effect-system/gameplay.js` | `triggerChaosStorm` | 80% | Same caveat. |
| `src/ui/menu/syncHandlers.js` | `getTurnClockController` | 70% | Likely dead since the lava-timer feature was inlined into the main flow. |

The `effect-system/gameplay.js` cluster looks like a Party Mode effect system that was
partially removed; the helpers remain but no consumer. **Do NOT delete without a
30-minute walk through the Party Mode flow first** — these functions may be wired
into the live effect-pipeline via reflection or `import * as`.

## Intentional duplicates (NOT candidates for removal)

- `input-handler/pointer-controls.js` exports `handleTouchStart`, `handleTouchMove`,
  `handleTouchEnd` as backwards-compat aliases for the pointer handlers. The 2026-09-02
  review (and this branch's v2-fixed ZIP) deliberately kept them so existing
  integrations that still import the touch names do not break. Removing them is a
  separate decision that requires auditing every `import { handleTouch* }` call
  site in the live tree (none, per the grep above; the v2-fixed Zip's
  input-handler.js was updated to use pointer names).

## Rejected / not-actionable

- SP's planner returned 0 auto-prune candidates at any confidence level. The
  bundled scan is conservative by design (per the skill's documented
  Convex-barrel pitfall) and cannot resolve the convex barrel re-exports
  (`export { X } from "./shared"`). knip gave a sharper signal, but the
  grep-verification above is what the table above is built on. The
  `surgical-pruning-0903-ShapeKeeper.html` plan is a more conservative view
  (all 153 entries marked `action: "keep"` with confidence ≤ 0.4).

## What is NOT a candidate

- All 92 `console.log` calls in convex/ — handled separately by the
  logging-hygiene commit in this branch (gated by CONVEX_DEBUG).
- The 34 `*_test.js` / `*.spec.js` files — protected path.
- All `convex/_generated/*` — auto-generated, never edit.
- `package-lock.json` — protected.
- `index.html`, `config.js`, `vercel.json` — entry points.

## How to apply

Each row in the table above is its own small commit:

```bash
# Example: remove the obviously-dead expectScores helper
git checkout -b chore/prune-expectScores
# Delete the function (or the entire `export` line) in
# tests/e2e/helpers/multiplayer-sync.js
npx vitest run  # gate stays green
git commit -m "chore: remove unused expectScores helper"
gh pr create --base main
```

Do NOT batch all 10 into one commit. The diffs would be unreadable, and a
bad removal of an 80%-confidence candidate would block the entire PR.
