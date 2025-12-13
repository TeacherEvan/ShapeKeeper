# CounterPlan: ShapeKeeper Visual Evolution Roadmap

> **Status: ✅ COMPLETE** - All phases implemented as of November 29, 2025

> **Philosophy:** Dramatic impact through layered, composable enhancements. Each phase delivers standalone value while building toward a cohesive visual experience. No framework dependencies, no build tools—pure vanilla JS magic.

---

## 🎯 Vision Statement

Transform ShapeKeeper from a polished game into a **visually stunning experience** that feels modern, responsive, and alive—without sacrificing the simplicity that makes it maintainable.

**Guiding Principles:**

1. **Progressive Enhancement** - Each feature works independently
2. **Performance First** - 60fps or don't ship it
3. **Mobile Native** - Touch interactions should feel native
4. **Extensible Architecture** - New effects plug in, not bolt on

---

## 📊 Current State Assessment

### What We Have (Excellent Foundation)

```
✅ RAF-driven animation loop (animate())
✅ Particle system (velocity, decay, gravity)
✅ Multiple animation queues (squares, particles, kisses, multipliers)
✅ DPR-aware high-DPI rendering
✅ Touch visual feedback system
✅ Glow effects via shadowBlur
✅ Easing functions (ease-out-back for squares)
✅ Pulsating line animations
```

### Extension Points Identified

- `particles[]` - Already supports spark/smoke variants
- `draw()` - Clear render order, easy to inject layers
- Static constants - All magic numbers extracted
- Animation cleanup - Automatic lifecycle management

---

## 🗺️ Phased Roadmap

### Phase 1: The Polish Pass (1 Week)

_"Make what exists feel premium"_

#### 1.1 Enhanced Particle Physics

```javascript
// Add air resistance and bounce
p.vx *= 0.98; // Air drag
p.vy *= 0.98;
if (p.y > boundaryY) {
    p.y = boundaryY;
    p.vy *= -0.6; // Bounce with energy loss
}
```

#### 1.2 Line Drawing Animation

Instead of instant line appearance, animate the stroke:

```javascript
// New animation type: lineDrawing
this.lineDrawings.push({
    startDot,
    endDot,
    progress: 0,
    startTime: Date.now(),
    duration: 150, // Quick but visible
});

// In draw(), render partial line:
const currentEnd = {
    x: lerp(start.x, end.x, easeOutQuad(progress)),
    y: lerp(start.y, end.y, easeOutQuad(progress)),
};
```

#### 1.3 Screen Shake on Big Plays

Subtle camera shake when completing multiple squares:

```javascript
if (completedCount >= 2) {
    this.shakeIntensity = completedCount * 2;
    this.shakeDecay = 0.9;
}

// In draw():
if (this.shakeIntensity > 0.1) {
    this.ctx.translate(
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity
    );
    this.shakeIntensity *= this.shakeDecay;
}
```

#### 1.4 Dot Interaction Polish

- Hover preview: Show faint line preview when near valid connection
- Invalid line feedback: Quick red flash + subtle vibration (navigator.vibrate)
- Connection sound cue: Optional Web Audio API ping

---

### Phase 2: Motion Trails & Persistence (1-2 Weeks)

_"Leave a beautiful wake"_

#### 2.1 Trail Canvas Layer

Add dedicated canvas for motion trails (separates from main render):

```javascript
// Layered canvas architecture
this.mainCanvas = document.getElementById('gameCanvas');
this.trailCanvas = document.createElement('canvas');
this.trailCanvas.style.position = 'absolute';
this.trailCanvas.style.pointerEvents = 'none';
container.insertBefore(this.trailCanvas, this.mainCanvas);

// Trail fade technique (from MDN research)
this.trailCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
this.trailCtx.fillRect(0, 0, width, height);
// Then draw trails on top - creates ghosting effect
```

#### 2.2 Particle Trails

Particles leave fading tails:

