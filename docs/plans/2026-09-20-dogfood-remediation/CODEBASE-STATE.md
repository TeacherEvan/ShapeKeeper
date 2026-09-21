# Dogfood Remediation — Codebase State (Discovery)

**Run:** 2026-09-20-dogfood-remediation
**Repo:** /home/leandi-duplessis/github/workspaces/ShapeKeeper (git remote points to canonical repo)
**Discovery date:** 2026-09-20

## Baseline
- Stack: Vanilla JS (ES modules), no build step (build = echo no-op), Convex backend.
- Entry: `index.html` (exists, 28977 bytes). Styles: `styles.css` (261 bytes). Canvas game board.
- Deployment target: Vercel (`vercel.json` present with CSP + HSTS + permissions headers).
- Console errors at discovery: 0 on localhost; deployed URL returns static Vercel 404 page (`404 DEPLOYMENT_NOT_FOUND`), no JS errors (page never reaches client code).

## Issue Classification (V2 taxonomy)
1. Critical / Functional: Deployed site 404 for `/`, `/index.html`, `/lobby`, `/game`. Evidence: `docs/Dogfood/screenshots/01-landing-404.png`, `11-deployed-404-analysis.png`. Evidence file: `docs/Dogfood/report.md`.
2. Medium / UX: App only accessible via manual local server (`python3 -m http.server 8888`). Evidence: `docs/Dogfood/screenshots/02-` through `10-`.

## Dependencies / Security
- Convex bundle: `https://unpkg.com/convex@1.42.3/dist/browser.bundle.js` (SRI pinned in `index.html`).
- No secrets in repo; `vercel.json` CSP references `https://precise-ladybug-504.convex.cloud`.
- `.git` intact; working tree clean (verified via `git status`).

## Gate Status (Pre-Plan)
- Lint: Not run (no changes proposed).
- Typecheck: Not applicable (vanilla JS outside `convex/`).
- Security: No new secrets introduced by this plan; deployment fix may require production deploy gate (`APPROVAL_REQUIRED`).
