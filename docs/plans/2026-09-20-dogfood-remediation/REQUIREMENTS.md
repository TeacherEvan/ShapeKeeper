# Dogfood Remediation — Requirements

**Plan:** 2026-09-20-dogfood-remediation
**Source prompt:** User instruction "proceed with dogfood fixes" following dogfood QA (docs/Dogfood/report.md, 2 issues: Critical 404 deployed, Medium local-only).
**Scope:** Remediate Critical 404 on https://shapekeeper.vercel.app; address Medium local-only access gap.

## Functional Requirements
- AC-001: Deployed URL responds with 200 (not 404) for `/`.
- AC-002: Deployed URL serves `index.html` and loads game assets.
- AC-003: Local server (`localhost:8888`) continues to work (no regression).

## Non-Functional Requirements
- AC-004: No secrets exposed in deployment config or artifacts.
- AC-005: Changes must not corrupt `.git` or working tree (see AGENTS.md pitfalls).

## Constraints
- 404 is deployment-level (`vercel.app` returns `DEPLOYMENT_NOT_FOUND`). Code changes alone may not fix.
- If fix requires Vercel redeploy/domain remap: requires APPROVAL_REQUIRED gate (production/deploy action).
- Existing `vercel.json` CSP and header rules must be preserved.
