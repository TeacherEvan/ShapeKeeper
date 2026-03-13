import { AnimationSystem } from './animation-system.js';
import { GAME_CONSTANTS } from './constants.js';
import { EffectSystem } from './effect-system.js';
import { GameLogic } from './game-logic.js';
import { GameState } from './game-state.js';
import { InputHandler } from './input-handler.js';
import { ParticleSystem } from './particle-system.js';
import { Renderer } from './renderer.js';
import { SoundManager } from './sound-manager.js';
import { UIManager } from './ui-manager.js';

export class DotsAndBoxesGame {
    constructor(gridSize, player1Color, player2Color, options = {}) {
        // Store initial parameters
        this.gridSize = gridSize;
        this.player1Color = player1Color;
        this.player2Color = player2Color;
        this.options = options;

        // Initialize canvas and context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Initialize all systems
        this.soundManager = new SoundManager();
        this.particleSystem = new ParticleSystem();
        this.animationSystem = new AnimationSystem();
        this.gameState = new GameState(this);
        this.gameLogic = new GameLogic(this);
        this.effectSystem = new EffectSystem(this);
        this.uiManager = new UIManager(this);
        this.renderer = new Renderer(this);

        this.linkSystemState(this.animationSystem, [
            'effectAnimations',
            'invalidLineFlash',
            'lineDrawings',
            'multiplierAnimations',
            'pulsatingLines',
            'sparkleEmojis',
            'squareAnimations',
            'touchVisuals',
        ]);
        this.linkSystemState(this.particleSystem, ['ambientParticles', 'particles']);

        // Setup canvas and initialize game
        this.gameState.setupCanvas();
        this.inputHandler = new InputHandler(this.canvas, this);
        this.effectSystem.initializeMultipliers();
        this.effectSystem.initializeTileEffects();
        this.particleSystem.initializeAmbientParticles();

        // Setup event listeners
        this.gameState.setupEventListeners();
        this.setupPopulateButton();

        requestAnimationFrame(() => {
            this.canvas?.focus({ preventScroll: true });
        });

        // Start the game
        this.renderer.draw();
        this.uiManager.updateUI();
        this.animate();

        // Hide loading skeleton unless startup flow is waiting on an
        // authoritative multiplayer payload.
        if (!this.options.deferInitialReady) {
            this.uiManager.displayLoadingSkeleton(false);
        }
    }

    linkSystemState(system, properties) {
        properties.forEach((property) => {
            if (typeof system[property] === 'undefined') {
                system[property] = this[property];
            }

            Object.defineProperty(this, property, {
                configurable: true,
                enumerable: true,
                get: () => system[property],
                set: (value) => {
                    system[property] = value;
                },
            });
        });
    }

    getLineKey(dot1, dot2) {
        return this.gameLogic.getLineKey(dot1, dot2);
    }

    parseLineKey(lineKey) {
        return this.gameLogic.parseLineKey(lineKey);
    }

    parseSquareKey(squareKey) {
        return this.gameLogic.parseSquareKey(squareKey);
    }

    playLineSound() {
        this.soundManager.playLineSound();
    }

    playSquareSound(comboCount = 1) {
        this.soundManager.playSquareSound(comboCount);
    }

    triggerSquareAnimation(squareKey, playerNumber = this.currentPlayer) {
        const playerColor = playerNumber === 1 ? this.player1Color : this.player2Color;

        this.animationSystem.triggerSquareAnimation(
            squareKey,
            this.gameLogic.parseSquareKey,
            this.offsetX,
            this.offsetY,
            this.cellSize,
            playerColor,
            this.particleSystem.spawnParticles.bind(this.particleSystem),
            this.particleSystem.spawnSparkleEmojis?.bind(this.particleSystem)
        );
    }

    showWinner() {
        this.uiManager.showWinner();
    }

