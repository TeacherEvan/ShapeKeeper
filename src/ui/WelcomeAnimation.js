/**
 * ShapeKeeper Welcome Screen Animation
 * Implements flocking behavior (boids algorithm) with spatial partitioning for performance
 * Enhanced with modern visual effects: connection lines, mouse interaction, particle trails
 *
 * @module ui/WelcomeAnimation
 */

import { LevelsProgress, getVisibleSpriteCount } from './LevelsProgress.js';
import { SpriteFireworksManager, advanceSpriteLifecycle } from './SpriteFireworks.js';
import { SPRITE_PALETTES, hexToRgbChannels } from './sprite-palette.js';
import { SpriteSparks } from './sprite-sparks.js';
import { SpriteTrail, TRAIL_CAPACITY, TRAIL_MAX_SEGMENT } from './sprite-trail.js';

/**
 * All sprite physics were tuned per *frame* at 60 Hz. Stepping on a fixed
 * clock keeps 90/120/144 Hz phones from running the playground at 1.5-2.4x
 * speed (and with half-length motion trails).
 */
export const PHYSICS_STEP_MS = 1000 / 60;
/** Accept frames up to this early so 60 Hz timer jitter never drops a step. */
const STEP_JITTER_MS = 2;
/** Catch-up cap after a hitch: never spiral into a burst of updates. */
const MAX_STEPS_PER_FRAME = 2;
/** Pointer travel (px) beyond which a press is a swipe, not a tap. */
export const TAP_SLOP_PX = 14;
/** Number of musical zones across the screen; mirrors the pentatonic scale. */
const NOTE_ZONES = 10;
/** Scale a grabbed sprite swells to; the spring overshoots it on release. */
const GRAB_SCALE = 1.7;

/** Spectrum hue (degrees) for a screen x, quantised to the sound's note zones. */
export function hueForX(x, width) {
    if (!(width > 0)) return 0;
    const zone = Math.min(NOTE_ZONES - 1, Math.max(0, Math.floor((x / width) * NOTE_ZONES)));
    return Math.round((zone / (NOTE_ZONES - 1)) * 300);
}

