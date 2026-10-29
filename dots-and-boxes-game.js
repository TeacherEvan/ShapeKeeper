import { AnimationSystem } from './animation-system.js';
import { FEATURE_FLAGS, GAME_CONSTANTS } from './constants.js';
import { EffectSystem } from './effect-system.js';
import { countHiddenMines, isMineMultiplier } from './effect-system/mines.js';
import { GameLogic } from './game-logic.js';
import { GameState } from './game-state.js';
import { InputHandler } from './input-handler.js';
import { ParticleSystem } from './particle-system.js';
import { Renderer } from './renderer.js';
import { SoundManager } from './sound-manager.js';
import { UIManager } from './ui-manager.js';
import { AchievementSystem } from './achievement-system.js';
import {
    LOCAL_SAVE_STORAGE_KEY,
    createLocalSavePayload,
    validateLocalSavePayload,
} from './local-save-replay.js';
import { showToast } from './src/ui/Toast.js';
import { announceAlert, announceStatus } from './src/ui/AccessibilityAnnouncer.js';
import { notifyAchievementUnlock, renderAchievementPanel } from './src/ui/AchievementPanel.js';
import { getDotRenderRadius, expDecay, prefersReducedMotion } from './utils.js';
import { TutorialSystem } from './tutorial-system.js';
import { findOptimalMinimaxMove } from './src/ai/MinimaxEngine.js';
import { DisposableRegistry } from './src/lifecycle/DisposableRegistry.js';
import { AccessibleGridTree } from './src/a11y/AccessibleGridTree.js';
import { createLocalTurnTimer } from './src/timing/local-turn-timer.js';
import { maybeAnnounceTimeLow } from './src/timing/time-warning.js';
import { getTurnDurationForLevel } from './src/ui/LevelsProgress.js';
import { TurnNoticeBubble } from './src/ui/TurnNoticeBubble.js';

export function pickAutoMoveLine(freeLines, rng = Math.random) {
    if (!Array.isArray(freeLines) || freeLines.length === 0) return null;
    return freeLines[Math.floor(rng() * freeLines.length)] || null;
}

export class DotsAndBoxesGame {
    static POPULATE_PLAYER_ID = GAME_CONSTANTS.POPULATE_PLAYER_ID;

    static ANIMATION_LINE_DRAW_DURATION = GAME_CONSTANTS.ANIMATION_LINE_DRAW_DURATION;

    static LOCAL_SAVE_STORAGE_KEY = LOCAL_SAVE_STORAGE_KEY;

