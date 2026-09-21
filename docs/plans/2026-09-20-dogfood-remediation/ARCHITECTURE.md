# Dogfood Remediation — Architecture

**Current:** Deployed URL (`https://shapekeeper.vercel.app`) returns Vercel 404 (`DEPLOYMENT_NOT_FOUND`). Local server (`localhost:8888`) serves `index.html` + assets correctly.
**Target:** Deployed URL serves the same content as local (200, `index.html` loaded, assets reachable).

## Areas Being Edited
- `vercel.json` — verify routing/headers don't block `/` (currently only headers defined, no rewrites/redirects needed).
- `index.html` — no structural change required; verify it exists in build output.
- `docs/Dogfood/report.md` — add final remediation note.
- Deployment config/infrastructure — likely requires Vercel dashboard redeploy or domain remap (not a repo file edit).

## Security Boundaries
- CSP in `vercel.json` must be preserved.
- Convex connection (`precise-ladybug-504.convex.cloud`) must remain in `connect-src`.
- No secret rotation or permission changes proposed by this plan.
