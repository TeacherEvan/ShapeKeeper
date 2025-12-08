# Convex Deployment Fix - December 2025

> **Status:** ✅ RESOLVED  
> **Date:** December 8-9, 2025  
> **Issue:** partyMode validation error in multiplayer room creation

---

## Problem Summary

**Error:**
```
ArgumentValidationError: Object contains extra field `partyMode` that is not in the validator.
```

**Root Cause:** Frontend (Vercel) was at v4.2.0 with `partyMode` support, but Convex backend was at v4.1.0 without it. Schema mismatch caused validation errors.

---

## Solution Implemented

### 1. GitHub Actions Auto-Deployment
Created `.github/workflows/deploy-convex.yml`:
- Triggers on push to `main` (convex/** files)
- Uses `CONVEX_DEPLOY_KEY` secret
- Keeps frontend and backend in sync

### 2. Manual Deployment (Quick Fix)
```bash
npx convex login     # One-time auth
npx convex deploy --yes
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE (BROKEN)                               │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (v4.2.0)          Backend (v4.1.0)                    │
│  sends: { partyMode }  →    rejects: "extra field"              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AFTER (FIXED)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (v4.2.0)          Backend (v4.2.0)                    │
│  sends: { partyMode }  →    accepts: { partyMode: optional }    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Involved

| File | Change |
|------|--------|
| `.github/workflows/deploy-convex.yml` | NEW - Auto-deployment |
| `convex/schema.ts` | Has `partyMode: v.optional(v.boolean())` |
| `convex/rooms.ts` | Has `partyMode` in validator |
| `convex-client.js` | Sends `partyMode` parameter |

---

## Prevention

With GitHub Actions workflow, future Convex changes auto-deploy when:
1. Files in `convex/` change on `main` branch
2. Workflow is manually triggered

---

## Setup Requirements (One-Time)

1. Generate deploy key: `npx convex deploy --configure-key`
2. Add to GitHub Secrets as `CONVEX_DEPLOY_KEY`

---

*Archived: December 9, 2025*
