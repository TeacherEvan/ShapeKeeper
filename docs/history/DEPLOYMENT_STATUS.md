# Deployment Status

**Date:** December 8, 2025  
**Status:** ⚠️ BACKEND DEPLOYMENT REQUIRED

## Live Site

🌐 **https://shape-keeper.vercel.app**

## Repository Status

```text
Branch: main
Repository: TeacherEvan/ShapeKeeper
Hosting: Vercel (auto-deploy from main)
Backend: Convex (https://oceanic-antelope-781.convex.cloud)
Frontend Version: 4.2.0 ✅
Backend Version: 4.1.0 ⚠️ (outdated - needs deployment)
Status: ⚠️ Schema Mismatch - Deploy Convex backend
```

## ⚠️ Action Required

The Convex backend needs to be deployed to fix the `partyMode` validation error.

**Quick Fix:**
```bash
npx convex deploy --yes
```

See [docs/CONVEX_DEPLOYMENT_FIX.md](../CONVEX_DEPLOYMENT_FIX.md) for detailed instructions.

## Recent Deployments

### December 8, 2025 (v4.2.0)
- ✅ Party Mode support in schema and mutations
- ✅ GitHub Actions workflow for auto-deployment
- ⚠️ **PENDING:** Convex backend deployment (run `npx convex deploy`)

### December 2025
- ✅ Diagonal line support
- ✅ Triangle detection system
- ✅ Dark mode canvas fix
- ✅ ES6 module partial refactoring

### November 29, 2025
- ✅ Convex backend schema and functions
- ✅ Multiplayer lobby system (room codes)
- ✅ Real-time game state sync
- ✅ vercel.json static deployment config
- ✅ CounterPlan visual roadmap

## Tech Stack

| Component | Service | Status |
|-----------|---------|--------|
| Frontend | Vercel | ✅ Live (v4.2.0) |
| Backend | Convex | ⚠️ Outdated (v4.1.0 - needs deployment) |
| Database | Convex Tables | ✅ Active |
| Repository | GitHub | ✅ Synced |
| CI/CD | GitHub Actions | ✅ Workflow Added |

## Deployment Configuration

### vercel.json
```json
{
  "buildCommand": null,
  "outputDirectory": ".",
  "framework": null
}
```

### Convex Tables
- `rooms` - Multiplayer room management
- `games` - Game state storage
- `players` - Player sessions

## Quick Commands

```bash
# Deploy frontend
vercel --prod

# Deploy Convex functions
npx convex deploy

# Run locally
npx convex dev
python -m http.server 8000
```

## Documentation

- `README.md` - Main documentation
- `docs/CONVEX_DEPLOYMENT_FIX.md` - **Deployment fix instructions** ⚠️
- `CounterPlan.md` - Visual evolution roadmap
- `MULTIPLAYER_PLANNING.md` - Multiplayer architecture
- `.github/copilot-instructions.md` - Development guidelines

---

**Status:** ⚠️ Backend Deployment Required - See [CONVEX_DEPLOYMENT_FIX.md](../CONVEX_DEPLOYMENT_FIX.md)
