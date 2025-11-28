# Dots and Boxes Game

A modern, browser-based implementation of the classic Dots and Boxes game with adaptive landscape layouts, smooth animations, and touch support.

![Game Version](https://img.shields.io/badge/version-2.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎮 Features

### Core Gameplay

- **Classic Dots and Boxes mechanics** - Connect dots to create boxes and score points
- **Two-player turn-based gameplay** - Players alternate turns, with bonus turns for completing squares
- **Smart turn logic** - Complete a square, keep your turn!
- **Real-time score tracking** - Live updates for both players
- **Score Multipliers** - Reveal hidden multipliers when completing squares

### Visual Enhancements

- **Adaptive Landscape Layout** - Automatically optimizes grid for landscape displays (e.g., 30x30 becomes ~50×18)
- **Miniaturized Design** - Dots are 5× smaller than traditional implementations for more gameplay area
- **Smooth Animations** - Particle effects and square completion animations
- **Pulsating Lines** - Visual feedback for newly drawn lines
- **Touch Visuals** - Ripple effects for touch interactions
- **Color Customization** - Choose your own player colors

### Technical Features

- **Pure Vanilla JavaScript** - No frameworks or dependencies
- **HTML5 Canvas Rendering** - Smooth, hardware-accelerated graphics
- **Multi-touch Support** - Native touch handling for tablets and phones
- **Responsive Design** - Adapts to any screen size
- **Fullscreen Mode** - Immersive gameplay experience
- **Landscape Optimization** - Best experience in landscape orientation

## 🚀 Quick Start

### Option 1: Direct Browser Access

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Select grid size and player colors
4. Click "Start Game" and enjoy!

### Option 2: Local Web Server

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (with http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## 📐 Grid Sizes

The game offers four preset grid sizes that automatically adapt to your display:

| Selection | Square Mode | Landscape Mode* | Total Squares |
|-----------|-------------|-----------------|---------------|
| 5×5       | 5×5 grid    | ~7×4 grid       | 16 squares    |
| 10×10     | 10×10 grid  | ~16×7 grid      | 81 squares    |
| 20×20     | 20×20 grid  | ~33×14 grid     | 361 squares   |
| 30×30     | 30×30 grid  | ~50×18 grid     | 841 squares   |

*Landscape mode activates when aspect ratio > 1.5

## 🎯 How to Play

### Game Rules

1. **Objective**: Complete more squares than your opponent
2. **Turns**: Players alternate drawing lines between adjacent dots
3. **Scoring**: Complete a square by drawing its fourth side to earn a point
4. **Bonus Turn**: Complete a square to earn another turn immediately
5. **Multipliers**: Tap completed squares to reveal score multipliers
6. **Winning**: Player with the most points when the grid is full wins

### Controls

- **Mouse**: Click dots to select and connect them
- **Touch**: Tap dots on touchscreen devices
- **Selection**: Click a dot, then click an adjacent dot to draw a line
- **Visual Feedback**: Selected dot shows a colored ring
- **Multipliers**: Click/tap completed squares to reveal and apply multipliers

### Strategy Tips

- Plan ahead to avoid giving opponents easy squares
- Try to complete multiple squares in one turn
- Control the endgame by managing available moves
- Watch for "double-cross" patterns

## 🏗️ Project Structure

```
Sqaure/
├── index.html              # Main HTML structure (3-screen layout)
├── styles.css              # Styling and responsive design
├── game.js                 # Core game logic and canvas rendering
├── welcome.js              # Screen navigation and game initialization
├── MULTIPLAYER_PLANNING.md # Multiplayer feature planning document
├── README.md               # This file
└── .github/
    └── copilot-instructions.md  # Development guidelines
```

## 🔧 Technical Architecture

### Core Components

#### DotsAndBoxesGame Class (`game.js`)

- **State Management**: Lines (Set), Squares (Object), Scores (Object)
- **Rendering Engine**: HTML5 Canvas with 60fps animation loop
- **Event Handling**: Mouse, touch, and resize events
- **Game Logic**: Square detection, turn management, win conditions

#### Key Methods

```javascript
setupCanvas()          // Adaptive layout calculation
getNearestDot()       // Collision detection for dot selection
checkForSquares()     // Square completion detection
draw()                // Main rendering loop
animate()             // Animation frame management
```

### Data Structures

#### Line Keys (Normalized)

```javascript
"1,2-1,3"  // Horizontal line from (1,2) to (1,3)
"1,2-2,2"  // Vertical line from (1,2) to (2,2)
```

Always sorted to prevent duplicates.

#### Square Keys

```javascript
"5,10"  // Square at row 5, column 10
```

### Coordinate System

```javascript
screenX = offsetX + col × cellSize
screenY = offsetY + row × cellSize
```

- Origin: Top-left corner
- Grid: 0-indexed rows and columns

## 🎨 Customization

### Changing Grid Sizes

Edit `index.html` to add new grid size buttons:

```html
<button class="grid-btn" data-size="40">40×40</button>
```

### Adjusting Visual Properties

In `game.js` constructor:

```javascript
this.dotRadius = 1.6;    // Dot size
this.lineWidth = 2;      // Line thickness
this.cellSize = 8-40;    // Cell size range (calculated)
```

### Color Schemes

Default colors can be changed in `index.html`:

```html
<input type="color" id="player1Color" value="#FF0000">
<input type="color" id="player2Color" value="#0000FF">
```

## 📱 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 90+     | ✅ Full Support |
| Firefox | 88+     | ✅ Full Support |
| Safari  | 14+     | ✅ Full Support |
| Edge    | 90+     | ✅ Full Support |
| Opera   | 76+     | ✅ Full Support |

**Requirements:**

- ES6+ JavaScript support
- HTML5 Canvas API
- CSS3 (Flexbox, Grid)

## 🐛 Known Issues & Limitations

- Parsing error in VSCode is cosmetic (ESLint configuration)
- Portrait mode shows rotation prompt (landscape recommended)
- Very large grids (50×50+) may impact performance on older devices

## 🔮 Future Enhancements

- [x] Multiplayer mode planning (see MULTIPLAYER_PLANNING.md)
- [ ] Online multiplayer with Convex + Vercel
- [ ] Lobby system with 2-6 player support
- [ ] AI opponent with difficulty levels
- [ ] Game replay and save/load functionality
- [ ] Achievement system
- [ ] Custom grid size input
- [ ] Sound effects and music
- [ ] Dark/light theme toggle
- [ ] Undo/redo moves
- [ ] Tutorial mode for new players

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 👨‍💻 Author

**Teacher Evan**

Created as an educational project demonstrating:

- Canvas API manipulation
- Game state management
- Responsive design patterns
- Touch event handling
- Animation techniques

## 🤝 Contributing

Contributions welcome! Feel free to:

- Report bugs via Issues
- Submit pull requests
- Suggest new features
- Improve documentation

## 📝 Version History

### v2.1.0 (Current)

- Removed zoom controls for simplified UI
- Added comprehensive multiplayer planning documentation
- Score multiplier system for completed squares
- Improved touch handling

### v2.0.0

- 5× smaller dots for better screen utilization
- Adaptive landscape layout optimization
- Enhanced touch support with visual feedback
- Improved animation system
- Performance optimizations

### v1.0.0

- Initial release
- Basic game mechanics
- Square grid layouts
- Mouse and touch support

---

**Enjoy the game!** 🎮✨

For questions or feedback, please open an issue on GitHub.
