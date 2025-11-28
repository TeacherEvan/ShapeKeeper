# Branch Cleanup Action Plan
**Date:** October 16, 2025  
**Current Status:** 10 remote feature branches + main  
**Goal:** Clean up to single `main` branch

---

## Step-by-Step Cleanup Process

### ✅ Step 1: Sync Your Local Main Branch
First, update your local branch with the latest changes:

```powershell
# Pull the latest changes (you're 7 commits behind)
git pull origin main
```

**Expected Result:** Your local `main` will be up-to-date with all merged PRs.

---

### ✅ Step 2: Verify All PRs Are Merged
Based on the screenshot, all branches show green checkmarks (3/3 checks passed), which means they've likely been merged. Let's verify:

```powershell
# Check which branches are fully merged into main
git branch -r --merged origin/main
```

**What to look for:** All 10 feature branches should appear in this list if they're fully merged.

---

### ✅ Step 3: Delete Merged Remote Branches

#### Option A: Delete via GitHub Web Interface (Recommended)
1. Go to: https://github.com/TeacherEvan/Sqaure/branches
2. For each merged branch, click the **Delete** button
3. This is the safest method as GitHub will warn you if a branch isn't fully merged

#### Option B: Delete via Command Line
**Only use if all branches are confirmed merged!**

```powershell
# Delete each branch individually (safer)
git push origin --delete copilot/enhance-line-width-and-score-display
git push origin --delete copilot/add-5x5-level
git push origin --delete copilot/trigger-fullscreen-on-startup
git push origin --delete copilot/fix-dot-selection-line-creation
git push origin --delete copilot/improve-mobile-zoom-layout
git push origin --delete copilot/fix-zoom-feature-for-mobile
git push origin --delete copilot/fix-blokkies-display-issue
git push origin --delete copilot/fix-dot-selection-issues
git push origin --delete copilot/fix-dot-selection-issue
git push origin --delete copilot/enhance-welcome-screen-display
```

#### Option C: Batch Delete (Advanced)
```powershell
# Delete all copilot/* branches at once
git branch -r --merged origin/main | Where-Object { $_ -match 'origin/copilot/' } | ForEach-Object { $branch = $_ -replace 'origin/', '' -replace '\s+', ''; git push origin --delete $branch }
```

---

### ✅ Step 4: Clean Up Local Remote References
After deleting remote branches, clean up your local references:

```powershell
# Remove stale remote-tracking branches
git fetch --prune

# Verify cleanup
git branch -r
```

**Expected Result:** Should only see `origin/main` and `origin/HEAD -> origin/main`

---

### ✅ Step 5: Final Verification

```powershell
# Check local branches
git branch

# Check remote branches
git branch -r

# Verify you're on main and up-to-date
git status
```

**Success Criteria:**
- Local: Only `main` branch exists
- Remote: Only `origin/main` exists
- Status: "Your branch is up to date with 'origin/main'"

---

## Important Notes

### ⚠️ Special Attention Required

**Branch with Failed Checks:**
- `copilot/fix-dot-selection-issues` (#6) shows **1/2 checks** (one failed)
- **Recommendation:** Check if this PR was actually merged despite the failed check
- If it wasn't merged, review whether its changes are needed

### Before Deleting Branches
1. **Verify all PRs are merged** - Check each PR on GitHub to confirm it's merged
2. **Review PR #6** - The one with failed checks needs special attention
3. **Create a backup** (optional but recommended):
   ```powershell
   # Create a backup of all branch references
   git branch -r > branch-backup-$(Get-Date -Format 'yyyy-MM-dd').txt
   ```

---

## Quick Reference Commands

### Safe Commands (Read-Only)
```powershell
git status                              # Check current state
git branch -a                           # List all branches
git branch -r --merged origin/main      # List merged remote branches
git log --oneline -n 10                 # View recent commits
```

### Cleanup Commands (Destructive)
```powershell
git fetch --prune                       # Clean up stale references
git push origin --delete <branch-name>  # Delete remote branch
```

---

## Rollback Plan (If Something Goes Wrong)

If you accidentally delete an unmerged branch:

```powershell
# Find the branch's last commit (within 90 days)
git reflog show origin/<branch-name>

# Restore the branch
git push origin <commit-hash>:refs/heads/<branch-name>
```

**Note:** GitHub keeps deleted branches for 90 days, so you can restore them from the web interface if needed.

---

## Expected Final State

```
Repository: TeacherEvan/Sqaure
├── main (local) ✓
└── origin/main (remote) ✓

Total: 1 active branch
All features integrated into main
```

---

## Next Steps After Cleanup

1. ✅ Update documentation to reflect single-branch workflow
2. ✅ Archive cleanup documentation (this file, BRANCH_CLEANUP_PLAN.md, etc.)
3. ✅ Continue development directly on `main` branch
4. 🎯 Consider branch protection rules on GitHub for future work

---

**Ready to proceed?** Start with Step 1 (sync local main) and work through each step carefully.