    constructor(gridSize, player1Color, player2Color, options = {}) {
        // Store initial parameters
        this.gridSize = gridSize;
        this.player1Color = player1Color;
        this.player2Color = player2Color;
        this.options = options;
        this.localTurnTimer = null;
        this.localTurnCounter = 0;
        this._aiThinking = false;

        // Allowed Time (local lava timer): seconds per turn, 0 = no limit.
        // Chosen on the local setup screen. Online matches take their clock
        // from the server (turnEndTime via ShapeKeeperTurnClock); local
        // hot-seat games own theirs — armed in animate() by
        // tickLocalTurnClock, expired turns skipped by handleTurnExpiration.
        if (Number.isFinite(options.turnDurationSeconds) && options.turnDurationSeconds >= 0) {
            this.turnDurationSeconds = Math.min(600, Math.floor(options.turnDurationSeconds));
            this.turnDurationMs = this.turnDurationSeconds * 1000;
        } else if (Number.isFinite(options.turnDurationMs) && options.turnDurationMs >= 0) {
            this.turnDurationMs = Math.min(600000, Math.floor(options.turnDurationMs));
            this.turnDurationSeconds = Math.round(this.turnDurationMs / 1000);
        } else {
            this.turnDurationSeconds = 0;
            this.turnDurationMs = 0;
        }

        this.isLevelsMode = Boolean(options.isLevelsMode);
        this.currentLevel = options.currentLevel ? Number(options.currentLevel) : 1;
        if (this.isLevelsMode && (!this.turnDurationSeconds || this.turnDurationSeconds === 0)) {
            const levelDuration = getTurnDurationForLevel();
            this.turnDurationSeconds = levelDuration;
            this.turnDurationMs = levelDuration * 1000;
        }

        this.timedOut = false;
        this.gameOverHandled = false;
        // One payment per level result. A fresh game starts unrecorded; the
        // guard only matters if a future refactor ever reuses an instance.
        this._levelResultRecorded = false;
        this.turnRemainingMs = null;
        this._localTurnClock = null;

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
        this.achievementSystem = new AchievementSystem();
        this.tutorialSystem = new TutorialSystem(this, {
            enabled: options.tutorialEnabled && options.localMode !== 'ai',
            onExit: () => {
                document.getElementById('exitGame')?.click();
            },
        });

        this.linkSystemState(this.animationSystem, [
            'effectAnimations',
            'invalidLineFlash',
            'lineDrawings',
            'multiplierAnimations',
            'penaltyBoxAnimations',
            'pulsatingLines',
            'sparkleEmojis',
            'squareAnimations',
            'touchVisuals',
        ]);
        this.linkSystemState(this.particleSystem, ['ambientParticles', 'particles']);

        this.isDestroyed = false;
        this.disposables = new DisposableRegistry();
        this.turnNoticeBubble = new TurnNoticeBubble();
        this.disposables.addDisposable(this.turnNoticeBubble);

        // Setup canvas and initialize game
        this.gameState.setupCanvas();
        this.inputHandler = new InputHandler(this.canvas, this);
        this.disposables.addDisposable(this.inputHandler);
        this.accessibleGrid = new AccessibleGridTree(this);
        this.disposables.addDisposable(this.accessibleGrid);
        this.effectSystem.initializeMultipliers();
        this.announceMineBoard();
        this.updateMineCounter();
        this.particleSystem.initializeAmbientParticles();

        // Setup event listeners
        this.gameState.setupEventListeners();
        this.setupPopulateButton();

        this.initialLocalSnapshot = this.captureMoveSnapshot();
        this.replayIndex = 0;

        const focusRaf = requestAnimationFrame(() => {
            this.canvas?.focus({ preventScroll: true });
        });
        this.disposables.addRAF(focusRaf);

        this.disposables.addEventListener(document, 'visibilitychange', () => {
            if (document.hidden) {
                this.localTurnTimer?.pause();
                if (this._localTurnClock && this._localTurnClock.deadline > 0) {
                    this._localTurnClock.pausedRemainingMs = Math.max(
                        0,
                        this._localTurnClock.deadline - Date.now()
                    );
                }
            } else {
                this.localTurnTimer?.resume();
                if (
                    this._localTurnClock &&
                    Number.isFinite(this._localTurnClock.pausedRemainingMs)
                ) {
                    this._localTurnClock.deadline =
                        Date.now() + this._localTurnClock.pausedRemainingMs;
                    this._localTurnClock.pausedRemainingMs = null;
                }
            }
        });

        // Start the game
        this.renderer.draw();
        this.uiManager.updateUI();
        this.showAchievementLoadIssueIfNeeded();
        this.renderAchievementPanel();
        this.initLocalTurnTimer();
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

    async revealMultiplier(squareKey) {
        return this.effectSystem.revealMultiplier(squareKey);
    }

    /**
     * Keep the footer mine chip honest: "2 hidden" → "1 hidden" → "board clear".
     * The level-start toast is gone in five seconds; the chip is what keeps the
     * mine concept visible for the rest of the level.
     */
    updateMineCounter() {
        const chip = document.getElementById('mineCounter');
        const countEl = document.getElementById('mineCounterCount');
        if (!chip || !countEl) return;

        const total = Object.values(this.squareMultipliers || {}).filter(isMineMultiplier).length;
        if (total === 0) {
            chip.hidden = true;
            this._lastMineCounter = null;
            return;
        }

        const hidden = countHiddenMines(this.squareMultipliers, this.revealedMultipliers);
        if (this._lastMineCounter === hidden && !chip.hidden) return;

        this._lastMineCounter = hidden;
        chip.hidden = false;
        chip.classList.toggle('is-clear', hidden === 0);
        countEl.textContent = hidden === 0 ? 'board clear' : `${hidden} hidden`;
        chip.setAttribute(
            'aria-label',
            hidden === 0
                ? 'All mines on this board have been triggered'
                : `${hidden} hidden ${hidden === 1 ? 'mine' : 'mines'} left on this board`
        );
    }

    /**
     * Tell the player, once at level start, that this board is mined. Without
     * this the penalty reads as "I did something wrong" instead of "that box
     * was mined before I claimed it".
     */
    announceMineBoard() {
        const mines = Number(this.mineCount) || 0;
        if (mines <= 0) return;

        const label = mines === 1 ? 'mine' : 'mines';
        showToast(
            `💣 ${mines} hidden ${label} on this board — a mined box cuts your score to 20% and stays marked.`,
            'warning',
            5000
        );
        announceStatus(`${mines} hidden ${label} on this board.`);
    }

    /**
     * Make a penalty box impossible to miss: red vignette pulse, a big −80%
     * stamp over the board, a screen shake, and a 3-second speech bubble.
     *
     * @param {{isAiPlayer: boolean}} options
     */
    showPenaltyFeedback({ isAiPlayer = false } = {}) {
        const host = document.getElementById('gameScreen') || document.body;
        this.triggerPenaltyOverlay(host, 'penalty-flash', 800);
        this.triggerPenaltyOverlay(host, 'penalty-stamp', 1600, '💣 −80%');

        if (!prefersReducedMotion()) {
            this.shakeIntensity = Math.max(this.shakeIntensity || 0, 14);
        }

        this.turnNoticeBubble?.show(isAiPlayer ? 'ai-penalty' : 'player-penalty');
        announceAlert(
            isAiPlayer
                ? 'Mine! The AI score was cut to twenty percent.'
                : 'Mine! Your score was cut to twenty percent.'
        );
    }

    triggerPenaltyOverlay(host, className, durationMs, text = '') {
        let el = host.querySelector(`.${className}`);
        if (!el) {
            el = document.createElement('div');
            el.className = className;
            el.setAttribute('aria-hidden', 'true');
            if (text) el.textContent = text;
            host.appendChild(el);
        }
        el.classList.remove('active');
        void el.offsetWidth;
        el.classList.add('active');
        clearTimeout(el._resetTimer);
        el._resetTimer = setTimeout(() => el.classList.remove('active'), durationMs);
    }

    showWinner() {
        this.uiManager.showWinner();
    }

    showAchievementLoadIssueIfNeeded() {
        const issue = this.achievementSystem.getLoadIssue();
        if (!issue) {
            return;
        }

        const toastType = issue.type === 'incompatible' ? 'warning' : 'error';
        showToast(issue.message, toastType);
    }

    renderAchievementPanel() {
        renderAchievementPanel(this.achievementSystem.getUnlockedAchievements());
    }

    handleAchievementUnlocks(unlockedAchievements) {
        if (!Array.isArray(unlockedAchievements) || unlockedAchievements.length === 0) {
            return;
        }

        unlockedAchievements.forEach((achievement) => notifyAchievementUnlock(achievement));
        this.renderAchievementPanel();
    }

    /**
     * Setup populate button
     */
    setupPopulateButton() {
        const populateBtn = document.getElementById('populateBtn');
        if (populateBtn) {
            this.disposables.addEventListener(populateBtn, 'click', () =>
                this.gameState.handlePopulate()
            );
        }

        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            this.disposables.addEventListener(undoBtn, 'click', () => this.undoMove());
        }

        const redoBtn = document.getElementById('redoBtn');
        if (redoBtn) {
            this.disposables.addEventListener(redoBtn, 'click', () => this.redoMove());
        }

        const saveLocalBtn = document.getElementById('saveLocalBtn');
        if (saveLocalBtn) {
            this.disposables.addEventListener(saveLocalBtn, 'click', () => this.saveLocalGame());
        }

        const replayBackBtn = document.getElementById('replayBackBtn');
        if (replayBackBtn) {
            this.disposables.addEventListener(replayBackBtn, 'click', () =>
                this.stepReplayBackward()
            );
        }

        const replayForwardBtn = document.getElementById('replayForwardBtn');
        if (replayForwardBtn) {
            this.disposables.addEventListener(replayForwardBtn, 'click', () =>
                this.stepReplayForward()
            );
        }

        const replayRestartBtn = document.getElementById('replayRestartBtn');
        if (replayRestartBtn) {
            this.disposables.addEventListener(replayRestartBtn, 'click', () =>
                this.restartReplay()
            );
        }

        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            this.disposables.addEventListener(soundToggle, 'click', () =>
                this.soundManager.toggleSound()
            );
        }

