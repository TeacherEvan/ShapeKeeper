# ShapeKeeper Documentation Index

> **Quick Navigation** for all ShapeKeeper documentation

---

## 📁 Documentation Structure

### Development (`/docs/development/`)

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](development/QUICKSTART.md) | Getting started guide for developers |
| [CODE_AUDIT.md](development/CODE_AUDIT.md) | Code quality and architecture audit |
| [PR_SUMMARY.md](development/PR_SUMMARY.md) | Populate feature sync & turn-based optimization |
| [MERGE_CONFLICT_GUIDE.md](development/MERGE_CONFLICT_GUIDE.md) | How to resolve merge conflicts |

### Planning (`/docs/planning/`)

| Document | Description |
|----------|-------------|
| [JOBCARD.md](planning/JOBCARD.md) | Current session work tracking |
| [CounterPlan.md](planning/CounterPlan.md) | Visual evolution roadmap (✅ Complete) |
| [MULTIPLAYER_PLANNING.md](planning/MULTIPLAYER_PLANNING.md) | Online multiplayer architecture |
| [REFACTORING_PLAN.md](planning/REFACTORING_PLAN.md) | ES6 module refactoring plan |

### Technical (`/docs/technical/`)

| Document | Description |
|----------|-------------|
| [FEATURE_SUMMARY.md](technical/FEATURE_SUMMARY.md) | Complete feature list and details |
| [PERFORMANCE_IMPROVEMENTS.md](technical/PERFORMANCE_IMPROVEMENTS.md) | Optimization techniques (v4.3.0) |
| [TURN_BASED_OPTIMIZATION.md](technical/TURN_BASED_OPTIMIZATION.md) | Multiplayer state sync optimization |
| [POPULATE_FEATURE.md](technical/POPULATE_FEATURE.md) | Populate feature implementation |
| [BENQ_FIX.md](technical/BENQ_FIX.md) | BenQ board touch compatibility fix |

### History (`/docs/history/`)

| Document | Description |
|----------|-------------|
| [DEPLOYMENT_STATUS.md](history/DEPLOYMENT_STATUS.md) | Deployment history and status |
| [CONVEX_DEPLOYMENT_FIX_DEC2025.md](history/CONVEX_DEPLOYMENT_FIX_DEC2025.md) | partyMode fix (archived) |

---

## 🚀 Quick Links

- **Live Site:** [shape-keeper.vercel.app](https://shape-keeper.vercel.app)
- **Repository:** [GitHub](https://github.com/TeacherEvan/ShapeKeeper)
- **Copilot Instructions:** [.github/copilot-instructions.md](../.github/copilot-instructions.md)

---

## 📋 Key Features (v4.3.0)

### Performance Optimizations 🚀
- In-place array compaction in animation loop
- Ambient particle frame skipping
- Single-pass particle physics
- Reduced GC pressure

### Party Mode 🎉
- All tile effects enabled during gameplay
- Includes: dares, hypotheticals, powerups, traps
- Toggle on/off in local setup screen

### Turn-Based Multiplayer
- Optimized communication (chess-like)
- State updates only on turn changes
- Debounced subscriptions to prevent glitches

### Core Gameplay
- Dots and Boxes with diagonal lines
- Triangle detection and scoring
- Score multipliers (×2 to ×10)
- Dark/light theme support

---

*Last updated: December 9, 2025*
