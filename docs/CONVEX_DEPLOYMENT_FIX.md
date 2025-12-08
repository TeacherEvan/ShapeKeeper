# Convex Backend Deployment Fix

## Issue Summary

The production Convex backend is running an outdated schema that doesn't include the `partyMode` field, causing validation errors when creating rooms.

**Error:**
```
ArgumentValidationError: Object contains extra field `partyMode` that is not in the validator.
```

## Root Cause

The repository code (v4.2.0) includes `partyMode` support in:
- `convex/schema.ts` - Schema definition
- `convex/rooms.ts` - Mutation validator  
- `convex-client.js` - Client code

However, the production Convex deployment is still running an older version without `partyMode`.

## Solution

### Option 1: Automatic Deployment (Recommended)

A GitHub Actions workflow has been added to automatically deploy Convex backend changes.

**Setup Steps:**

1. Get your Convex Deploy Key:
   ```bash
   npx convex deploy --configure-key
   ```
   This will output a deploy key.

2. Add the deploy key to GitHub Secrets:
   - Go to: `Settings` > `Secrets and variables` > `Actions`
   - Click `New repository secret`
   - Name: `CONVEX_DEPLOY_KEY`
   - Value: [paste the deploy key from step 1]

3. Trigger deployment:
   - Push any change to `convex/` directory on the `main` branch, OR
   - Go to `Actions` tab > `Deploy Convex Backend` > `Run workflow`

### Option 2: Manual Deployment

If you prefer to deploy manually:

```bash
# 1. Authenticate with Convex (one-time setup)
npx convex login

# 2. Deploy to production
npx convex deploy --yes
```

## Verification

After deployment, verify the fix by:

1. Visit https://shape-keeper.vercel.app
2. Click "Create Room" on the welcome screen
3. Room should be created without errors
4. Party Mode checkbox should work correctly

## Files Changed

- ✅ `.github/workflows/deploy-convex.yml` - Auto-deployment workflow
- ✅ `docs/CONVEX_DEPLOYMENT_FIX.md` - This documentation

## Next Steps

1. Deploy the updated schema to production (see Solution above)
2. Verify the fix works
3. Update `docs/history/DEPLOYMENT_STATUS.md` to reflect v4.2.0 deployment

## Technical Details

### Schema Changes (Already in Code)

**convex/schema.ts (Line 10):**
```typescript
partyMode: v.optional(v.boolean()), // Party mode enabled (tile effects)
```

**convex/rooms.ts (Line 30):**
```typescript
export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    playerName: v.string(),
    gridSize: v.number(),
    partyMode: v.optional(v.boolean()),  // ← Added field
  },
  // ...
});
```

**convex-client.js (Line 137):**
```javascript
async function createRoom(playerName, gridSize, partyMode = true) {
  // Sends partyMode to backend
}
```

### Why This Happened

Vercel auto-deploys the frontend from the `main` branch, but Convex backend requires separate deployment. The code was updated to v4.2.0 with `partyMode` support, but the Convex backend wasn't redeployed, causing a client/server schema mismatch.

### Prevention

The GitHub Actions workflow now ensures Convex backend is automatically deployed whenever:
- Files in `convex/` directory change
- Commits are pushed to `main` branch
- Workflow is manually triggered

## Support

If you encounter issues:
1. Check GitHub Actions logs for deployment errors
2. Verify `CONVEX_DEPLOY_KEY` secret is set correctly
3. Run `npx convex deploy --dry-run` locally to test
4. See [Convex docs](https://docs.convex.dev/production) for troubleshooting