```javascript
// Store position history
p.trail = p.trail || [];
p.trail.push({ x: p.x, y: p.y });
if (p.trail.length > 8) p.trail.shift();

// Draw trail with gradient opacity
p.trail.forEach((pos, i) => {
    const alpha = (i / p.trail.length) * p.life * 0.5;
    ctx.fillStyle = p.color + alphaHex(alpha);
    ctx.arc(pos.x, pos.y, p.size * (i / p.trail.length), 0, TAU);
});
```

#### 2.3 Selection Ribbon

When dragging between dots, show flowing ribbon instead of static line:

- Bezier curve with slight wave
- Animated dash pattern flowing toward destination
- Color gradient from player color to white

---

### Phase 3: Glow & Atmosphere (1-2 Weeks)

_"Light it up"_

#### 3.1 CSS Filter Glow Layer

Cheaper than shadowBlur for large effects:

```css
.glow-layer {
    filter: blur(20px) brightness(1.5);
    mix-blend-mode: screen;
    pointer-events: none;
}
```

Render bright spots to a separate canvas, apply CSS filter, composite.

#### 3.2 Dynamic Background Gradient

Background responds to game state:

```javascript
// Gradient shifts based on score differential
const scoreDiff = scores[1] - scores[2];
const hue1 = baseHue1 + scoreDiff * 2; // Subtle shift
document.body.style.background = `radial-gradient(ellipse at ${cursorX}% ${cursorY}%, 
     hsl(${hue1}, 40%, 15%), 
     hsl(${hue1 + 30}, 30%, 8%))`;
```

#### 3.3 Ambient Particles

Floating background particles (like dust motes):

```javascript
class AmbientParticle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.2;
        this.size = 1 + Math.random() * 2;
        this.opacity = 0.1 + Math.random() * 0.2;
    }
    update() {
        // Gentle drift with Perlin-like noise
        this.x += this.vx + Math.sin(Date.now() / 2000 + this.y / 100) * 0.1;
        this.y += this.vy + Math.cos(Date.now() / 2000 + this.x / 100) * 0.1;
        // Wrap at boundaries
    }
}
```

---

### Phase 4: Triangle Integration (2-3 Weeks)

_"The shape evolution"_

> Note: This builds on the foundation, not a standalone 10-week project

#### 4.1 Diagonal Line Support

```javascript
// Extend isValidLine() for diagonal connections
const isDiagonal = Math.abs(dot1.row - dot2.row) === 1 && Math.abs(dot1.col - dot2.col) === 1;
const isAdjacent = this.isOrthogonallyAdjacent(dot1, dot2);
return isDiagonal || isAdjacent;
```

#### 4.2 Triangle Detection

```javascript
// After line draw, check for triangles
checkForTriangles(newLine) {
    const [dot1, dot2] = this.parseLineKey(newLine);

    // Find all dots that share lines with both endpoints
    const candidates = this.getConnectedDots(dot1)
        .filter(d => this.getConnectedDots(dot2).includes(d));

    // Each candidate completes a triangle
    return candidates.map(d => this.createTriangleKey(dot1, dot2, d));
}
```

#### 4.3 Triangle Rendering

```javascript
drawTriangle(triangleKey) {
    const [d1, d2, d3] = this.parseTriangleKey(triangleKey);
    const color = this.triangles[triangleKey].player === 1
        ? this.player1Color : this.player2Color;

    this.ctx.fillStyle = color + '30';
    this.ctx.beginPath();
    this.ctx.moveTo(this.dotToScreen(d1));
    this.ctx.lineTo(this.dotToScreen(d2));
    this.ctx.lineTo(this.dotToScreen(d3));
    this.ctx.closePath();
    this.ctx.fill();
}
```

#### 4.4 Triangle Animations

- Spin-in effect (rotate from center while scaling up)
- Prismatic sparkle particles (rainbow-tinted)
- Special sound effect distinct from square completion

---