export class WelcomeAnimation {
    constructor() {
        this.canvas = document.getElementById('welcomeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.floatingParticles = [];
        const levelsState = LevelsProgress.getState();
        // Sprites shown on home and side screens strictly reflect collected count (min 1, max 300).
        this.particleCount = getVisibleSpriteCount(levelsState);
        this.animationFrameId = null;
        this.isDimmed = false;
        this.fireworksManager = new SpriteFireworksManager();
        this.lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.isEasterEggActive = LevelsProgress.isEasterEggUnlocked();
        this.spatialPartitionGrid = null;
        this.partitionCellSize = 120;
        this.mousePosition = { x: -1000, y: -1000 };
        this.mouseInfluenceRadius = 200;
        this.connectionDistance = 140;
        this.particleTypes = ['circle', 'square', 'triangle', 'diamond'];
        // Full-spectrum sprite ink, one family per hue band. Lives in
        // ui/sprite-palette so the hue/contrast contract is unit-testable.
        this.colorPalette = SPRITE_PALETTES;
        // Canvas clear colour + constellation link ink per theme. These mirror the
        // cosmic substrate tokens in styles/cosmic-identity.css so the animated
        // canvas never tints the page off-brand.
        this.canvasTint = { light: '244, 241, 255', dark: '3, 6, 17' };
        this.constellationInk = { light: '10, 109, 149', dark: '0, 240, 255' };

        this.activePointers = new Map();
        this.grabbedSprites = new Map();
        this.ripples = [];
        this.sparks = new SpriteSparks();
        this.stepAccumulator = 0;
        this.reducedMotion = Boolean(
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
        );
        this.onInteractionCallback = null;

        this.initializeCanvas();
        this.createParticles();
        this.startAnimationLoop();

        window.addEventListener('resize', () => this.handleViewportResize());
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), {
            passive: true,
        });
        this.canvas.addEventListener('touchend', () => this.handleMouseLeave());

        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        window.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
    }

    initializeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.scale(dpr, dpr);
        this.logicalWidth = window.innerWidth;
        this.logicalHeight = window.innerHeight;
        this.initializeSpatialPartitioning();
    }

    clearAllParticleTrails() {
        if (!Array.isArray(this.floatingParticles)) return;
        for (const p of this.floatingParticles) {
            p.trail?.clear?.();
        }
    }

    handleViewportResize() {
        this.clearAllParticleTrails();
        this.initializeCanvas();
    }

    initializeSpatialPartitioning() {
        this.gridCols = Math.ceil(this.logicalWidth / this.partitionCellSize);
        this.gridRows = Math.ceil(this.logicalHeight / this.partitionCellSize);
        this.spatialPartitionGrid = Array(this.gridRows)
            .fill(null)
            .map(() =>
                Array(this.gridCols)
                    .fill(null)
                    .map(() => [])
            );
    }

    updateSpatialPartitionGrid() {
        for (let row of this.spatialPartitionGrid) {
            for (let cell of row) {
                cell.length = 0;
            }
        }

        for (let particle of this.floatingParticles) {
            const gridX = Math.floor(particle.x / this.partitionCellSize);
            const gridY = Math.floor(particle.y / this.partitionCellSize);
            if (gridX >= 0 && gridX < this.gridCols && gridY >= 0 && gridY < this.gridRows) {
                this.spatialPartitionGrid[gridY][gridX].push(particle);
            }
        }
    }

    getNeighboringParticles(particle) {
        const gridX = Math.floor(particle.x / this.partitionCellSize);
        const gridY = Math.floor(particle.y / this.partitionCellSize);
        const neighbors = [];

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
                    neighbors.push(...this.spatialPartitionGrid[ny][nx]);
                }
            }
        }

        return neighbors;
    }

    transitionToGameScreen() {
        const gameCanvas = document.getElementById('gameBackgroundCanvas');
        if (gameCanvas) {
            this.clearAllParticleTrails();
            this.canvas = gameCanvas;
            this.ctx = gameCanvas.getContext('2d');
            this.isDimmed = true;
            this.initializeCanvas();
        }
    }

    transitionToMainMenu() {
        const welcomeCanvas = document.getElementById('welcomeCanvas');
        if (welcomeCanvas) {
            this.clearAllParticleTrails();
            this.canvas = welcomeCanvas;
            this.ctx = welcomeCanvas.getContext('2d');
            this.isDimmed = false;
            this.initializeCanvas();
        }
    }

    moveToGameScreen() {
        this.transitionToGameScreen();
    }
    moveBackToMainMenu() {
        this.transitionToMainMenu();
    }

    /**
     * @param {{spawn?: boolean}} [opts] spawn=true grows the sprite in with an
     *   elastic pop instead of appearing at full size.
     */
    createSingleParticle({ spawn = false } = {}) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const palette = this.colorPalette[isDark ? 'dark' : 'light'];
        const colorSet = palette[Math.floor(Math.random() * palette.length)];
        const colorVariant = Math.random();
        let color;
        if (colorVariant < 0.4) color = colorSet.primary;
        else if (colorVariant < 0.7) color = colorSet.secondary;
        else color = colorSet.accent;

        return {
            x: Math.random() * this.logicalWidth,
            y: Math.random() * this.logicalHeight,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            color,
            baseColor: color,
            // Pre-parsed channels: the draw loop builds rgba() strings every
            // frame, so never parse the hex on the hot path.
            rgb: hexToRgbChannels(color),
            size: 2 + Math.random() * 3,
            baseSize: 2 + Math.random() * 3,
            type: this.particleTypes[Math.floor(Math.random() * this.particleTypes.length)],
            neighborhoodRadius: 120,
            maxSpeed: 1.8,
            maxForce: 0.04,
            trail: new SpriteTrail(TRAIL_CAPACITY),
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.02 + Math.random() * 0.03,
            pop: spawn && !this.reducedMotion ? 0 : 1,
            popV: 0,
        };
    }

    createParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            this.floatingParticles.push(this.createSingleParticle());
        }
    }

    syncWithLevelsProgress() {
        const state = LevelsProgress.getState();
        this.isEasterEggActive = LevelsProgress.isEasterEggUnlocked(state);
        const targetCount = getVisibleSpriteCount(state);
        this.particleCount = targetCount;
        while (this.floatingParticles.length > targetCount) {
            this.releaseIfGrabbed(this.floatingParticles.pop());
        }
        while (this.floatingParticles.length < targetCount) {
            this.floatingParticles.push(this.createSingleParticle({ spawn: true }));
        }
    }

    setSideScreenActive(active) {
        this.isSideScreenActive = active;
        this.syncWithLevelsProgress();
    }

    /** Drop any pointer still holding a sprite that just left the flock. */
    releaseIfGrabbed(particle) {
        if (!particle?.isGrabbed) return;
        for (const [id, grab] of this.grabbedSprites) {
            if (grab.particle === particle) this.grabbedSprites.delete(id);
        }
        particle.isGrabbed = false;
    }

    applyFlockingBehavior(particle) {
        let separation = { x: 0, y: 0 };
        let alignment = { x: 0, y: 0 };
        let cohesion = { x: 0, y: 0 };
        let neighborCount = 0;

        const nearbyParticles = this.getNeighboringParticles(particle);

        for (let other of nearbyParticles) {
            if (other === particle) continue;

            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            const distSq = dx * dx + dy * dy;
            const maxDistSq = particle.neighborhoodRadius * particle.neighborhoodRadius;

            if (distSq < maxDistSq && distSq > 0) {
                neighborCount++;

                const dist = Math.sqrt(distSq);

                if (dist < 30) {
                    separation.x -= dx / dist;
                    separation.y -= dy / dist;
                }

                alignment.x += other.vx;
                alignment.y += other.vy;

                cohesion.x += other.x;
                cohesion.y += other.y;
            }
        }

        // Mouse/touch influence
        const mouseDx = this.mousePosition.x - particle.x;
        const mouseDy = this.mousePosition.y - particle.y;
        const mouseDistSq = mouseDx * mouseDx + mouseDy * mouseDy;
        const mouseInfluenceRadiusSq = this.mouseInfluenceRadius * this.mouseInfluenceRadius;

        if (mouseDistSq < mouseInfluenceRadiusSq && mouseDistSq > 0) {
            const mouseDist = Math.sqrt(mouseDistSq);
            const influence = 1 - mouseDist / this.mouseInfluenceRadius;
            particle.vx -= (mouseDx / mouseDist) * influence * 0.5;
            particle.vy -= (mouseDy / mouseDist) * influence * 0.5;
        }

        if (neighborCount > 0) {
            alignment.x /= neighborCount;
            alignment.y /= neighborCount;

            cohesion.x = cohesion.x / neighborCount - particle.x;
            cohesion.y = cohesion.y / neighborCount - particle.y;
        }

        const separationWeight = 1.8;
        const alignmentWeight = 1.0;
        const cohesionWeight = 0.8;

        particle.vx += separation.x * separationWeight * particle.maxForce;
        particle.vy += separation.y * separationWeight * particle.maxForce;
        particle.vx += alignment.x * alignmentWeight * particle.maxForce * 0.1;
        particle.vy += alignment.y * alignmentWeight * particle.maxForce * 0.1;
        particle.vx += cohesion.x * cohesionWeight * particle.maxForce * 0.01;
        particle.vy += cohesion.y * cohesionWeight * particle.maxForce * 0.01;

        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > particle.maxSpeed) {
            particle.vx = (particle.vx / speed) * particle.maxSpeed;
            particle.vy = (particle.vy / speed) * particle.maxSpeed;
        }
    }

    updateParticlePositions() {
        this.updateSpatialPartitionGrid();

        const nowTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        for (const ptr of this.activePointers.values()) {
            const heldDuration = nowTime - ptr.startTime;
            const travelled = Math.hypot(
                ptr.x - (ptr.startX ?? ptr.x),
                ptr.y - (ptr.startY ?? ptr.y)
            );
            if (!ptr.isSingularity && heldDuration >= 280 && travelled <= TAP_SLOP_PX) {
                ptr.isSingularity = true;
                this.notifyInteraction({ type: 'singularity_start', x: ptr.x, y: ptr.y });
            }
            if (ptr.isSingularity && Math.random() < 0.3) {
                const angle = Math.random() * Math.PI * 2;
                const spawnDist = 35 + Math.random() * 65;
                this.emitSparks(
                    ptr.x + Math.cos(angle) * spawnDist,
                    ptr.y + Math.sin(angle) * spawnDist,
                    this.noteInk(ptr.x),
                    {
                        count: 1,
                        speed: 1.5,
                        driftX: -Math.cos(angle) * 1.8 - Math.sin(angle) * 1.2,
                        driftY: -Math.sin(angle) * 1.8 + Math.cos(angle) * 1.2,
                    }
                );
            }
        }

        for (let particle of this.floatingParticles) {
            this.advancePop(particle);

            // A grabbed sprite is teleported by the pointer: its stored history
            // would smear a diagonal streak across the canvas, so drop it.
            if (particle.isGrabbed) {
                particle.trail.clear();
                continue;
            }

            particle.trail.push(particle.x, particle.y);

            this.applyFlockingBehavior(particle);

            // Swirl or gravitational singularity around active pointers
            for (const ptr of this.activePointers.values()) {
                const dx = ptr.x - particle.x;
                const dy = ptr.y - particle.y;
                const dist = Math.hypot(dx, dy);

                if (ptr.isSingularity) {
                    if (dist > 8) {
                        const pull = Math.min(2.5, 400 / (dist + 50));
                        const tangentX = -dy / dist;
                        const tangentY = dx / dist;
                        particle.vx += (dx / dist) * pull * 0.12 + tangentX * pull * 0.18;
                        particle.vy += (dy / dist) * pull * 0.12 + tangentY * pull * 0.18;
                    }
                } else if (dist < 250 && dist > 20) {
                    const tangentX = -dy / dist;
                    const tangentY = dx / dist;
                    particle.vx += tangentX * 0.4 + (dx / dist) * 0.15;
                    particle.vy += tangentY * 0.4 + (dy / dist) * 0.15;
                }
            }

            // Ripple repulsion
            for (const ripple of this.ripples) {
                const dx = particle.x - ripple.x;
                const dy = particle.y - ripple.y;
                const dist = Math.hypot(dx, dy);
                if (Math.abs(dist - ripple.radius) < 30 && dist > 0) {
                    // The shove fades with the wave, so late rings only nudge.
                    const push = 1.8 * Math.max(0, 1 - (ripple.t ?? 0));
                    particle.vx += (dx / dist) * push;
                    particle.vy += (dy / dist) * push;
                }
            }

            particle.x += particle.vx;
            particle.y += particle.vy;

            particle.pulsePhase += particle.pulseSpeed;
            particle.size = particle.baseSize * (0.8 + 0.2 * Math.sin(particle.pulsePhase));

            // Edge wrap is a teleport. Restart the trail so the jump is never
            // stroked as a line across the whole canvas.
            if (this.wrapParticleIntoViewport(particle)) {
                particle.trail.clear();
            }
        }

        // Update ripples: ease-out expansion (fast start, soft landing) with a
        // matching fade, instead of a constant-speed linear ring.
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.t = (r.t ?? 0) + 0.03;
            const t = Math.min(1, r.t);
            const eased = 1 - Math.pow(1 - t, 3);
            r.radius = 2 + (r.maxRadius - 2) * eased;
            r.alpha = (r.baseAlpha ?? 0.85) * Math.pow(1 - t, 1.6);
            if (r.t >= 1 || r.alpha <= 0.005) {
                this.ripples.splice(i, 1);
            }
        }

        this.sparks.update();
    }

    /**
     * Damped spring on the sprite's scale: swells when grabbed, overshoots
     * and settles when released, and pops in elastically when spawned.
     */
    advancePop(particle) {
        if (typeof particle.pop !== 'number') {
            particle.pop = 1;
            particle.popV = 0;
        }
        if (this.reducedMotion) {
            particle.pop = 1;
            particle.popV = 0;
            return;
        }
        const target = particle.isGrabbed ? GRAB_SCALE : 1;
        particle.popV = ((particle.popV || 0) + (target - particle.pop) * 0.22) * 0.72;
        particle.pop = Math.max(0, particle.pop + particle.popV);
    }

    isDarkTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    /** Note-matched ink for ripples/sparks, legible on both theme backdrops. */
    noteInk(x, alpha = 1) {
        const hue = hueForX(x, this.logicalWidth);
        const lightness = this.isDarkTheme() ? 66 : 42;
        return `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
    }

    emitSparks(x, y, color, opts) {
        if (this.reducedMotion) return;
        this.sparks.burst(x, y, color, opts);
    }

    /**
     * Wrap a sprite that has left the viewport, preserving the overshoot
     * (modulo) instead of snapping it to the opposite edge. Snapping discarded
     * up to maxSpeed px of travel per wrap.
     *
     * @returns {boolean} true when the sprite teleported (trail must be reset).
     */
    wrapParticleIntoViewport(particle) {
        const width = this.logicalWidth;
        const height = this.logicalHeight;
        if (!(width > 0) || !(height > 0)) return false;

        let wrapped = false;
        if (particle.x < 0) {
            particle.x += width;
            wrapped = true;
        } else if (particle.x > width) {
            particle.x -= width;
            wrapped = true;
        }
        if (particle.y < 0) {
            particle.y += height;
            wrapped = true;
        } else if (particle.y > height) {
            particle.y -= height;
            wrapped = true;
        }

        if (particle.x < 0 || particle.x > width)
            particle.x = Math.max(0, Math.min(width, particle.x));
        if (particle.y < 0 || particle.y > height)
            particle.y = Math.max(0, Math.min(height, particle.y));

        return wrapped;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePosition.x = e.clientX - rect.left;
        this.mousePosition.y = e.clientY - rect.top;
    }

    handleTouchMove(e) {
        if (e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition.x = e.touches[0].clientX - rect.left;
            this.mousePosition.y = e.touches[0].clientY - rect.top;
        }
    }

    handleMouseLeave() {
        this.mousePosition.x = -1000;
        this.mousePosition.y = -1000;
    }

    onInteraction(callback) {
        this.onInteractionCallback = callback;
    }

    notifyInteraction(event) {
        if (typeof this.onInteractionCallback === 'function') {
            this.onInteractionCallback(event);
        }
    }

    hitTestSprite(clientX, clientY) {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const hitRadius = 36;
        const hitRadiusSq = hitRadius * hitRadius;

        for (let i = this.floatingParticles.length - 1; i >= 0; i--) {
            const p = this.floatingParticles[i];
            if (p.fireworksState && p.fireworksState.phase !== 'alive') continue;
            const dx = p.x - x;
            const dy = p.y - y;
            if (dx * dx + dy * dy <= hitRadiusSq) {
                return p;
            }
        }
        return null;
    }

    handlePointerDown(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hit = this.hitTestSprite(e.clientX, e.clientY);
        if (hit) {
            hit.isGrabbed = true;
            hit.trail.clear();
            hit.popV = (hit.popV || 0) + 0.25;
            this.emitSparks(x, y, hit.color, { count: 6, speed: 2.2 });
            this.grabbedSprites.set(e.pointerId, {
                particle: hit,
                lastX: x,
                lastY: y,
                vx: 0,
                vy: 0,
                lastTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
            });
            this.notifyInteraction({ type: 'grab', x, y, speed: 2 });
        } else {
            this.activePointers.set(e.pointerId, {
                x,
                y,
                startX: x,
                startY: y,
                startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
            });
            this.notifyInteraction({ type: 'touch', x, y, speed: 1 });
        }
    }

    handlePointerMove(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const grab = this.grabbedSprites.get(e.pointerId);
        if (grab) {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const dt = Math.max(1, now - grab.lastTime);
            grab.vx = ((x - grab.lastX) / dt) * 16.67;
            grab.vy = ((y - grab.lastY) / dt) * 16.67;
            grab.lastX = x;
            grab.lastY = y;
            grab.lastTime = now;

            grab.particle.x = x;
            grab.particle.y = y;

            const speed = Math.hypot(grab.vx, grab.vy);
            this.notifyInteraction({ type: 'drag', x, y, speed });
        } else if (this.activePointers.has(e.pointerId)) {
            const ptr = this.activePointers.get(e.pointerId);
            const moveDx = x - ptr.x;
            const moveDy = y - ptr.y;
            const moveDist = Math.hypot(moveDx, moveDy);
            ptr.x = x;
            ptr.y = y;
            if (moveDist > 2) {
                this.emitSparks(x, y, this.noteInk(x), {
                    count: 1,
                    speed: 0.8,
                    driftX: -moveDx * 0.08,
                    driftY: -moveDy * 0.08,
                });
            }
            this.notifyInteraction({ type: 'swirl', x, y, speed: 1.2 });
        }
    }

    handlePointerUp(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const grab = this.grabbedSprites.get(e.pointerId);
        if (grab) {
            grab.particle.isGrabbed = false;
            // Start a fresh trail from the drop point — never from the grab point.
            grab.particle.trail.clear();
            grab.particle.vx = Math.max(-12, Math.min(12, grab.vx || 0));
            grab.particle.vy = Math.max(-12, Math.min(12, grab.vy || 0));
            this.grabbedSprites.delete(e.pointerId);
            const speed = Math.hypot(grab.vx, grab.vy);
            if (speed > 2) {
                this.emitSparks(x, y, grab.particle.color, {
                    count: Math.min(14, 4 + Math.round(speed)),
                    speed: 2 + speed * 0.3,
                    driftX: grab.vx * 0.25,
                    driftY: grab.vy * 0.25,
                });
            }
            this.notifyInteraction({ type: 'fling', x, y, speed });
        } else if (this.activePointers.has(e.pointerId)) {
            const ptr = this.activePointers.get(e.pointerId);
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const heldDuration = now - ptr.startTime;
            // A page swipe that starts on empty canvas is quick too: only a press
            // that stayed put (and was not cancelled) counts as a tap.
            const travelled = Math.hypot(
                ptr.x - (ptr.startX ?? ptr.x),
                ptr.y - (ptr.startY ?? ptr.y)
            );
            if (ptr.isSingularity) {
                // Supernova bloom release!
                for (const particle of this.floatingParticles) {
                    if (particle.isGrabbed) continue;
                    const dx = particle.x - ptr.x;
                    const dy = particle.y - ptr.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    if (dist < 360) {
                        const blast = Math.min(14, (1 - dist / 360) * 12 + 3);
                        particle.vx = (dx / dist) * blast;
                        particle.vy = (dy / dist) * blast;
                        particle.popV = (particle.popV || 0) + 0.35;
                    }
                }
                this.ripples.push({
                    x: ptr.x,
                    y: ptr.y,
                    radius: 4,
                    maxRadius: 280,
                    alpha: 1.0,
                    baseAlpha: 1.0,
                    t: 0,
                    hue: hueForX(ptr.x, this.logicalWidth),
                });
                this.emitSparks(ptr.x, ptr.y, this.noteInk(ptr.x), { count: 24, speed: 5.5 });
                this.notifyInteraction({ type: 'supernova', x: ptr.x, y: ptr.y, speed: 5 });
            } else if (
                heldDuration < 280 &&
                travelled <= TAP_SLOP_PX &&
                e.type !== 'pointercancel'
            ) {
                // Quick tap on empty space -> ripple!
                this.ripples.push({
                    x: ptr.x,
                    y: ptr.y,
                    radius: 2,
                    maxRadius: 180,
                    alpha: 0.85,
                    baseAlpha: 0.85,
                    t: 0,
                    hue: hueForX(ptr.x, this.logicalWidth),
                });
                this.emitSparks(ptr.x, ptr.y, this.noteInk(ptr.x), { count: 10, speed: 3.2 });
                this.notifyInteraction({ type: 'ripple', x: ptr.x, y: ptr.y, speed: 3 });
            }
            this.activePointers.delete(e.pointerId);
        }
    }

    drawParticleShape(ctx, particle, x, y, size, alpha) {
        ctx.save?.();
        ctx.globalAlpha = alpha;

        const vx = particle.vx || 0;
        const vy = particle.vy || 0;
        const speed = Math.hypot(vx, vy);

        ctx.translate?.(x, y);

        // Disney Principle #1: Squash & Stretch along velocity vector
        if (!this.reducedMotion && speed > 0.8 && !particle.isGrabbed) {
            const angle = Math.atan2(vy, vx);
            const stretch = Math.min(1.8, 1 + speed * 0.08);
            const squash = 1 / Math.sqrt(stretch);
            ctx.rotate?.(angle);
            ctx.scale?.(stretch, squash);
        }

        // 1. Primary outer shape
        ctx.fillStyle = particle.color;
        this.renderShapeGeometry(ctx, particle.type, size);
        ctx.fill?.();

        // 2. Luminous Celestial Core: bright jewel-like inner nucleus
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.72;
        this.renderShapeGeometry(ctx, particle.type, size * 0.42);
        ctx.fill?.();

        ctx.restore?.();
    }

    renderShapeGeometry(ctx, type, size) {
        ctx.beginPath?.();
        switch (type) {
            case 'circle':
                ctx.arc?.(0, 0, size, 0, Math.PI * 2);
                break;
            case 'square':
                if (typeof ctx.rect === 'function') {
                    ctx.rect(-size, -size, size * 2, size * 2);
                } else if (typeof ctx.fillRect === 'function') {
                    ctx.fillRect(-size, -size, size * 2, size * 2);
                }
                break;
            case 'triangle':
                ctx.moveTo?.(0, -size * 1.15);
                ctx.lineTo?.(size, size * 0.85);
                ctx.lineTo?.(-size, size * 0.85);
                ctx.closePath?.();
                break;
            case 'diamond':
                ctx.moveTo?.(0, -size * 1.15);
                ctx.lineTo?.(size * 0.9, 0);
                ctx.lineTo?.(0, size * 1.15);
                ctx.lineTo?.(-size * 0.9, 0);
                ctx.closePath?.();
                break;
            default:
                ctx.arc?.(0, 0, size, 0, Math.PI * 2);
                break;
        }
    }

    /** Resolve a `{ light, dark }` token map against the live document theme. */
    themedInk(tokenMap) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return isDark ? tokenMap.dark : tokenMap.light;
    }

    renderParticles() {
        const baseBg = this.themedInk(this.canvasTint);
        const fadeAlpha = this.isDimmed ? 0.25 : 0.08;
        const bgColor = `rgba(${baseBg}, ${fadeAlpha})`;
        this.ctx.fillStyle = bgColor;
        // Logical units: the context is already scaled by devicePixelRatio, so
        // canvas.width/height (device px) would over-cover and put the motion
        // blur trail out of phase with the sprites.
        this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

        const particleAlpha = this.isDimmed ? 0.25 : 0.85;

        // Draw connections first (behind particles)
        this.drawConnections(particleAlpha);

        // Draw particle trails
        this.drawTrails(particleAlpha);

        if (this.ripples.length > 0) this.drawRipples();

        for (const ptr of this.activePointers.values()) {
            if (!ptr.isSingularity) continue;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const pulse = Math.sin(now / 140) * 4;
            const hue = hueForX(ptr.x, this.logicalWidth);
            const lightness = this.isDarkTheme() ? 68 : 45;
            this.ctx.save();
            this.ctx.strokeStyle = `hsla(${hue}, 100%, ${lightness}%, 0.65)`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(ptr.x, ptr.y, 24 + pulse, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, 0.15)`;
            this.ctx.fill();
            this.ctx.restore();
        }

        // Draw particles
        for (let particle of this.floatingParticles) {
            const eggScale = particle.fireworksState?.scale ?? 1;
            const eggAlpha = particle.fireworksState?.alpha ?? 1;
            if (eggAlpha <= 0.01 || eggScale <= 0.01) continue;

            if (particle.isGrabbed) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.6 * particleAlpha;
                this.ctx.strokeStyle = particle.color;
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = particle.color;
                this.ctx.shadowBlur = 20;
                this.ctx.beginPath();
                this.ctx.arc(
                    particle.x,
                    particle.y,
                    particle.size * 2.8 * (1 + 0.08 * Math.sin(this.lastFrameTime / 90)),
                    0,
                    Math.PI * 2
                );
                this.ctx.stroke();
                this.ctx.restore();
            }

            this.drawParticleShape(
                this.ctx,
                particle,
                particle.x,
                particle.y,
                particle.size * eggScale * (particle.pop ?? 1),
                particleAlpha * eggAlpha
            );
        }

        this.sparks.render(this.ctx, { additive: this.isDarkTheme() });

        if (this.isEasterEggActive && !this.isDimmed) {
            this.fireworksManager.render(this.ctx);
        }
    }

    /** Note-coloured double ring with a soft fill; thins as it fades. */
    drawRipples() {
        const ctx = this.ctx;
        ctx.save();
        for (const r of this.ripples) {
            const a = Math.max(0, r.alpha);
            const hue = r.hue ?? hueForX(r.x, this.logicalWidth);
            const lightness = this.isDarkTheme() ? 66 : 42;
            const ink = (alpha) => `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;

            ctx.fillStyle = ink(a * 0.1);
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = ink(a);
            ctx.lineWidth = 0.8 + 2.4 * a;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = ink(a * 0.5);
            ctx.lineWidth = 0.6 + 1.2 * a;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius * 0.72, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawConnections(alpha) {
        const fallbackInk = this.themedInk(this.constellationInk);
        const maxDistSq = this.connectionDistance * this.connectionDistance;
        this.ctx.lineWidth = 0.8;

        for (let i = 0; i < this.floatingParticles.length; i++) {
            const p1 = this.floatingParticles[i];
            if (p1.fireworksState && p1.fireworksState.phase !== 'alive') continue;
            // The link takes its colour from the sprite that owns it, so the
            // constellation spans the whole palette instead of a cyan haze.
            const linkInk = p1.rgb || fallbackInk;
            const nearby = this.getNeighboringParticles(p1);

            for (let p2 of nearby) {
                if (p1 === p2) continue;
                if (p2.fireworksState && p2.fireworksState.phase !== 'alive') continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxDistSq) {
                    // 0.34 is calibrated, not invented: with per-sprite ink the
                    // links no longer stack into one bright cyan mass, so the
                    // old 0.15 read as a faint wash (9.7k vivid px measured vs
                    // 17.6k here) while the hue spread stays full-spectrum.
                    const opacity = alpha * 0.34 * (1 - distSq / maxDistSq);
                    this.ctx.strokeStyle = `rgba(${linkInk}, ${opacity})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    drawTrails(alpha) {
        const ctx = this.ctx;
        const trailAlpha = alpha * 0.4;
        ctx.globalAlpha = trailAlpha;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const strokeRun = (run) => {
            if (run.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(run[0].x, run[0].y);
            for (let i = 1; i < run.length; i++) {
                ctx.lineTo(run[i].x, run[i].y);
            }
            ctx.stroke();
        };

        for (let particle of this.floatingParticles) {
            if (particle.fireworksState && particle.fireworksState.phase !== 'alive') continue;
            if (!particle.trail || particle.trail.length < 2) continue;

            ctx.strokeStyle = particle.color;
            // forEachRun drops teleport segments (edge wrap, drag, resize) so a
            // sprite can never paint a full-span line across the canvas.
            particle.trail.forEachRun(strokeRun, TRAIL_MAX_SEGMENT);
        }
        ctx.globalAlpha = 1;
    }

    startAnimationLoop() {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const dtMs = Math.min(100, Math.max(1, now - (this.lastFrameTime || now)));
        this.lastFrameTime = now;

        if (this.isEasterEggActive && !this.isDimmed) {
            for (let particle of this.floatingParticles) {
                const result = advanceSpriteLifecycle(particle, dtMs, Math.random, {
                    width: this.logicalWidth,
                    height: this.logicalHeight,
                });
                if (result.triggerBurst) {
                    this.fireworksManager.spawnBurst(particle.x, particle.y, particle.color);
                    this.notifyInteraction({
                        type: 'firework',
                        x: particle.x,
                        y: particle.y,
                        speed: 2,
                    });
                }
            }
            this.fireworksManager.update(dtMs);
        }

        // Fixed 60 Hz physics: see PHYSICS_STEP_MS. Frames that land between
        // steps (high-refresh displays) skip both update and draw, so motion
        // speed and trail length are identical on every display.
        this.stepAccumulator += dtMs;
        const steps = Math.min(
            MAX_STEPS_PER_FRAME,
            Math.floor((this.stepAccumulator + STEP_JITTER_MS) / PHYSICS_STEP_MS)
        );
        if (steps > 0) {
            this.stepAccumulator = Math.max(0, this.stepAccumulator - steps * PHYSICS_STEP_MS);
            for (let i = 0; i < steps; i++) this.updateParticlePositions();
            this.renderParticles();
        }
        this.animationFrameId = requestAnimationFrame(() => this.startAnimationLoop());
    }

    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    stop() {
        this.stopAnimation();
    }
    animate() {
        this.startAnimationLoop();
    }
    initDots() {
        this.createParticles();
    }
}
