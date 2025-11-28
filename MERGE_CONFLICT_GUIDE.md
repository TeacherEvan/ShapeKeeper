# Merge Conflict Resolution Guide

## Situation
- **Your Changes:** Code cleanup, consolidation, documentation
- **Remote Changes:** Zoom feature improvements, mobile optimizations
- **Conflict:** Both modified `game.js` in different ways

## Recommended Resolution Strategy

### Option 1: Accept Remote Changes, Then Re-apply Cleanup (RECOMMENDED)

This ensures you have all the latest features, then apply your improvements on top.

```bash
# Reset to state before your commit
git reset --soft HEAD~1

# Stash your changes
git stash save "Code cleanup changes"

# Pull remote changes cleanly
git pull origin main

# Re-apply your stashed changes
git stash pop

# Resolve any conflicts manually
# Then commit the combined changes
git add .
git commit -m "Code cleanup with latest zoom features"
```

### Option 2: Manual Merge Resolution

Keep both sets of changes by carefully merging:

```bash
# Start the merge again
git pull origin main

# Open game.js and resolve conflicts by:
# 1. Keep remote's zoom features (manual zoom, pan)
# 2. Keep your cleanup (drawLine() consolidation, removed duplicates)
# 3. Combine documentation headers

# After resolving all conflicts:
git add game.js
git commit -m "Merge: combine code cleanup with zoom features"
```

### Option 3: Push to New Branch for Review

Create a branch for your changes to review side-by-side:

```bash
# Create a new branch from current state
git checkout -b feature/code-cleanup

# Push to remote
git push origin feature/code-cleanup

# Create PR on GitHub to review and merge
# Then delete the branch after merge
```

## Recommended: Option 1 (Step-by-Step)

1. **Save your work:**
   ```bash
   git reset --soft HEAD~1
   git stash save "Code cleanup: consolidation and documentation"
   ```

2. **Get latest from remote:**
   ```bash
   git pull origin main
   ```

3. **Re-apply your cleanup:**
   ```bash
   git stash pop
   ```

4. **If conflicts, resolve them keeping:**
   - Remote's zoom features (manualZoomLevel, panOffset, etc.)
   - Your drawLine() consolidation
   - Your removed duplicates (isAdjacent, processTouchClick)
   - Your documentation improvements

5. **Commit combined work:**
   ```bash
   git add .
   git commit -m "Code cleanup integrated with latest zoom features"
   ```

6. **Push to remote:**
   ```bash
   git push origin main
   ```

## Files to Pay Attention To

- **game.js** - Main conflict area
  - Zoom variables (accept remote)
  - drawLine() method (keep yours)  
  - Touch handlers (merge both improvements)
  
- **styles.css** - Minor conflicts
  - Merge both formatting improvements

- **Documentation** - No conflicts
  - Your new MD files are additions

## After Resolution

Continue with branch cleanup:
```bash
# Delete merged remote branches
git push origin --delete copilot/enhance-welcome-screen-display
git push origin --delete copilot/fix-blokkies-display-issue
# ... etc (see BRANCH_CLEANUP_PLAN.md)

# Prune local references
git fetch --prune
```

## Need Help?

If you prefer, I can:
1. Guide you through manual conflict resolution
2. Show you exactly which code to keep from each version
3. Create a combined version for you to review