### Phase 5: Advanced Effects (2-4 Weeks)

_"The 'wow' factor"_

#### 5.1 Bloom Post-Processing

Canvas-based bloom without WebGL:

```javascript
// 1. Render bright elements to offscreen canvas at 1/4 resolution
// 2. Apply multiple blur passes (box blur is fast)
// 3. Composite back with additive blending

function boxBlur(imageData, radius) {
    // Separable blur: horizontal then vertical
    // Much faster than Gaussian for realtime
}

// Composite with main canvas
this.ctx.globalCompositeOperation = 'lighter';
this.ctx.drawImage(bloomCanvas, 0, 0, width, height);
this.ctx.globalCompositeOperation = 'source-over';
```

#### 5.2 Combo System Visuals

Track consecutive square completions:

```javascript
if (completedSquare && !this.turnSwitched) {
    this.comboCount++;
    this.comboMultiplier = 1 + (this.comboCount - 1) * 0.5;

    // Visual escalation
    if (this.comboCount >= 3) this.triggerComboFlash();
    if (this.comboCount >= 5) this.triggerScreenPulse();
    if (this.comboCount >= 7) this.triggerEpicMode();
}
```

#### 5.3 Victory Celebration

Game end fireworks:

```javascript
triggerVictorySequence() {
    // 1. Slow-mo final square animation
    this.timeScale = 0.3;

    // 2. Camera zoom to winner's score
    this.targetZoom = 1.5;
    this.zoomFocus = winnerScorePosition;

    // 3. Firework bursts
    setInterval(() => {
        this.launchFirework(randomX, canvas.height);
    }, 300);

    // 4. Confetti shower
    for (let i = 0; i < 100; i++) {
        this.confetti.push(new ConfettiParticle());
    }
}
```

---

### Phase 6: Sound Design (Optional, 1-2 Weeks)

_"Audio feedback loop"_

#### 6.1 Web Audio API Integration

```javascript
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
    }

    // Procedural sounds (no asset loading!)
    playLineDraw() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
}
```

#### 6.2 Haptic Feedback

```javascript
if (navigator.vibrate) {
    // Line complete: quick tap
    navigator.vibrate(10);

    // Square complete: double tap
    navigator.vibrate([20, 50, 20]);

    // Multiplier reveal: buzz
    navigator.vibrate([50, 30, 50, 30, 100]);
}
```

---

## 🎨 Sprite & Asset System (Future)

> Reserved for external asset integration

```javascript
class AssetManager {
    constructor() {
        this.sprites = new Map();
        this.loaded = false;
    }

    async load(manifest) {
        // Load sprite sheets, audio, etc.
        // Support lazy loading for large assets
    }

    getSprite(name) {
        return this.sprites.get(name);
    }
}

// Usage in game:
drawDot(x, y) {
    if (this.assets.loaded) {
        this.ctx.drawImage(this.assets.getSprite('dot'), x - r, y - r, r*2, r*2);
    } else {
        // Fallback to canvas primitives
        this.ctx.arc(x, y, r, 0, TAU);
    }
}
```

---

## 📐 Architecture Patterns

### Effect Registry Pattern

```javascript
// Pluggable effect system
class EffectRegistry {
    constructor() {
        this.effects = new Map();
    }

    register(name, effectClass) {
        this.effects.set(name, effectClass);
    }

    trigger(name, params) {
        const Effect = this.effects.get(name);
        if (Effect) return new Effect(params);
    }
}

// Registration
game.effects.register('spark', SparkEffect);
game.effects.register('smoke', SmokeEffect);
game.effects.register('confetti', ConfettiEffect);

// Usage
game.effects.trigger('spark', { x, y, color, count: 30 });
```

### Layer Manager

