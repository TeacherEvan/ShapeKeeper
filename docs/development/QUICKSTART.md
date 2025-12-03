# 🚀 Quick Start Guide

## Play Online Now!

**🌐 [shape-keeper.vercel.app](https://shape-keeper.vercel.app)**

No installation required - just click and play!

---

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/TeacherEvan/ShapeKeeper.git
cd ShapeKeeper

# Install dependencies
npm install

# Start Convex dev server (for multiplayer)
npm run dev

# In another terminal, serve the frontend
npm run start
# Or: python -m http.server 8000
```

Then open `http://localhost:8000`

---

## 🎮 How to Play

### Mouse
- **Click** a dot to select it (you'll see a colored ring)
- **Click** an adjacent dot to draw a line (orthogonal or diagonal!)
- Complete a square or triangle to score and get another turn!

### Touch (Mobile/Tablet)
- **Tap** dots just like clicking with a mouse
- Works great in landscape mode!

## 🏆 Game Rules

1. **Players alternate** drawing lines between adjacent dots
2. **Complete a square** (4 sides) = 1 point
3. **Complete a triangle** (3 sides with diagonal) = 0.5 points
4. **Bonus**: Complete any shape, get another turn
5. **Win**: Have the most points when the grid is full

## 💡 Pro Tips

- **Plan ahead** - Try not to give your opponent easy shapes
- **Diagonals** - Use diagonal lines to create triangles for bonus points
- **Control the endgame** - Be strategic about which shapes to complete
- **Double-crosses** - Look for patterns where you can complete multiple shapes in one turn
- **Landscape mode** - Rotate your device for the best experience on mobile

## 🎨 Customization

Change player colors on the welcome screen:
- **Player 1**: Red by default (top left)
- **Player 2**: Blue by default (top right)

## 📱 Best Experience

- **Desktop**: Any modern browser, works great!
- **Mobile**: Use landscape orientation for optimal layout
- **Grid Size**: 
  - 10×10 for quick games (2-3 minutes)
  - 20×20 for medium games (5-10 minutes)  
  - 30×30 for epic battles (15+ minutes)

## 🐛 Troubleshooting

**Dots not showing?**
- Refresh the page (Ctrl+R or Cmd+R)
- Make sure JavaScript is enabled

**Game too small/big?**
- Try fullscreen mode (should auto-trigger)
- Resize your browser window and the game adapts

**Touch not working?**
- Make sure you're tapping directly on dots
- Try landscape orientation

**Dark mode issues?**
- Toggle theme using the theme button on welcome screen
- Both canvases now properly respond to theme changes

## 🎯 That's It!

You're ready to play! The game is intuitive - just start connecting dots and you'll get the hang of it in seconds.

**Have fun!** 🎮✨

---

Need more help? Check out:
- [README.md](../../README.md) - Full documentation
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Development guide
- [GitHub Issues](https://github.com/TeacherEvan/ShapeKeeper/issues) - Report problems
