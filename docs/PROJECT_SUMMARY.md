# Project Summary - ShapeKeeper

## 🌐 Live Site

**Play Now:** [https://shape-keeper.vercel.app](https://shape-keeper.vercel.app)

## ✅ Current Status: v3.0.0 - Multiplayer Live

### Multiplayer System (New!)

- ✅ **Convex Backend** - Real-time database with ACID transactions
- ✅ **Lobby System** - Create/join rooms with unique codes
- ✅ **Real-time Sync** - Game state updates instantly for all players
- ✅ **Vercel Deployment** - Auto-deploy from GitHub main branch
- ✅ **Turn Management** - Server-authoritative game state

### Core Game Features

- ✅ Classic Dots and Boxes mechanics
- ✅ Score multiplier system (x2 to x10)
- ✅ Adaptive landscape layout
- ✅ Multi-touch support
- ✅ Particle effects and animations

## 📁 Project Structure

```text
ShapeKeeper/
├── index.html           # Main HTML (3-screen layout)
├── styles.css           # Styling and responsive design
├── game.js              # Core game logic (~1400 lines)
├── welcome.js           # Screen navigation + Convex handlers
├── convex-client.js     # Convex browser API wrapper
├── convex/              # Backend
│   ├── schema.ts        # Database schema
│   ├── rooms.ts         # Room management
│   └── games.ts         # Game state functions
├── vercel.json          # Deployment config
├── CounterPlan.md       # Visual evolution roadmap
└── README.md            # Documentation
```

## 🚀 Quick Start

### Play Online

Visit [shape-keeper.vercel.app](https://shape-keeper.vercel.app)

### Run Locally

```bash
# Start Convex dev server
npx convex dev

# Serve frontend
python -m http.server 8000
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS, HTML5 Canvas |
| Backend | Convex |
| Hosting | Vercel |
| Database | Convex Tables |

## 📊 Version History

| Version | Date | Features |
|---------|------|----------|
| 3.0.0 | Nov 2025 | Multiplayer, Convex, Vercel |
| 2.1.0 | Oct 2025 | Multipliers, touch fixes |
| 2.0.0 | Oct 2025 | 5x smaller dots, landscape |
| 1.0.0 | Oct 2025 | Initial release |

---

**Status:** ✅ Production Ready  
**Author:** Teacher Evan  
**License:** MIT