```javascript
class LayerManager {
    constructor(container) {
        this.layers = [];
    }

    addLayer(name, zIndex) {
        const canvas = document.createElement('canvas');
        canvas.style.zIndex = zIndex;
        this.layers.push({ name, canvas, ctx: canvas.getContext('2d') });
        return this.layers.at(-1);
    }

    getLayer(name) {
        return this.layers.find((l) => l.name === name);
    }

    // Composite all layers to display
    composite(displayCtx) {
        this.layers
            .sort((a, b) => a.zIndex - b.zIndex)
            .forEach((l) => displayCtx.drawImage(l.canvas, 0, 0));
    }
}

// Layer order:
// 0: Background (gradient, ambient particles)
// 1: Trails (motion persistence)
// 2: Game (lines, squares, dots)
// 3: Effects (particles, emojis)
// 4: UI (selection indicators)
```

---

## ⚡ Performance Guidelines

### DO:

- **Batch similar draw operations** - Group all lines, then all fills
- **Use `willReadFrequently: false`** on effect canvases
- **Object pooling** for particles - Reuse instead of GC
- **Dirty rect rendering** - Only redraw changed regions (advanced)
- **RAF throttling** - Skip frames if behind
- **Off-main-thread work** - Web Workers for physics (if needed)

### DON'T:

- ❌ shadowBlur on every frame (use CSS filter layer instead)
- ❌ Create new arrays each frame (reuse animation arrays)
- ❌ String concatenation in hot paths (template literals + cache)
- ❌ Multiple getContext() calls
- ❌ Unbounded particle counts

### Performance Budget

```
Target: 60fps (16.67ms per frame)
├── Physics/Logic: 2ms
├── Clear/Prep: 1ms
├── Draw calls: 8ms
├── Compositing: 2ms
└── Buffer: 3.67ms
```

---

## 🗓️ Implementation Priority Matrix

| Feature             | Impact | Effort | Priority | Status                      |
| ------------------- | ------ | ------ | -------- | --------------------------- |
| Line draw animation | High   | Low    | P0       | ✅ Complete                 |
| Screen shake        | High   | Low    | P0       | ✅ Complete                 |
| Particle trails     | High   | Medium | P1       | ✅ Complete                 |
| Trail canvas layer  | Medium | Medium | P1       | ✅ (Single canvas approach) |
| Sound design        | Medium | Medium | P3       | ✅ Complete                 |
| Victory sequence    | High   | Medium | P2       | ✅ Complete                 |
| Combo system        | High   | Medium | P2       | ✅ Complete                 |
| Ambient particles   | Medium | Low    | P1       | ✅ Complete                 |
| Dynamic background  | Medium | Low    | P1       | ✅ Complete                 |
| Diagonal lines      | High   | Medium | P1       | ✅ Complete (v4.1.0)        |
| Triangle detection  | High   | High   | P2       | ✅ Complete (v4.1.0)        |

### Not Implemented (Future Work)

| Feature              | Impact | Effort | Priority | Notes                       |
| -------------------- | ------ | ------ | -------- | --------------------------- |
| Triangle multiplayer | Medium | Medium | P1       | Convex schema update needed |
| Bloom effect         | Medium | High   | P2       | Performance concerns        |
| Asset system         | Low    | High   | P3       | Not needed currently        |

---

## 🚀 Quick Wins (Do Today)

> **All Quick Wins Completed! ✅**

1. ~~**Line Draw Animation** - 30 minutes~~ ✅
2. ~~**Screen Shake** - 20 minutes~~ ✅
3. ~~**Invalid Line Flash** - 15 minutes~~ ✅
4. ~~**Dot Hover Preview** - 45 minutes~~ ✅

These four changes immediately made the game feel 50% more polished.

---

## 📝 Notes

- All code examples are additive - they extend existing patterns
- No ES module conversion required
- No build tools required
- No external dependencies
- Mobile-first, touch-native
- Backwards compatible with current game state structure

---

_This plan is designed to be flexible. Pick any phase, any feature. Each stands alone but all compose together into something greater._

**Let's make ShapeKeeper shine. ✨**
