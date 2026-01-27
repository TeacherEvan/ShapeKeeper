/**
 * ShapeKeeper Welcome Screen Animation
 * Implements flocking behavior (boids algorithm) with spatial partitioning for performance
 *
 * TODO: [OPTIMIZATION] Consider using Web Workers for particle physics calculations
 * TODO: [OPTIMIZATION] Implement offscreen canvas for particle pre-rendering
 * @module ui/WelcomeAnimation
 */

export class WelcomeAnimation {
    constructor() {
        this.canvas = document.getElementById('welcomeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.floatingParticles = []; // Renamed from 'dots' for semantic clarity
        this.particleCount = 150; // Total number of particles in animation
        this.animationFrameId = null; // Renamed for clarity
        this.isDimmed = false;
        this.spatialPartitionGrid = null; // Renamed for clarity
        this.partitionCellSize = 100; // Size of each cell in spatial grid

        this.initializeCanvas();
        this.createParticles();
        this.startAnimationLoop();

        // Handle window resize with debounced callback
        window.addEventListener('resize', () => this.handleViewportResize());
    }

    /**
     * Initialize canvas dimensions and spatial partitioning
     */
    initializeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.initializeSpatialPartitioning();
    }

    /**
     * Handle viewport resize events
     */
    handleViewportResize() {
        this.initializeCanvas();
    }

    /**
     * Initialize spatial partitioning grid for performance optimization
     * Reduces O(n²) neighbor lookups to O(n)
     */
    initializeSpatialPartitioning() {
        this.gridCols = Math.ceil(this.canvas.width / this.partitionCellSize);
        this.gridRows = Math.ceil(this.canvas.height / this.partitionCellSize);
        this.spatialPartitionGrid = Array(this.gridRows)
            .fill(null)
            .map(() =>
                Array(this.gridCols)
                    .fill(null)
                    .map(() => [])
            );
    }

    /**
     * Update spatial partition grid with current particle positions
     */
    updateSpatialPartitionGrid() {
        // Clear grid
        for (let row of this.spatialPartitionGrid) {
            for (let cell of row) {
                cell.length = 0;
            }
        }

        // Assign particles to grid cells
        for (let particle of this.floatingParticles) {
            const gridX = Math.floor(particle.x / this.partitionCellSize);
            const gridY = Math.floor(particle.y / this.partitionCellSize);
            if (gridX >= 0 && gridX < this.gridCols && gridY >= 0 && gridY < this.gridRows) {
                this.spatialPartitionGrid[gridY][gridX].push(particle);
            }
        }
    }