        this.uiManager.updatePopulateButtonVisibility();
        this.uiManager.updateUndoRedoControls();
        this.uiManager.updateReplayControls();
    }

    /**
     * Draw line between two dots
     */
    async drawLine(dot1, dot2, { source = 'human' } = {}) {
        if (this.localMode === 'ai' && source !== 'ai') {
            if (this.aiThinking || this.currentPlayer === this.aiPlayerNumber) {
                return;
            }
        }

        const lineKey = this.gameLogic.getLineKey(dot1, dot2);

        this.soundManager?.ensureAudioContext?.();

        if (
            source === 'human' &&
            this.tutorialSystem?.isActive() &&
            !this.tutorialSystem.canDrawLine(dot1, dot2)
        ) {
            return;
        }

        if (this.isMultiplayer) {
            this.isMyTurn = this.currentPlayer === this.myPlayerNumber;
            if (!this.isMyTurn) return;

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.drawLine(lineKey, {
                    clientSentAt: Date.now(),
                });
                if (result.error) {
                    if (result.turnExpired) {
                        // Allowed Time ran out mid-flight: the server auto-drew
                        // a random line on player's behalf and re-armed the turn.
                        showToast(
                            '⏱ Time ran out — a random line was chosen for you',
                            'warning',
                            3000
                        );
                        announceAlert('Time ran out. A random line was chosen for you.');
                        this.turnNoticeBubble?.show('timeout');
                    } else {
                        console.error('[Game] Error drawing line:', result.error);
                    }
                    this.selectedDot = null;
                    this.selectionLocked = false;
                    this.selectionRibbon = null;
                    return;
                }
                this.selectedDot = null;
                this.selectionLocked = false;
                this.selectionRibbon = null;
                return;
            }
        }

        if (!this.lines.has(lineKey)) {
            const preMoveSnapshot = this.captureMoveSnapshot();
            const actingPlayer = this.currentPlayer;
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

            this.soundManager?.playLineSound?.();

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

            const totalShapes = completedSquares.length;

            if (totalShapes === 0) {
                if (playerEffects.doubleLine) {
                    playerEffects.doubleLine = false;
                    this.uiManager.triggerDoubleLineReminder();
                } else {
                    this.comboCount = 0;
                    this.gameState.switchToNextPlayer();
                }
            } else {
                let basePoints = completedSquares.length;

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
                        this.particleSystem.spawnParticles.bind(this.particleSystem),
                        this.particleSystem.spawnSparkleEmojis.bind(this.particleSystem)
                    );

                    const multiplierData = this.squareMultipliers?.[squareKey];
                    if (isMineMultiplier(multiplierData)) {
                        this.revealedMultipliers.add(squareKey);
                        this.scores[this.currentPlayer] =
                            Math.round(this.scores[this.currentPlayer] * 0.2 * 100) / 100;
                        this.animationSystem.triggerMultiplierAnimation(
                            squareKey,
                            0.2,
                            this.gameLogic.parseSquareKey,
                            this.offsetX,
                            this.offsetY,
                            this.cellSize,
                            this.particleSystem.createMultiplierParticles.bind(this.particleSystem)
                        );
                        this.animationSystem.triggerPenaltyBoxAnimation(
                            squareKey,
                            this.gameLogic.parseSquareKey,
                            this.offsetX,
                            this.offsetY,
                            this.cellSize,
                            this.currentPlayer === 1 ? this.player1Color : this.player2Color
                        );
                        this.soundManager.playPenaltySound?.();
                        this.showPenaltyFeedback({
                            isAiPlayer:
                                this.localMode === 'ai' &&
                                this.currentPlayer === (this.aiPlayerNumber || 2),
                        });
                        this.updateMineCounter();
                    }
                });
                this.soundManager.playSquareSound(this.comboCount);

                if (totalShapes >= 2 && !prefersReducedMotion()) {
                    this.shakeIntensity = totalShapes * 2;
                }
            }

            this.uiManager.updateUI();
            this.gameState.checkGameOver();
            this.handleAchievementUnlocks(
                this.achievementSystem.onMoveResolved({
                    isMultiplayer: this.isMultiplayer,
                    isTutorial: this.tutorialSystem?.isActive() === true,
                    scores: this.scores,
                    completedSquaresCount: completedSquares.length,
                    comboCount: this.comboCount,
                })
            );

            if (this.gameState.isGameOver()) {
                this.handleAchievementUnlocks(
                    this.achievementSystem.onGameOver({
                        isMultiplayer: this.isMultiplayer,
                        isTutorial: this.tutorialSystem?.isActive() === true,
                        scores: this.scores,
                    })
                );
            }
            this.uiManager.updatePopulateButtonVisibility();

            this.selectedDot = null;
            this.selectionLocked = false;
            this.selectionRibbon = null;

            if (!this.isMultiplayer) {
                this.moveHistory.push({
                    before: preMoveSnapshot,
                    lineKey,
                    player: actingPlayer,
                    after: this.captureMoveSnapshot(),
                });
                this.redoHistory = [];
                this.replayIndex = this.moveHistory.length;
                this.uiManager.updateUndoRedoControls();
                this.uiManager.updateReplayControls();
            }

            this.tutorialSystem?.onMoveResolved({
                lineKey,
                completedSquaresCount: completedSquares.length,
            });

            this.restartLocalTurnTimer();

            if (!this.isMultiplayer && this.localMode === 'ai' && !this.gameState.isGameOver()) {
                this.scheduleAITurn();
            }
        }
    }

    get aiThinking() {
        return Boolean(this._aiThinking);
    }

    set aiThinking(val) {
        const next = Boolean(val);
        const prev = Boolean(this._aiThinking);
        this._aiThinking = next;
        if (typeof document !== 'undefined') {
            const el = document.getElementById('aiThinking');
            if (el) {
                el.hidden = !next;
            }
        }
        if (next && !prev) {
            announceStatus('AI is thinking');
        }
    }

    isAITurn() {
        return this.localMode === 'ai' && this.currentPlayer === this.aiPlayerNumber;
    }

    scheduleAITurn() {
        if (!this.isAITurn()) {
            this.aiThinking = false;
            this.aiTurnToken += 1;
            this.uiManager.updateUndoRedoControls();
            return;
        }

        if (this.aiThinking) {
            return;
        }

        this.aiThinking = true;
        const turnToken = ++this.aiTurnToken;
        const delayMs = this.aiMoveDelayMs;
        const timerId = window.setTimeout(() => {
            if (
                this.isDestroyed ||
                turnToken !== this.aiTurnToken ||
                !this.isAITurn() ||
                this.gameState.isGameOver()
            ) {
                this.aiThinking = false;
                this.uiManager.updateUndoRedoControls();
                return;
            }
            void this.performAIMove(turnToken);
        }, delayMs);
        this.disposables.addTimeout(timerId);
        this.uiManager.updateUndoRedoControls();
    }

    async performAIMove(turnToken) {
        if (turnToken !== this.aiTurnToken || !this.isAITurn() || this.gameState.isGameOver()) {
            this.aiThinking = false;
            this.uiManager.updateUndoRedoControls();
            return;
        }

        const lineKey = this.chooseAIMove();
        if (!lineKey) {
            this.aiThinking = false;
            return;
        }

        const [startDot, endDot] = this.parseLineKey(lineKey);
        this.aiThinking = false;
        this.uiManager.updateUndoRedoControls();
        await this.drawLine(startDot, endDot, { source: 'ai' });
    }

    chooseAIMove() {
        const availableLines = this.gameLogic
            .getAllPossibleLines()
            .filter((lineKey) => !this.lines.has(lineKey));
        if (availableLines.length === 0) {
            return null;
        }

        const scoringLines = availableLines.filter((lineKey) =>
            this.gameLogic.wouldCompleteSquare(lineKey)
        );
        const safeLines = availableLines.filter(
            (lineKey) => !this.gameLogic.wouldCompleteSquare(lineKey)
        );

        // Easy mode kept for backward compatibility if explicitly requested.
        if (this.aiDifficulty === 'easy') {
            if (scoringLines.length > 0 && Math.random() > 0.35) {
                return this.pickRandomLine(scoringLines);
            }
            if (safeLines.length > 0) {
                return this.pickRandomLine(safeLines);
            }
            return this.pickRandomLine(availableLines);
        }

        // Strong default AI: always take immediate scoring lines.
        if (scoringLines.length > 0) {
            return this.pickBestScoringLine(scoringLines);
        }

        // No immediate capture available: choose a safe line.
        const candidateSafe = safeLines.length > 0 ? safeLines : availableLines;

        // Enhanced adaptive depth: depth 4 on small boards/late game, depth 3 mid-game, depth 2 early on large boards.
        const searchDepth = availableLines.length <= 14 ? 4 : availableLines.length <= 22 ? 3 : 2;
        const bestMinimaxMove = findOptimalMinimaxMove(
            this.gameLogic,
            this.lines,
            this.gridRows,
            this.gridCols,
            searchDepth
        );
        if (bestMinimaxMove) {
            return bestMinimaxMove;
        }

        return this.pickHardSafeLine(candidateSafe);
    }

    pickHardSafeLine(lines) {
        return this.pickRandomAmongBest(lines, (lineKey) => {
            const ownStrength = this.evaluateSafeLineStrength(lineKey);
            const opponentGain = this.opponentBestGainAfter(lineKey);
            return ownStrength - opponentGain * 4;
        });
    }

    // Simulates drawing lineKey, then measures how many squares the opponent
    // could immediately complete on their following move. Restores line state.
    opponentBestGainAfter(lineKey) {
        const alreadyPresent = this.lines.has(lineKey);
        this.lines.add(lineKey);

        let maxGain = 0;
        const opponentLines = this.gameLogic
            .getAllPossibleLines()
            .filter((l) => !this.lines.has(l));
        for (const l of opponentLines) {
            if (this.gameLogic.wouldCompleteSquare(l)) {
                const gain = this.evaluateImmediateSquareGain(l);
                if (gain > maxGain) {
                    maxGain = gain;
                }
            }
        }

        if (!alreadyPresent) {
            this.lines.delete(lineKey);
        }
        return maxGain;
    }

    pickRandomLine(lines) {
        return lines[Math.floor(Math.random() * lines.length)] || null;
    }

    // Randomly choose among the highest-scoring lines. Keeps the heuristic
    // strength (only the best moves are ever picked) while restoring move
    // variety so AI-vs-AI and AI-vs-human games are not byte-identical.
    pickRandomAmongBest(lines, scoreFn) {
        let bestScore = -Infinity;
        for (const lineKey of lines) {
            const score = scoreFn(lineKey);
            if (score > bestScore) {
                bestScore = score;
            }
        }
        const bestLines = lines.filter((l) => scoreFn(l) === bestScore);
        return bestLines[Math.floor(Math.random() * bestLines.length)] || null;
    }

    pickBestScoringLine(lines) {
        return this.pickRandomAmongBest(lines, (l) => this.evaluateImmediateSquareGain(l));
    }

    pickBestSafeLine(lines) {
        return this.pickRandomAmongBest(lines, (l) => this.evaluateSafeLineStrength(l));
    }

    evaluateImmediateSquareGain(lineKey) {
        const [start, end] = this.parseLineKey(lineKey);
        const isHorizontal = start.row === end.row;
        let completedSquares = 0;

        if (isHorizontal) {
            if (
                start.row > 0 &&
                this.isPotentialSquareComplete(start.row - 1, Math.min(start.col, end.col), lineKey)
            ) {
                completedSquares += 1;
            }
            if (
                start.row < this.gridRows - 1 &&
                this.isPotentialSquareComplete(start.row, Math.min(start.col, end.col), lineKey)
            ) {
                completedSquares += 1;
            }
            return completedSquares;
        }

        if (
            start.col > 0 &&
            this.isPotentialSquareComplete(Math.min(start.row, end.row), start.col - 1, lineKey)
        ) {
            completedSquares += 1;
        }
        if (
            start.col < this.gridCols - 1 &&
            this.isPotentialSquareComplete(Math.min(start.row, end.row), start.col, lineKey)
        ) {
            completedSquares += 1;
        }
        return completedSquares;
    }

    evaluateSafeLineStrength(lineKey) {
        const [start, end] = this.parseLineKey(lineKey);
        const isHorizontal = start.row === end.row;
        const neighbors = [];

        if (isHorizontal) {
            if (start.row > 0) {
                neighbors.push({ row: start.row - 1, col: Math.min(start.col, end.col) });
            }
            if (start.row < this.gridRows - 1) {
                neighbors.push({ row: start.row, col: Math.min(start.col, end.col) });
            }
        } else {
            if (start.col > 0) {
                neighbors.push({ row: Math.min(start.row, end.row), col: start.col - 1 });
            }
            if (start.col < this.gridCols - 1) {
                neighbors.push({ row: Math.min(start.row, end.row), col: start.col });
            }
        }

        let score = 0;
        for (const { row, col } of neighbors) {
            const edgeCount = this.countSquareEdges(row, col, lineKey);
            score += edgeCount <= 2 ? 2 : -3;
        }
        return score;
    }

    countSquareEdges(row, col, prospectiveLineKey) {
        const top = this.getLineKey({ row, col }, { row, col: col + 1 });
        const bottom = this.getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
        const left = this.getLineKey({ row, col }, { row: row + 1, col });
        const right = this.getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });
        const squareLines = [top, bottom, left, right];
        return squareLines.reduce(
            (count, key) => count + (key === prospectiveLineKey || this.lines.has(key) ? 1 : 0),
            0
        );
    }

    isPotentialSquareComplete(row, col, prospectiveLineKey) {
        if (this.claimedCells.has(`${row},${col}`) || this.squares[`${row},${col}`]) {
            return false;
        }

        const top = this.getLineKey({ row, col }, { row, col: col + 1 });
        const bottom = this.getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
        const left = this.getLineKey({ row, col }, { row: row + 1, col });
        const right = this.getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });
        return [top, bottom, left, right].every(
            (key) => key === prospectiveLineKey || this.lines.has(key)
        );
    }

    captureMoveSnapshot() {
        return {
            comboCount: this.comboCount,
            claimedCells: [...this.claimedCells],
            currentPlayer: this.currentPlayer,
            ghostLines: [...this.ghostLines],
            lastComboPlayer: this.lastComboPlayer,
            lineOwners: [...this.lineOwners.entries()],
            lines: [...this.lines],
            playerEffects: JSON.parse(JSON.stringify(this.playerEffects)),
            protectedSquares: [...this.protectedSquares],
            revealedMultipliers: Array.from(this.revealedMultipliers || []),
            scores: { ...this.scores },
            squares: { ...this.squares },
        };
    }

    restoreMoveSnapshot(snapshot) {
        this.lines = new Set(snapshot.lines);
        this.ghostLines = new Set(snapshot.ghostLines || []);
        this.lineOwners = new Map(snapshot.lineOwners);
        this.squares = { ...snapshot.squares };
        this.scores = { ...snapshot.scores };
        this.currentPlayer = snapshot.currentPlayer;
        this.claimedCells = new Set(snapshot.claimedCells);
        this.playerEffects = JSON.parse(JSON.stringify(snapshot.playerEffects));
        this.protectedSquares = new Set(snapshot.protectedSquares);
        this.revealedMultipliers = new Set(snapshot.revealedMultipliers || []);
        this.comboCount = snapshot.comboCount;
        this.lastComboPlayer = snapshot.lastComboPlayer;

        this.selectedDot = null;
        this.selectionLocked = false;
        this.selectionRibbon = null;

        this.animationSystem.pulsatingLines = [];
        this.animationSystem.lineDrawings = [];
        this.animationSystem.squareAnimations = [];
        this.renderer.draw();
        this.uiManager.updateUI();
        this.uiManager.updatePopulateButtonVisibility();
        this.uiManager.updateUndoRedoControls();
        this.uiManager.updateReplayControls();

        if (this.localMode === 'ai' && this.isAITurn() && !this.gameState.isGameOver()) {
            this.scheduleAITurn();
        } else {
            this.aiThinking = false;
            this.aiTurnToken += 1;
        }
    }

    undoMove() {
        if (
            this.isMultiplayer ||
            this.aiThinking ||
            this.moveHistory.length === 0 ||
            this.tutorialSystem?.isActive()
        ) {
            return;
        }

        const lastMove = this.moveHistory.pop();
        this.redoHistory.push(lastMove);
        this.replayIndex = this.moveHistory.length;
        this.restoreMoveSnapshot(lastMove.before);
        this.restartLocalTurnTimer();
    }

    redoMove() {
        if (
            this.isMultiplayer ||
            this.aiThinking ||
            this.redoHistory.length === 0 ||
            this.tutorialSystem?.isActive()
        ) {
            return;
        }

        const nextMove = this.redoHistory.pop();
        this.moveHistory.push(nextMove);
        this.replayIndex = this.moveHistory.length;
        this.restoreMoveSnapshot(nextMove.after);
        this.restartLocalTurnTimer();
    }

    getSnapshotForReplayIndex(index) {
        if (index <= 0) {
            return this.initialLocalSnapshot;
        }
        return this.moveHistory[index - 1]?.after || this.captureMoveSnapshot();
    }

    applyReplayIndex(index) {
        const clampedIndex = Math.max(0, Math.min(index, this.moveHistory.length));
        this.replayIndex = clampedIndex;
        this.restoreMoveSnapshot(this.getSnapshotForReplayIndex(clampedIndex));
    }

    stepReplayBackward() {
        if (
            this.isMultiplayer ||
            this.aiThinking ||
            this.moveHistory.length === 0 ||
            this.tutorialSystem?.isActive()
        ) {
            return;
        }
        this.applyReplayIndex(this.replayIndex - 1);
    }

    stepReplayForward() {
        if (
            this.isMultiplayer ||
            this.aiThinking ||
            this.moveHistory.length === 0 ||
            this.tutorialSystem?.isActive()
        ) {
            return;
        }
        this.applyReplayIndex(this.replayIndex + 1);
    }

    restartReplay() {
        if (
            this.isMultiplayer ||
            this.aiThinking ||
            this.moveHistory.length === 0 ||
            this.tutorialSystem?.isActive()
        ) {
            return;
        }
        this.applyReplayIndex(0);
    }

    saveLocalGame() {
        if (this.isMultiplayer) {
            showToast('Save is only available in local mode.', 'warning');
            return false;
        }
        if (this.tutorialSystem?.isActive()) {
            showToast('Finish, skip, or exit tutorial before saving.', 'warning');
            return false;
        }

        try {
            const payload = createLocalSavePayload(this);
            window.localStorage.setItem(
                DotsAndBoxesGame.LOCAL_SAVE_STORAGE_KEY,
                JSON.stringify(payload)
            );
            showToast('Local game saved.', 'success', 2000);
            return true;
        } catch (error) {
            console.error('[Local Save] Failed to save local game:', error);
            showToast('Failed to save local game. Please try again.', 'error');
            return false;
        }
    }

    static readLocalSaveFromStorage() {
        let rawPayload;
        try {
            rawPayload = window.localStorage.getItem(DotsAndBoxesGame.LOCAL_SAVE_STORAGE_KEY);
        } catch (error) {
            console.error('[Local Save] Failed to read local save payload:', error);
            return { ok: false, type: 'storage_error', message: 'Unable to read local save data.' };
        }

        if (!rawPayload) {
            return { ok: false, type: 'missing', message: 'No saved local game found.' };
        }

        let parsedPayload;
        try {
            parsedPayload = JSON.parse(rawPayload);
        } catch (error) {
            console.error('[Local Save] Saved payload is not valid JSON:', error);
            return {
                ok: false,
                type: 'invalid',
                message: 'Saved game data is corrupted and cannot be parsed.',
            };
        }

        return validateLocalSavePayload(parsedPayload);
    }

    applyValidatedLocalPayload(validatedPayload) {
        const payload = validatedPayload?.payload;
        if (!payload || !validatedPayload.ok) {
            return false;
        }

        this.gridSize = payload.config.gridSize;
        this.player1Color = payload.config.player1Color;
        this.player2Color = payload.config.player2Color;
        this.localMode = payload.config.localMode;
        this.aiDifficulty = payload.config.aiDifficulty;
        this.turnDurationSeconds =
            Number.isFinite(payload.config.turnDurationSeconds) &&
            payload.config.turnDurationSeconds >= 0
                ? Math.min(600, Math.floor(payload.config.turnDurationSeconds))
                : 0;
        // Force the local turn clock to re-arm for the restored board state.
        this.turnRemainingMs = null;
        this._localTurnClock = null;
        this.aiPlayerNumber = this.localMode === 'ai' ? 2 : null;
        this.aiThinking = false;
        this.aiTurnToken += 1;

        this.initialLocalSnapshot = JSON.parse(JSON.stringify(payload.initialSnapshot));
        this.moveHistory = JSON.parse(JSON.stringify(payload.moveHistory));
        this.redoHistory = JSON.parse(JSON.stringify(payload.redoHistory));
        this.replayIndex = payload.replayIndex;
        this.turnDurationMs = payload.config.turnDurationMs ?? 0;
        this.restoreMoveSnapshot(payload.state);
        this.initLocalTurnTimer();
        this.uiManager.updateReplayControls();
        this.renderAchievementPanel();
        return true;
    }

    /**
     * Main animation loop
     */
    animate() {
        const now = Date.now();

        // Frame-rate independent decay. These constants reproduce the old
        // per-frame multipliers at 60 fps (shake 0.9, pulse 0.92) but behave
        // identically on 120 Hz displays.
        const lastAnimateAt = Number(this._lastAnimateAt) || now;
        const dtSeconds = Math.min(Math.max((now - lastAnimateAt) / 1000, 0), 0.1);
        this._lastAnimateAt = now;

        // Update particles
        this.particleSystem.updateParticles(this.logicalWidth, this.logicalHeight);

        // Update animations
        this.animationSystem.updateAnimations(now);

        // Decay effects
        if (this.shakeIntensity > 0.1) {
            this.shakeIntensity = expDecay(this.shakeIntensity, 0, 6.32, dtSeconds);
        } else {
            this.shakeIntensity = 0;
        }

        if (this.screenPulse > 0.01) {
            this.screenPulse = expDecay(this.screenPulse, 0, 5.0, dtSeconds);
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
            this.animationSystem.penaltyBoxAnimations?.length > 0 ||
            this.animationSystem.lineDrawings.length > 0 ||
            this.invalidLineFlash ||
            this.shakeIntensity > 0 ||
            this.screenPulse > 0 ||
            this.hoveredDot ||
            this.selectionRibbon ||
            this.selectedDot;

        const ambientRedraw = this.particleSystem.ambientParticles.length > 0 && now % 48 < 16;

        if (hasActiveAnimations || ambientRedraw || this.turnRemainingMs != null) {
            this.renderer.draw();
        }

        // FR-2 / FR-3: keep the turn countdown ticking every frame (online and local).
        if (this.isOnline) {
            this.handleTurnExpiration();
        } else if (this.shouldRunLocalTurnClock()) {
            this.tickLocalTurnClock(now);
            this.handleTurnExpiration();
        } else if (this.localTurnTimer?.enabled) {
            this.tickLocalTurnTimer();
        }

        if (!this.isDestroyed) {
            if (this._activeRafId !== null && this._activeRafId !== undefined) {
                this.disposables.removeRAF(this._activeRafId);
            }
            this._activeRafId = requestAnimationFrame(() => this.animate());
            this.disposables.addRAF(this._activeRafId);
        }
    }

    /**
     * Draw method (delegated to renderer)
     */
    draw() {
        this.renderer.draw();
    }

    initLocalTurnTimer() {
        const flagOn = FEATURE_FLAGS.FEATURE_LAVA_TIMER === true;
        const tutorial = this.tutorialSystem?.isActive?.() === true;
        const ms = this.isMultiplayer || !flagOn || tutorial ? 0 : this.turnDurationMs;
        this.localTurnTimer = createLocalTurnTimer({ durationMs: ms });
        this.restartLocalTurnTimer();
    }

    restartLocalTurnTimer() {
        if (this._localTurnClock) {
            this._localTurnClock.deadline = 0;
            this._localTurnClock.pausedRemainingMs = null;
        }
        const timer = this.localTurnTimer;
        if (!timer?.enabled) return;
        this.localTurnCounter += 1;
        if (this.gameState.isGameOver() || this.isAITurn()) {
            timer.stop();
            this.turnRemainingMs = null;
            return;
        }
        timer.start();
    }

    tickLocalTurnTimer() {
        const timer = this.localTurnTimer;
        if (!timer?.enabled) return;
        this.turnRemainingMs = timer.remainingMs();
        if (timer.consumeExpiry()) {
            this.expireLocalTurn();
        } else if (this.turnRemainingMs != null) {
            maybeAnnounceTimeLow(
                this,
                this.localTurnCounter,
                this.turnRemainingMs,
                timer.durationMs
            );
        }
    }

    expireLocalTurn() {
        void this.performTimeoutAutoMove();
    }

    async performTimeoutAutoMove() {
        if (this._autoMoveInProgress || this.gameState.isGameOver()) return;
        if (this.isOnline || (this.localMode === 'ai' && this.currentPlayer !== 1)) return;

        const turnKey = `${this.localTurnCounter}:${this.currentPlayer}:${this.lines.size}`;
        if (this._autoMoveTurnKey === turnKey) return;
        this._autoMoveTurnKey = turnKey;
        this._autoMoveInProgress = true;

        this.selectedDot = null;
        this.selectionLocked = false;
        this.selectionRibbon = null;

        const free = this.gameLogic.getAllPossibleLines().filter((k) => !this.lines.has(k));
        const lineKey = pickAutoMoveLine(free);

        if (!lineKey) {
            this._autoMoveInProgress = false;
            return;
        }

        // Reset turn deadline for local clock so it doesn't repeatedly trigger while processing move
        if (this._localTurnClock) {
            this._localTurnClock.deadline = 0;
            this._localTurnClock.pausedRemainingMs = null;
        }
        this.turnRemainingMs = null;

        const [a, b] = this.parseLineKey(lineKey);
        this.turnNoticeBubble?.show('timeout');

        try {
            await this.drawLine(a, b, { source: 'timeout' });
        } finally {
            this._autoMoveInProgress = false;
        }
    }

    /**
     * Local hot-seat turn clock: arm a fresh countdown whenever the active
     * player changes (or after an expiry re-arm) and keep `turnRemainingMs`
     * in sync for the lava renderer.
     * @param {number} now epoch ms (animate() uses Date.now())
     */
    tickLocalTurnClock(now) {
        if (!this._localTurnClock) {
            this._localTurnClock = {
                player: null,
                deadline: 0,
                pausedRemainingMs: null,
                lastTickedSecond: null,
            };
        }
        if (this.isLevelsMode && this.currentPlayer !== 1) {
            this.turnRemainingMs = null;
            return;
        }
        const clock = this._localTurnClock;
        if (clock.player !== this.currentPlayer || clock.deadline === 0) {
            clock.player = this.currentPlayer;
            clock.deadline = now + this.turnDurationSeconds * 1000;
            clock.pausedRemainingMs = null;
            clock.lastTickedSecond = null;
        }
        const remaining = clock.deadline - now;
        this.turnRemainingMs = remaining > 0 ? remaining : 0;

        // Audio-visual urgency: sound ticking & screen vignette during last 3 seconds
        const isUrgent =
            this.isLevelsMode && this.turnRemainingMs > 0 && this.turnRemainingMs <= 3000;
        const gameScreenEl = document.getElementById('gameScreen');
        if (gameScreenEl) {
            gameScreenEl.classList.toggle('turn-urgent', Boolean(isUrgent));
        }

        if (isUrgent) {
            const sec = Math.ceil(this.turnRemainingMs / 1000);
            if (clock.lastTickedSecond !== sec) {
                clock.lastTickedSecond = sec;
                const urgency = 4 - sec; // 1 at 3s, 2 at 2s, 3 at 1s
                this.soundManager?.playTickSound?.(urgency);
            }
        }
    }

    get turnDurationSeconds() {
        return this._turnDurationSeconds ?? 0;
    }

    set turnDurationSeconds(seconds) {
        const val =
            Number.isFinite(seconds) && seconds >= 0 ? Math.min(600, Math.floor(seconds)) : 0;
        this._turnDurationSeconds = val;
        this.turnDurationMs = val * 1000;
        if (val === 0) {
            this.localTurnTimer?.stop?.();
            this.turnRemainingMs = null;
            if (this._localTurnClock) {
                this._localTurnClock.deadline = 0;
                this._localTurnClock.pausedRemainingMs = null;
            }
        }
    }

    /**
     * Whether the local turn lava timer should run this frame.
     * Online matches use the server clock; AI mode has no human turn to
     * time (unless in Levels mode for player 1); the tutorial and finished games never skip turns.
     */
    shouldRunLocalTurnClock() {
        return (
            !this.isOnline &&
            (this.localMode === 'human' || (this.isLevelsMode && this.currentPlayer === 1)) &&
            this.turnDurationSeconds > 0 &&
            !this.gameState.isGameOver() &&
            !this.tutorialSystem?.isActive()
        );
    }

    handleTurnExpiration() {
        if (!FEATURE_FLAGS.FEATURE_LAVA_TIMER && !this.isLevelsMode) return;

        if (this.isOnline) {
            const ctrl = window.ShapeKeeperTurnClock;
            if (!ctrl) return;
            const remaining = ctrl.tick ? ctrl.tick() : ctrl.getRemainingTime?.();
            if (remaining != null) {
                maybeAnnounceTimeLow(this, ctrl.getTurnKey?.(), remaining, ctrl.getDurationMs?.());
            }
            if (remaining === undefined || remaining === null || remaining > 0) return;

            const turnKey =
                ctrl.getTurnKey?.() ??
                `${this.gameState?.room?.turnStartTime}_${this.gameState?.room?.turnEndTime}`;
            if (this._lastExpiredTurnKey === turnKey) return;
            this._lastExpiredTurnKey = turnKey;
            this.renderer.draw();
            return;
        }

        // Local turn clock: the countdown is owned by tickLocalTurnClock().
        const remaining = this.turnRemainingMs;
        if (remaining === null || remaining === undefined || remaining > 0) return;

        return this.performTimeoutAutoMove();
    }

    handleLevelTimeout() {
        if (this.timedOut || this.gameOverHandled) return;
        this.timedOut = true;
        this.gameOverHandled = true;
        this.turnRemainingMs = 0;

        if (this._localTurnClock) {
            this._localTurnClock.deadline = 0;
            this._localTurnClock.pausedRemainingMs = null;
        }
        this.localTurnTimer?.stop?.();

        // Clear active pointer selection and cancel pending AI turns
        this.selectedDot = null;
        this.selectionLocked = false;
        this.selectionRibbon = null;
        this.comboCount = 0;
        this.aiThinking = false;
        this.aiTurnToken += 1;

        this.renderer.draw();
        document.getElementById('gameScreen')?.classList.remove('turn-urgent');
        this.uiManager.showGameOverSplash();
    }

    getInteractionDiagnostics() {
        return {
            aiDifficulty: this.aiDifficulty,
            aiThinking: this.aiThinking,
            isTouchDevice: this.isTouchDevice,
            localMode: this.localMode,
            tutorial: this.tutorialSystem?.getSnapshot?.() || { active: false },
            selectionRadiusMultiplier: this.selectionRadiusMultiplier,
            selectionRadiusPx: this.cellSize * this.selectionRadiusMultiplier,
            staticDotRadiusPx: getDotRenderRadius(this.cellSize, this.isTouchDevice),
            selectedDot: this.selectedDot,
            selectionRibbonActive: Boolean(this.selectionRibbon),
        };
    }

    /**
     * Destroy and cleanup all active resources, timers, and listeners.
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        document.getElementById('gameScreen')?.classList.remove('turn-urgent');

        if (this.disposables) {
            this.disposables.dispose();
        }

        if (this.soundManager && typeof this.soundManager.destroy === 'function') {
            this.soundManager.destroy();
        }
    }
}
