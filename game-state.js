/**
 * ShapeKeeper - Game State
 * Game state management and initialization
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { GAME_CONSTANTS } from './constants.js';
import { generateRandomColor } from './utils.js';

export class GameState {
    constructor(game) {
        this.game = game;
        this.initializeGameState();
    }

    /**
     * Initialize game state
     */
    initializeGameState() {
        this.game.gridSize = this.game.gridSize;
        this.game.player1Color = this.game.player1Color;
        this.game.player2Color = this.game.player2Color;
        this.game.populateColor = generateRandomColor();
        this.game.currentPlayer = 1;
        this.game.scores = { 1: 0, 2: 0 };
        this.game.lines = new Set();
        this.game.ghostLines = new Set();
        this.game.squares = {};
        this.game.triangles = {};
        this.game.triangleCellOwners = new Map();
        this.game.claimedCells = new Set();
        this.game.selectedDot = null;
        this.game.pulsatingLines = [];
        this.game.lineOwners = new Map();

        this.game.partyModeEnabled = this.game.options.partyModeEnabled !== false;

        this.game.activeTouches = new Map();
        this.game.touchVisuals = [];
        this.game.touchStartDot = null;

        this.game.lastInteractionTime = 0;
        this.game.selectionLocked = false;
        this.game.lastTouchTime = 0;

        this.game.squareAnimations = [];
        this.game.particles = [];
        this.game.sparkleEmojis = [];

        this.game.squareMultipliers = {};
        this.game.revealedMultipliers = new Set();

        this.game.tileEffects = {};
        this.game.revealedEffects = new Set();
        this.game.activatedEffects = new Set();
        this.game.pendingEffect = null;

        this.game.playerEffects = {
            1: {
                frozenTurns: 0,
                shieldCount: 0,
                doublePointsCount: 0,
                ghostLines: 0,
                bonusTurns: 0,
                doubleLine: false,
            },
            2: {
                frozenTurns: 0,
                shieldCount: 0,
                doublePointsCount: 0,
                ghostLines: 0,
                bonusTurns: 0,
                doubleLine: false,
            },
        };

        this.game.protectedSquares = new Set();

        this.game.effectAnimations = [];
        this.game.effectShimmer = 0;

        this.game.displayedScores = { 1: 0, 2: 0 };
        this.game.scoreAnimationSpeed = 0.1;

        this.game.lineDrawings = [];
        this.game.shakeIntensity = 0;
        this.game.shakeDecay = 0.9;
        this.game.invalidLineFlash = null;
        this.game.hoveredDot = null;

        this.game.selectionRibbon = null;

        this.game.ambientParticles = [];
        this.game.backgroundHue = 220;

        this.game.comboCount = 0;
        this.game.lastComboPlayer = 0;
        this.game.comboFlashActive = false;
        this.game.screenPulse = 0;

        this.game.soundEnabled = true;

        this.game.isMultiplayer = false;
        this.game.myPlayerNumber = 1;
        this.game.isMyTurn = true;
        this.game.isHost = false;

        this.game.lastUIUpdate = 0;
        this.game.uiUpdateInterval = 16;
    }

    /**
     * Setup canvas and grid
     */
    setupCanvas() {
        const container = this.game.canvas?.parentElement;
        if (!container) {
            console.warn('[Game] Cannot setup canvas: container not found');
            return;
        }
        const maxWidth = container.clientWidth - 40;
        const maxHeight = container.clientHeight - 40;

        if (typeof this.game.gridSize === 'number') {
            const aspectRatio = maxWidth / maxHeight;

            if (aspectRatio > 1.5) {
                const totalSquares = (this.game.gridSize - 1) * (this.game.gridSize - 1);
                this.game.gridCols = Math.ceil(Math.sqrt(totalSquares * aspectRatio));
                this.game.gridRows = Math.ceil(totalSquares / (this.game.gridCols - 1)) + 1;

                this.game.gridCols = Math.max(this.game.gridCols, Math.ceil(this.game.gridSize * 1.2));
                this.game.gridRows = Math.max(this.game.gridRows, Math.ceil(this.game.gridSize * 0.6));
            } else if (aspectRatio < 0.75) {
                const totalSquares = (this.game.gridSize - 1) * (this.game.gridSize - 1);
                this.game.gridRows = Math.ceil(Math.sqrt(totalSquares / aspectRatio));
                this.game.gridCols = Math.ceil(totalSquares / (this.game.gridRows - 1)) + 1;

                this.game.gridRows = Math.max(this.game.gridRows, Math.ceil(this.game.gridSize * 1.2));
                this.game.gridCols = Math.max(this.game.gridCols, Math.ceil(this.game.gridSize * 0.6));
            } else {
                this.game.gridCols = this.game.gridSize;
                this.game.gridRows = this.game.gridSize;
            }
        } else {
            this.game.gridCols = this.game.gridSize.cols || this.game.gridSize;
            this.game.gridRows = this.game.gridSize.rows || this.game.gridSize;
        }

        const cellSizeWidth = Math.floor(maxWidth / (this.game.gridCols - 1));
        const cellSizeHeight = Math.floor(maxHeight / (this.game.gridRows - 1));
        const cellSize = Math.min(cellSizeWidth, cellSizeHeight);

        this.game.cellSize = Math.max(
            GAME_CONSTANTS.CELL_SIZE_MIN,
            Math.min(cellSize, GAME_CONSTANTS.CELL_SIZE_MAX)
        );
        const logicalWidth = (this.game.gridCols - 1) * this.game.cellSize + GAME_CONSTANTS.GRID_OFFSET * 2;
        const logicalHeight =
            (this.game.gridRows - 1) * this.game.cellSize + GAME_CONSTANTS.GRID_OFFSET * 2;

        this.game.logicalWidth = logicalWidth;
        this.game.logicalHeight = logicalHeight;

        const dpr = window.devicePixelRatio || 1;
        this.game.canvas.width = logicalWidth * dpr;
        this.game.canvas.height = logicalHeight * dpr;
        this.game.canvas.style.width = logicalWidth + 'px';
        this.game.canvas.style.height = logicalHeight + 'px';

        this.game.offsetX = GAME_CONSTANTS.GRID_OFFSET;
        this.game.offsetY = GAME_CONSTANTS.GRID_OFFSET;

        const oldCanvas = this.game.canvas;
        const newCanvas = oldCanvas.cloneNode(true);
        oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
        this.game.canvas = newCanvas;
        this.game.ctx = newCanvas.getContext('2d');

        this.game.ctx.scale(dpr, dpr);

        this.game.dotsCanvas = document.createElement('canvas');
        this.game.dotsCanvas.width = this.game.canvas.width;
        this.game.dotsCanvas.height = this.game.canvas.height;
        this.game.dotsCtx = this.game.dotsCanvas.getContext('2d');
        this.game.dotsCtx.scale(dpr, dpr);

        this.renderStaticDots();
    }

    /**
     * Render static dots
     */
    renderStaticDots() {
        if (!this.game.dotsCtx) return;

        this.game.dotsCtx.clearRect(0, 0, this.game.dotsCanvas.width, this.game.dotsCanvas.height);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.game.dotsCtx.fillStyle = isDark ? '#4a5568' : '#cbd5e0';

        for (let r = 0; r < this.game.gridRows; r++) {
            for (let c = 0; c < this.game.gridCols; c++) {
                this.game.dotsCtx.beginPath();
                this.game.dotsCtx.arc(
                    this.game.offsetX + c * this.game.cellSize,
                    this.game.offsetY + r * this.game.cellSize,
                    GAME_CONSTANTS.DOT_RADIUS,
                    0,
                    Math.PI * 2
                );
                this.game.dotsCtx.fill();
            }
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('resize', () => {
            if (this.game.resizeTimeout) {
                clearTimeout(this.game.resizeTimeout);
            }
            this.game.resizeTimeout = setTimeout(() => {
                this.game.uiManager.displayLoadingSkeleton(true);
                this.setupCanvas();
                this.game.draw();
                this.game.uiManager.displayLoadingSkeleton(false);
            }, 300);
        });

        if (window.screen && window.screen.orientation) {
            window.screen.orientation.addEventListener('change', () => {
                console.log('[Game] Orientation changed to:', window.screen.orientation.type);
                this.game.uiManager.displayLoadingSkeleton(true);
                setTimeout(() => {
                    this.setupCanvas();
                    this.game.draw();
                    this.game.uiManager.displayLoadingSkeleton(false);
                }, 100);
            });
        }
    }

    /**
     * Check if game is over
     */
    checkGameOver() {
        const totalSquares = (this.game.gridRows - 1) * (this.game.gridCols - 1);
        const completedSquares = Object.keys(this.game.squares).length;

        if (completedSquares === totalSquares) {
            setTimeout(() => this.game.uiManager.showWinner(), 500);
        }
    }

    /**
     * Check if game is over (boolean)
     */
    isGameOver() {
        const totalSquares = (this.game.gridRows - 1) * (this.game.gridCols - 1);
        const completedSquares = Object.keys(this.game.squares).length;
        return completedSquares === totalSquares;
    }

    /**
     * Switch to next player
     */
    switchToNextPlayer() {
        const currentPlayerEffects = this.game.playerEffects[this.game.currentPlayer];

        if (currentPlayerEffects.bonusTurns > 0) {
            currentPlayerEffects.bonusTurns--;
            this.game.uiManager.triggerBonusTurnVisual();
            return;
        }

        const nextPlayer = this.game.currentPlayer === 1 ? 2 : 1;
        const nextPlayerEffects = this.game.playerEffects[nextPlayer];

        if (nextPlayerEffects.frozenTurns > 0) {
            nextPlayerEffects.frozenTurns--;
            this.game.uiManager.triggerSkipTurnVisual(nextPlayer);
            return;
        }

        this.game.currentPlayer = nextPlayer;
    }

    /**
     * Handle populate
     */
    async handlePopulate() {
        const safeLines = this.game.gameLogic.getSafeLines();

        if (safeLines.length === 0) {
            this.game.uiManager.updatePopulateButtonVisibility();
            return;
        }

        const lineCount = Math.max(1, Math.floor(safeLines.length * 0.1));

        const shuffled = safeLines.sort(() => Math.random() - 0.5);
        const selectedLines = shuffled.slice(0, lineCount);

        if (this.game.isMultiplayer) {
            if (!this.game.isHost) {
                console.warn('[Game] Only host can populate in multiplayer');
                return;
            }

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.populateLines(selectedLines);
                if (result.error) {
                    console.error('[Game] Error populating lines:', result.error);
                    return;
                }
                console.log('[Game] Populated', result.linesPopulated, 'lines');
                this.game.uiManager.updatePopulateButtonVisibility();
                return;
            }
        }

        selectedLines.forEach((lineKey) => {
            const [dot1, dot2] = this.game.gameLogic.parseLineKey(lineKey);

            this.game.lines.add(lineKey);
            this.game.lineOwners.set(lineKey, GAME_CONSTANTS.POPULATE_PLAYER_ID);
            this.game.animationSystem.addPulsatingLine(lineKey, GAME_CONSTANTS.POPULATE_PLAYER_ID, false);
        });

        this.game.draw();
        this.game.uiManager.updatePopulateButtonVisibility();
    }
}