    /**
     * Get neighboring particles within the spatial partition
     * @param {Object} particle - The particle to find neighbors for
     * @returns {Array} Array of neighboring particles
     */
    getNeighboringParticles(particle) {
        const gridX = Math.floor(particle.x / this.partitionCellSize);
        const gridY = Math.floor(particle.y / this.partitionCellSize);
        const neighbors = [];

        // Check surrounding cells (3x3 grid around particle)
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

    /**
     * Transition animation to game screen (dimmed mode)
     */
    transitionToGameScreen() {
        const gameCanvas = document.getElementById('gameBackgroundCanvas');
        if (gameCanvas) {
            this.canvas = gameCanvas;
            this.ctx = gameCanvas.getContext('2d');
            this.isDimmed = true;
            this.initializeCanvas();
        }
    }

    /**
     * Transition animation back to main menu
     */
    transitionToMainMenu() {
        const welcomeCanvas = document.getElementById('welcomeCanvas');
        if (welcomeCanvas) {
            this.canvas = welcomeCanvas;
            this.ctx = welcomeCanvas.getContext('2d');
            this.isDimmed = false;
            this.initializeCanvas();
        }
    }

    // Legacy method names for backward compatibility
    moveToGameScreen() {
        this.transitionToGameScreen();
    }
    moveBackToMainMenu() {
        this.transitionToMainMenu();
    }

    /**
     * Create initial particle set with randomized properties
     */
    createParticles() {
        const particleColors = [
            '#FF0000',
            '#FF4500',
            '#FF6B00',
            '#FF8C00',
            '#FFA500',
            '#FFD700',
            '#FFFF00',
            '#00FF00',
            '#00FF7F',
            '#00FFFF',
            '#0080FF',
            '#0000FF',
            '#4B0082',
            '#8B00FF',
            '#FF00FF',
            '#FF1493',
            '#FF69B4',
            '#00CED1',
            '#20B2AA',
            '#3CB371',
            '#9370DB',
            '#BA55D3',
            '#FF6347',
            '#FF4500',
            '#DC143C',
        ];

        for (let i = 0; i < this.particleCount; i++) {
            this.floatingParticles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color: particleColors[Math.floor(Math.random() * particleColors.length)],
                size: 3 + Math.random() * 4,
                neighborhoodRadius: 100,
                maxSpeed: 2,
                maxForce: 0.05,
            });
        }
    }

    /**
     * Apply boids/flocking algorithm for fish-like movement
     * Optimized with spatial partitioning for O(n) performance
     * @param {Object} particle - The particle to apply flocking behavior to
     */
    applyFlockingBehavior(particle) {
        let separation = { x: 0, y: 0 };
        let alignment = { x: 0, y: 0 };
        let cohesion = { x: 0, y: 0 };
        let neighborCount = 0;

        // Get neighbors using spatial partitioning for better performance
        const nearbyParticles = this.getNeighboringParticles(particle);

        // Check neighbors (only nearby particles now, huge performance improvement)
        for (let other of nearbyParticles) {
            if (other === particle) continue;

            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            const distSq = dx * dx + dy * dy; // Use squared distance to avoid sqrt
            const maxDistSq = particle.neighborhoodRadius * particle.neighborhoodRadius;

            if (distSq < maxDistSq && distSq > 0) {
                neighborCount++;

                const dist = Math.sqrt(distSq);

                // Separation: steer away from neighbors
                if (dist < 25) {
                    separation.x -= dx / dist;
                    separation.y -= dy / dist;
                }

                // Alignment: steer towards average heading of neighbors
                alignment.x += other.vx;
                alignment.y += other.vy;

                // Cohesion: steer towards average position of neighbors
                cohesion.x += other.x;
                cohesion.y += other.y;
            }
        }

        if (neighborCount > 0) {
            // Average the alignment
            alignment.x /= neighborCount;
            alignment.y /= neighborCount;

            // Calculate cohesion center
            cohesion.x = cohesion.x / neighborCount - particle.x;
            cohesion.y = cohesion.y / neighborCount - particle.y;
        }

        // Apply forces with different weights
        const separationWeight = 1.5;
        const alignmentWeight = 1.0;
        const cohesionWeight = 1.0;

        particle.vx += separation.x * separationWeight * particle.maxForce;
        particle.vy += separation.y * separationWeight * particle.maxForce;
        particle.vx += alignment.x * alignmentWeight * particle.maxForce * 0.1;
        particle.vy += alignment.y * alignmentWeight * particle.maxForce * 0.1;
        particle.vx += cohesion.x * cohesionWeight * particle.maxForce * 0.01;
        particle.vy += cohesion.y * cohesionWeight * particle.maxForce * 0.01;

        // Limit speed
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > particle.maxSpeed) {
            particle.vx = (particle.vx / speed) * particle.maxSpeed;
            particle.vy = (particle.vy / speed) * particle.maxSpeed;
        }
    }

    /**
     * Update all particle positions based on flocking behavior
     */
    updateParticlePositions() {
        // Update spatial grid for efficient neighbor lookups
        this.updateSpatialPartitionGrid();

        for (let particle of this.floatingParticles) {
            // Apply flocking behavior
            this.applyFlockingBehavior(particle);

            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Wrap around edges
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
        }
    }

    /**
     * Render particles to the canvas
     */
    renderParticles() {
        // Clear with slight fade for trail effect (dimmed in game mode)
        // Read background color from CSS variables for theme support
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const baseBg = isDark ? '26, 26, 46' : '255, 255, 255'; // --bg-primary RGB values
        const fadeAlpha = this.isDimmed ? 0.3 : 0.1;
        const bgColor = `rgba(${baseBg}, ${fadeAlpha})`;
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw particles (dimmed in game mode)
        const particleAlpha = this.isDimmed ? 0.3 : 1.0;
        for (let particle of this.floatingParticles) {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);

            if (this.isDimmed) {
                // Convert hex to rgba with reduced opacity
                const r = parseInt(particle.color.slice(1, 3), 16);
                const g = parseInt(particle.color.slice(3, 5), 16);
                const b = parseInt(particle.color.slice(5, 7), 16);
                this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particleAlpha})`;
            } else {
                this.ctx.fillStyle = particle.color;
            }
            this.ctx.fill();
        }
    }

    /**
     * Main animation loop
     */
    startAnimationLoop() {
        this.updateParticlePositions();
        this.renderParticles();
        this.animationFrameId = requestAnimationFrame(() => this.startAnimationLoop());
    }

    /**
     * Stop the animation loop
     */
    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Legacy methods for backward compatibility
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