    /**
     * Setup populate button
     */
    setupPopulateButton() {
        const populateBtn = document.getElementById('populateBtn');
        if (populateBtn) {
            populateBtn.addEventListener('click', () => this.gameState.handlePopulate());
        }

        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.soundManager.toggleSound());
        }

        this.uiManager.updatePopulateButtonVisibility();
    }

    /**
     * Draw line between two dots
     */
    async drawLine(dot1, dot2) {
        const lineKey = this.gameLogic.getLineKey(dot1, dot2);

        this.soundManager.ensureAudioContext();

        if (this.isMultiplayer) {
            this.isMyTurn = this.currentPlayer === this.myPlayerNumber;
            if (!this.isMyTurn) return;

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.drawLine(lineKey);
                if (result.error) {
                    console.error('[Game] Error drawing line:', result.error);
                    return;
                }
                this.selectedDot = null;
                this.selectionLocked = false;
                this.selectionRibbon = null;
                return;
            }
        }

        if (!this.lines.has(lineKey)) {
            this.lines.add(lineKey);

            const playerEffects = this.playerEffects[this.currentPlayer];
            let isGhostLine = false;
            if (playerEffects.ghostLines > 0) {
                playerEffects.ghostLines--;
                isGhostLine = true;
                this.ghostLines.add(lineKey);
            }

            this.lineOwners.set(lineKey, this.currentPlayer);
            this.animationSystem.addPulsatingLine(lineKey, this.currentPlayer, isGhostLine);
            this.animationSystem.addLineDrawing(
                lineKey,
                dot1,
                dot2,
                this.currentPlayer,
                isGhostLine,
                this.offsetX,
                this.offsetY,
                this.cellSize
            );

            this.soundManager.playLineSound();

            const completedTriangles = this.gameLogic.checkForTriangles(lineKey);
            completedTriangles.forEach((tri) => {
                this.triangles[tri.key] = this.currentPlayer;
                const cellKey = this.gameLogic.getTriangleCellKey(tri.vertices);
                if (!this.triangleCellOwners.has(cellKey)) {
                    this.triangleCellOwners.set(cellKey, new Set());
                }
                this.triangleCellOwners.get(cellKey).add(this.currentPlayer);
                this.gameLogic.claimCell(
                    parseInt(cellKey.split(',')[0]),
                    parseInt(cellKey.split(',')[1])
                );
            });

            const completedSquares = this.gameLogic.checkForSquares(lineKey);

            if (completedSquares.length > 0) {
                const effects = this.playerEffects[this.currentPlayer];
                for (const squareKey of completedSquares) {
                    if (effects.shieldCount > 0) {
                        this.protectedSquares.add(squareKey);
                        effects.shieldCount--;
                    }
                }
            }

            const totalShapes = completedSquares.length + completedTriangles.length;

            if (totalShapes === 0) {
                if (playerEffects.doubleLine) {
                    playerEffects.doubleLine = false;
                    this.uiManager.triggerDoubleLineReminder();
                } else {
                    this.comboCount = 0;
                    this.gameState.switchToNextPlayer();
                }
            } else {
                let basePoints = completedSquares.length + completedTriangles.length * 0.5;

                if (this.playerEffects[this.currentPlayer].doublePointsCount > 0) {
                    basePoints *= 2;
                    this.playerEffects[this.currentPlayer].doublePointsCount--;
                    this.uiManager.triggerDoublePointsVisual();
                }

                this.scores[this.currentPlayer] += basePoints;

                if (this.lastComboPlayer === this.currentPlayer) {
                    this.comboCount += totalShapes;
                } else {
                    this.comboCount = totalShapes;
                    this.lastComboPlayer = this.currentPlayer;
                }

                if (this.comboCount >= GAME_CONSTANTS.COMBO_FLASH_THRESHOLD) {
                    this.comboFlashActive = true;
                    this.soundManager.playComboSound(this.comboCount);
                }
                if (this.comboCount >= GAME_CONSTANTS.COMBO_PULSE_THRESHOLD) {
                    this.screenPulse = Math.min(this.comboCount * 0.3, 2);
                }
                if (this.comboCount >= GAME_CONSTANTS.COMBO_EPIC_THRESHOLD) {
                    this.particleSystem.createEpicParticles();
                }

                completedSquares.forEach((squareKey) => {
                    this.animationSystem.triggerSquareAnimation(
                        squareKey,
                        this.gameLogic.parseSquareKey,
                        this.offsetX,
                        this.offsetY,
                        this.cellSize,
                        this.currentPlayer === 1 ? this.player1Color : this.player2Color,
                        this.particleSystem.spawnParticles,
                        this.particleSystem.spawnSparkleEmojis
                    );
                });

                completedTriangles.forEach((tri) => {
                    this.animationSystem.triggerTriangleAnimation(
                        tri.key,
                        tri,
                        this.currentPlayer === 1 ? this.player1Color : this.player2Color,
                        this.particleSystem.spawnParticles
                    );
                });

                this.soundManager.playSquareSound(this.comboCount);

                if (totalShapes >= 2) {
                    this.shakeIntensity = totalShapes * 2;
                }
            }

            this.uiManager.updateUI();
            this.gameState.checkGameOver();
            this.uiManager.updatePopulateButtonVisibility();

            this.selectedDot = null;
            this.selectionLocked = false;
            this.selectionRibbon = null;
        }
    }

    /**
     * Main animation loop
     */
    animate() {
        const now = Date.now();

        // Update particles
        this.particleSystem.updateParticles(this.logicalWidth, this.logicalHeight);

        // Update animations
        this.animationSystem.updateAnimations(now);

        // Decay effects
        if (this.shakeIntensity > 0.1) {
            this.shakeIntensity *= this.shakeDecay;
        } else {
            this.shakeIntensity = 0;
        }

        if (this.screenPulse > 0.01) {
            this.screenPulse *= 0.92;
        } else {
            this.screenPulse = 0;
        }

        this.uiManager.updateUI();

        const hasActiveAnimations =
            this.particleSystem.particles.length > 0 ||
            this.animationSystem.squareAnimations.length > 0 ||
            this.animationSystem.touchVisuals.length > 0 ||
            this.animationSystem.sparkleEmojis.length > 0 ||
            this.animationSystem.pulsatingLines.length > 0 ||
            this.animationSystem.multiplierAnimations?.length > 0 ||
            this.animationSystem.lineDrawings.length > 0 ||
            this.invalidLineFlash ||
            this.shakeIntensity > 0 ||
            this.screenPulse > 0 ||
            this.hoveredDot ||
            this.selectionRibbon ||
            this.selectedDot;

        const ambientRedraw = this.particleSystem.ambientParticles.length > 0 && now % 48 < 16;

        if (hasActiveAnimations || ambientRedraw) {
            this.renderer.draw();
        }

        requestAnimationFrame(() => this.animate());
    }

    /**
     * Draw method (delegated to renderer)
     */
    draw() {
        this.renderer.draw();
    }
}
