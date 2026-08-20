# Git & Codebase Audit — ShapeKeeper (2026-08-20)

Run mode: surgical-implementation skill invoked; user directive "investigate git THEN audit codebase" overrides plan-as-prompt. Audit-only, no source changes made.

## 1. Repo / Target Confirmation
- Path: /home/ewaldt/Documents/VS/GAMES/ShapeKeeper
- Remote: https://github.com/TeacherEvan/ShapeKeeper.git (origin/main)
- Branch: main (HEAD = e3eba9e). Up to date with origin/main (NO ahead commits).
- Confirmed NOT the wrong repo before any action.

## 2. Git Investigation (evidence)
- Branches (local): feature/main-menu-cta-rename, main (current).
- Remote-tracking refs: many stale — copilot/* (17), worktree-2025-12-13T* (3 orphan worktree branches from Dec 2025), dependabot/* (some merged). Cleanup candidates, not deleted (APPROVAL_REQUIRED for remote branch deletes).
- Stash: none.
- Recent merges: #35/#36 (lava timer + online sync), dependabot bumps, code-scanning alert fixes (workflow permissions, insecure randomness).
- Working tree NOT clean:
  - M package.json  → adds "allowScripts": { "esbuild@0.27.0": true } (build toolchain postinstall consent; harmless, intentional).
  - M package-lock.json → 6-line drift from the above.
  - Untracked: .prune/ (Surgical-Pruning run output, ~10MB), surgical-pruning-0818-ShapeKeeper.html (7.6MB), docs/.scratch-audit/ (prior Lava-Timer audit artifacts, already merged via #36).
- Note: docs/.scratch-audit/ contains a PREVIOUS run's REQUIREMENTS/CODEBASE-STATE/TRACEABILITY for the Lava-Timer plan. That plan is implemented and merged (#36); these are stale artifacts from an earlier session, not current open work.

## 3. Codebase State (evidence)
- Stack: Vanilla JS ES modules + HTML5 Canvas 2D, Convex backend (convex/*.ts, deployed separately), Playwright e2e. No framework.
- Tracked files: 188 (95 js, 14 ts, 16 css, 35 md). Source trees: src(17), convex(16), convex-client(4), renderer(4), particle-system(5), effect-system(3), input-handler(2), ui-manager(2), tests(26).
- Unit tests: 33 vitest files (17 passing files, 114 passing assertions).

## 4. Verification Gate (real runs)
- `npx vitest run` → 17 files, 114 passed, 0 failed. EXIT 0.
- `npm run verify` → convex typecheck PASS (tsc --noEmit exit 0) + game.js/welcome.js/convex-client.js syntax OK. EXIT 0.
- `npx eslint .` → clean. EXIT 0.
- node v24.15.0 / npm 12.0.2; node_modules present.

## 5. Security Audit (evidence)
- Secret scan (rg): source "secret/token" hits are FALSE POSITIVES — game-content identifiers only (constants.js `id: 'secret'` = a "Reveal a Secret" party-mode tile; effect-system/gameplay.js `case 'secret'` switch branch). No literal credential leakage in source.
- Real credentials live ONLY in .env.local: CONVEX_DEPLOYMENT, CONVEX_DEPLOY_KEY, CONVEX_URL, CONVEX_SITE_URL, VERCEL_OIDC_TOKEN — all properly gitignored (.gitignore:36 `.env*`). `git check-ignore` confirms it is ignored; NOT in git status.
- No .pem / *credentials* / *.env* (besides the ignored .env.local) committed.
- No injection/unsafe-eval patterns noted in scanned source.

## 6. Defects / Findings
- F-1 (MEDIUM, coverage false-green): tests/convex-client.test.js — 11 assertions, ALL `expect(true).toBe(true)` placeholders. 0 real assertions; exercises no source behavior. Inflates "passing" count. The other 32 test files have real assertions. FIX: replace placeholders with real asserts on convex-client/*.js exports, or mark @todo and exclude from green signal.
- F-2 (LOW, repo hygiene): untracked leftovers from a prior Surgical-Pruning run (.prune/ ~10MB + surgical-pruning-0818-ShapeKeeper.html 7.6MB) and stale docs/.scratch-audit/ (prior Lava-Timer audit). Recommend: archive/remove .prune + html after review; the Lava-Timer audit docs are redundant (merged in #36).
- F-3 (LOW, branch hygiene): 3 orphan remote worktree-2025-12-13* branches + 17 copilot/* branches are stale. Recommend pruning remote refs after confirming merges.

## 7. Final Status
READY WITH WARNINGS.
- Gates green: unit (114), typecheck, lint, syntax.
- Blocking: NONE.
- Warning: F-1 hollow test (false-green coverage). F-2/F-3 are hygiene only.

## 8. Recommended Next Actions (no changes made)
1. Fix F-1: give convex-client.test.js real assertions or scope it out of the green signal.
2. Clean F-2/F-3 artifacts (user authorization for remote branch deletes).
3. If a feature plan is intended, the prior docs/.scratch-audit/ is stale — re-scan docs/plans for the live plan instead of reusing it.

Artifacts written: this file. No source modified; no commits/pushes performed.
