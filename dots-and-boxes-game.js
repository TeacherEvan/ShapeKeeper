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
import { AchievementSystem } from './achievement-system.js';
import {
    LOCAL_SAVE_STORAGE_KEY,
    createLocalSavePayload,
    validateLocalSavePayload,
} from './local-save-replay.js';
import { showToast } from './src/ui/Toast.js';
import { notifyAchievementUnlock, renderAchievementPanel } from './src/ui/AchievementPanel.js';
import { getDotRenderRadius } from './utils.js';
import { TutorialSystem } from './tutorial-system.js';

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

        this.initialLocalSnapshot = this.captureMoveSnapshot();
        this.replayIndex = 0;

        requestAnimationFrame(() => {
            this.canvas?.focus({ preventScroll: true });
        });

        // Start the game
        this.renderer.draw();
        this.uiManager.updateUI();
        this.showAchievementLoadIssueIfNeeded();
        this.renderAchievementPanel();
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
            populateBtn.addEventListener('click', () => this.gameState.handlePopulate());
        }

        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoMove());
        }

        const redoBtn = document.getElementById('redoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redoMove());
        }

        const saveLocalBtn = document.getElementById('saveLocalBtn');
        if (saveLocalBtn) {
            saveLocalBtn.addEventListener('click', () => this.saveLocalGame());
        }

        const replayBackBtn = document.getElementById('replayBackBtn');
        if (replayBackBtn) {
            replayBackBtn.addEventListener('click', () => this.stepReplayBackward());
        }

        const replayForwardBtn = document.getElementById('replayForwardBtn');
        if (replayForwardBtn) {
            replayForwardBtn.addEventListener('click', () => this.stepReplayForward());
        }

        const replayRestartBtn = document.getElementById('replayRestartBtn');
        if (replayRestartBtn) {
            replayRestartBtn.addEventListener('click', () => this.restartReplay());
        }

        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.soundManager.toggleSound());
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

        this.soundManager.ensureAudioContext();

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

            this.soundManager.playLineSound();

            const completedTriangles = this.disableTriangles
                ? []
                : this.gameLogic.checkForTriangles(lineKey);

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
                });

                this.soundManager.playSquareSound(this.comboCount);

                if (totalShapes >= 2) {
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

            if (!this.isMultiplayer && this.localMode === 'ai' && !this.gameState.isGameOver()) {
                this.scheduleAITurn();
            }
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
        window.setTimeout(() => {
            if (turnToken !== this.aiTurnToken || !this.isAITurn() || this.gameState.isGameOver()) {
                this.aiThinking = false;
                this.uiManager.updateUndoRedoControls();
                return;
            }
            void this.performAIMove(turnToken);
        }, delayMs);
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

        const scoringLines = availableLines.filter((lineKey) => this.gameLogic.wouldCompleteSquare(lineKey));
        const safeLines = availableLines.filter((lineKey) => !this.gameLogic.wouldCompleteSquare(lineKey));

        if (this.aiDifficulty === 'easy') {
            if (scoringLines.length > 0 && Math.random() > 0.35) {
                return this.pickRandomLine(scoringLines);
            }
            if (safeLines.length > 0) {
                return this.pickRandomLine(safeLines);
            }
            return this.pickRandomLine(availableLines);
        }

        if (scoringLines.length > 0) {
            if (this.aiDifficulty === 'hard') {
                return this.pickBestScoringLine(scoringLines);
            }
            return this.pickRandomLine(scoringLines);
        }

        if (safeLines.length > 0) {
            if (this.aiDifficulty === 'hard') {
                return this.pickBestSafeLine(safeLines);
            }
            return this.pickRandomLine(safeLines);
        }

        return this.pickRandomLine(availableLines);
    }

    pickRandomLine(lines) {
        return lines[Math.floor(Math.random() * lines.length)] || null;
    }

    pickBestScoringLine(lines) {
        let bestLine = lines[0];
        let bestScore = -Infinity;

        for (const lineKey of lines) {
            const score = this.evaluateImmediateSquareGain(lineKey);
            if (score > bestScore) {
                bestScore = score;
                bestLine = lineKey;
            }
        }

        return bestLine;
    }

    pickBestSafeLine(lines) {
        let bestLine = lines[0];
        let bestScore = -Infinity;

        for (const lineKey of lines) {
            const score = this.evaluateSafeLineStrength(lineKey);
            if (score > bestScore) {
                bestScore = score;
                bestLine = lineKey;
            }
        }

        return bestLine;
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
            scores: { ...this.scores },
            squares: { ...this.squares },
            triangles: { ...this.triangles },
            triangleCellOwners: [...this.triangleCellOwners.entries()].map(([cellKey, owners]) => [
                cellKey,
                [...owners],
            ]),
        };
    }

    restoreMoveSnapshot(snapshot) {
        this.lines = new Set(snapshot.lines);
        this.ghostLines = new Set(snapshot.ghostLines || []);
        this.lineOwners = new Map(snapshot.lineOwners);
        this.squares = { ...snapshot.squares };
        this.triangles = { ...snapshot.triangles };
        this.scores = { ...snapshot.scores };
        this.currentPlayer = snapshot.currentPlayer;
        this.claimedCells = new Set(snapshot.claimedCells);
        this.triangleCellOwners = new Map(
            snapshot.triangleCellOwners.map(([cellKey, owners]) => [cellKey, new Set(owners)])
        );
        this.playerEffects = JSON.parse(JSON.stringify(snapshot.playerEffects));
        this.protectedSquares = new Set(snapshot.protectedSquares);
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
        this.aiPlayerNumber = this.localMode === 'ai' ? 2 : null;
        this.aiThinking = false;
        this.aiTurnToken += 1;

        this.initialLocalSnapshot = JSON.parse(JSON.stringify(payload.initialSnapshot));
        this.moveHistory = JSON.parse(JSON.stringify(payload.moveHistory));
        this.redoHistory = JSON.parse(JSON.stringify(payload.redoHistory));
        this.replayIndex = payload.replayIndex;

        this.restoreMoveSnapshot(payload.state);
        this.uiManager.updateReplayControls();
        this.renderAchievementPanel();
        return true;
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

    getInteractionDiagnostics() {
        return {
            aiDifficulty: this.aiDifficulty,
            aiThinking: this.aiThinking,
            disableTriangles: this.disableTriangles,
            isTouchDevice: this.isTouchDevice,
            localMode: this.localMode,
            partyModeEnabled: this.partyModeEnabled,
            tutorial: this.tutorialSystem?.getSnapshot?.() || { active: false },
            selectionRadiusMultiplier: this.selectionRadiusMultiplier,
            selectionRadiusPx: this.cellSize * this.selectionRadiusMultiplier,
            staticDotRadiusPx: getDotRenderRadius(this.cellSize, this.isTouchDevice),
            selectedDot: this.selectedDot,
            selectionRibbonActive: Boolean(this.selectionRibbon),
            trianglesCount: Object.keys(this.triangles || {}).length,
        };
    }
}
