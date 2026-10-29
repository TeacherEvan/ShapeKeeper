/**
 * ShapeKeeper Welcome Screen Animation
 * Implements flocking behavior (boids algorithm) with spatial partitioning for performance
 * Enhanced with modern visual effects: connection lines, mouse interaction, particle trails
 *
 * @module ui/WelcomeAnimation
 */

import { LevelsProgress } from './LevelsProgress.js';
import { SpriteFireworksManager, advanceSpriteLifecycle } from './SpriteFireworks.js';
import { SPRITE_PALETTES, hexToRgbChannels } from './sprite-palette.js';
import { SpriteTrail, TRAIL_CAPACITY, TRAIL_MAX_SEGMENT } from './sprite-trail.js';

export class WelcomeAnimation {
    constructor() {
        this.canvas = document.getElementById('welcomeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.floatingParticles = [];
        const levelsState = LevelsProgress.getState();
        // Default 120 sprites on launch until first Levels game is played;
        // once Levels is triggered, only displayed obtained sprites (starting at 1).
        this.particleCount = levelsState.levelsTriggered
            ? Math.max(1, levelsState.spritesObtained)
            : 120;
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

    createSingleParticle() {
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
        if (state.levelsTriggered) {
            const targetCount = Math.max(1, state.spritesObtained);
            this.particleCount = targetCount;
            while (this.floatingParticles.length > targetCount) {
                this.floatingParticles.pop();
            }
            while (this.floatingParticles.length < targetCount) {
                this.floatingParticles.push(this.createSingleParticle());
            }
        }
    }

    setSideScreenActive(active) {
        this.isSideScreenActive = active;
        const state = LevelsProgress.getState();
        const targetCount = active
            ? 120
            : state.levelsTriggered
              ? Math.max(1, state.spritesObtained)
              : 120;

        this.particleCount = targetCount;
        while (this.floatingParticles.length < targetCount) {
            this.floatingParticles.push(this.createSingleParticle());
        }
        while (this.floatingParticles.length > targetCount) {
            this.floatingParticles.pop();
        }
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

        for (let particle of this.floatingParticles) {
            // A grabbed sprite is teleported by the pointer: its stored history
            // would smear a diagonal streak across the canvas, so drop it.
            if (particle.isGrabbed) {
                particle.trail.clear();
                continue;
            }

            particle.trail.push(particle.x, particle.y);

            this.applyFlockingBehavior(particle);

            // Swirl around active pointers
            for (const ptr of this.activePointers.values()) {
                const dx = ptr.x - particle.x;
                const dy = ptr.y - particle.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 250 * 250 && distSq > 400) {
                    const dist = Math.sqrt(distSq);
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
                    particle.vx += (dx / dist) * 1.8;
                    particle.vy += (dy / dist) * 1.8;
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

        // Update ripples
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += 4.5;
            r.alpha -= 0.02;
            if (r.alpha <= 0 || r.radius >= r.maxRadius) {
                this.ripples.splice(i, 1);
            }
        }
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
            ptr.x = x;
            ptr.y = y;
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
            this.notifyInteraction({ type: 'fling', x, y, speed });
        } else if (this.activePointers.has(e.pointerId)) {
            const ptr = this.activePointers.get(e.pointerId);
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const heldDuration = now - ptr.startTime;
            if (heldDuration < 280) {
                // Quick tap on empty space -> ripple!
                this.ripples.push({
                    x: ptr.x,
                    y: ptr.y,
                    radius: 2,
                    maxRadius: 180,
                    alpha: 0.85,
                });
                this.notifyInteraction({ type: 'ripple', x: ptr.x, y: ptr.y, speed: 3 });
            }
            this.activePointers.delete(e.pointerId);
        }
    }

    drawParticleShape(ctx, particle, x, y, size, alpha) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;

        switch (particle.type) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'square':
                ctx.fillRect(x - size, y - size, size * 2, size * 2);
                break;
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y + size);
                ctx.lineTo(x - size, y + size);
                ctx.closePath();
                ctx.fill();
                break;
            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y);
                ctx.lineTo(x, y + size);
                ctx.lineTo(x - size, y);
                ctx.closePath();
                ctx.fill();
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

        if (this.ripples.length > 0) {
            this.ctx.save();
            for (const r of this.ripples) {
                this.ctx.strokeStyle = `rgba(0, 240, 255, ${Math.max(0, r.alpha)})`;
                this.ctx.lineWidth = 2.5;
                this.ctx.beginPath();
                this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
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
                this.ctx.arc(particle.x, particle.y, particle.size * 2.8, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();
            }

            this.drawParticleShape(
                this.ctx,
                particle,
                particle.x,
                particle.y,
                particle.size * eggScale,
                particleAlpha * eggAlpha
            );
        }

        if (this.isEasterEggActive && !this.isDimmed) {
            this.fireworksManager.render(this.ctx);
        }
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

        this.updateParticlePositions();
        this.renderParticles();
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
