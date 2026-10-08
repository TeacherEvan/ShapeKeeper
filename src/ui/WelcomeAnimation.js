/**
 * ShapeKeeper Welcome Screen Animation
 * Implements flocking behavior (boids algorithm) with spatial partitioning for performance
 * Enhanced with modern visual effects: connection lines, mouse interaction, particle trails
 *
 * @module ui/WelcomeAnimation
 */

export class WelcomeAnimation {
    constructor() {
        this.canvas = document.getElementById('welcomeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.floatingParticles = [];
        this.particleCount = 120;
        this.animationFrameId = null;
        this.isDimmed = false;
        this.spatialPartitionGrid = null;
        this.partitionCellSize = 120;
        this.mousePosition = { x: -1000, y: -1000 };
        this.mouseInfluenceRadius = 200;
        this.connectionDistance = 140;
        this.particleTypes = ['circle', 'square', 'triangle', 'diamond'];
        this.colorPalette = {
            light: [
                { primary: '#2563eb', secondary: '#3b82f6', accent: '#60a5fa' }, // Blue
                { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#a78bfa' }, // Purple
                { primary: '#059669', secondary: '#10b981', accent: '#34d399' }, // Emerald
                { primary: '#dc2626', secondary: '#ef4444', accent: '#f87171' }, // Red
            ],
            dark: [
                { primary: '#60a5fa', secondary: '#93c5fd', accent: '#bfdbfe' },
                { primary: '#a78bfa', secondary: '#c4b5fd', accent: '#ddd6fe' },
                { primary: '#34d399', secondary: '#6ee7b7', accent: '#a7f3d0' },
                { primary: '#f87171', secondary: '#fca5a5', accent: '#fecaca' },
            ],
        };

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

    handleViewportResize() {
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
            this.canvas = gameCanvas;
            this.ctx = gameCanvas.getContext('2d');
            this.isDimmed = true;
            this.initializeCanvas();
        }
    }

    transitionToMainMenu() {
        const welcomeCanvas = document.getElementById('welcomeCanvas');
        if (welcomeCanvas) {
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

    createParticles() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const palette = this.colorPalette[isDark ? 'dark' : 'light'];

        for (let i = 0; i < this.particleCount; i++) {
            const colorSet = palette[Math.floor(Math.random() * palette.length)];
            const colorVariant = Math.random();
            let color;
            if (colorVariant < 0.4) color = colorSet.primary;
            else if (colorVariant < 0.7) color = colorSet.secondary;
            else color = colorSet.accent;

            this.floatingParticles.push({
                x: Math.random() * this.logicalWidth,
                y: Math.random() * this.logicalHeight,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                color,
                baseColor: color,
                size: 2 + Math.random() * 3,
                baseSize: 2 + Math.random() * 3,
                type: this.particleTypes[Math.floor(Math.random() * this.particleTypes.length)],
                neighborhoodRadius: 120,
                maxSpeed: 1.8,
                maxForce: 0.04,
                trail: [],
                maxTrailLength: 8,
                pulsePhase: Math.random() * Math.PI * 2,
                pulseSpeed: 0.02 + Math.random() * 0.03,
            });
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
            particle.trail.push({ x: particle.x, y: particle.y });
            if (particle.trail.length > particle.maxTrailLength) {
                particle.trail.shift();
            }

            this.applyFlockingBehavior(particle);

            particle.x += particle.vx;
            particle.y += particle.vy;

            particle.pulsePhase += particle.pulseSpeed;
            particle.size = particle.baseSize * (0.8 + 0.2 * Math.sin(particle.pulsePhase));

            if (particle.x < 0) particle.x = this.logicalWidth;
            if (particle.x > this.logicalWidth) particle.x = 0;
            if (particle.y < 0) particle.y = this.logicalHeight;
            if (particle.y > this.logicalHeight) particle.y = 0;
        }
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

    renderParticles() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const baseBg = isDark ? '12, 8, 30' : '255, 255, 255';
        const fadeAlpha = this.isDimmed ? 0.25 : 0.08;
        const bgColor = `rgba(${baseBg}, ${fadeAlpha})`;
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const particleAlpha = this.isDimmed ? 0.25 : 0.85;

        // Draw connections first (behind particles)
        this.drawConnections(particleAlpha);

        // Draw particle trails
        this.drawTrails(particleAlpha);

        // Draw particles
        for (let particle of this.floatingParticles) {
            this.drawParticleShape(
                this.ctx,
                particle,
                particle.x,
                particle.y,
                particle.size,
                particleAlpha
            );
        }
    }

    drawConnections(alpha) {
        this.ctx.strokeStyle = `rgba(100, 100, 120, ${alpha * 0.15})`;
        this.ctx.lineWidth = 0.8;

        for (let i = 0; i < this.floatingParticles.length; i++) {
            const p1 = this.floatingParticles[i];
            const nearby = this.getNeighboringParticles(p1);

            for (let p2 of nearby) {
                if (p1 === p2) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < this.connectionDistance * this.connectionDistance) {
                    const opacity =
                        alpha *
                        0.15 *
                        (1 - distSq / (this.connectionDistance * this.connectionDistance));
                    this.ctx.strokeStyle = `rgba(100, 100, 120, ${opacity})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    drawTrails(alpha) {
        for (let particle of this.floatingParticles) {
            if (particle.trail.length < 2) continue;

            const trailAlpha = alpha * 0.4;
            this.ctx.strokeStyle = particle.color;
            this.ctx.globalAlpha = trailAlpha;
            this.ctx.lineWidth = 1.5;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            this.ctx.beginPath();
            this.ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
            for (let i = 1; i < particle.trail.length; i++) {
                this.ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
            }
            this.ctx.stroke();
        }
        this.ctx.globalAlpha = 1;
    }

    startAnimationLoop() {
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
