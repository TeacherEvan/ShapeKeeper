/**
 * ShapeKeeper - UI Manager
 * User interface updates and DOM manipulation
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { announceStatus } from './src/ui/AccessibilityAnnouncer.js';
import { expDecay, getPlayerColor, getPlayerName } from './utils.js';
import {
    hideGameOverSplash,
    showGameOverSplash,
    showWinner as renderWinnerScreen,
    stopCelebrationAnimations,
    triggerBonusTurnVisual as showBonusTurnVisual,
    triggerDoubleLineReminder as showDoubleLineReminder,
    triggerDoublePointsVisual as showDoublePointsVisual,
    triggerSkipTurnVisual as showSkipTurnVisual,
} from './ui-manager/celebrations.js';
import { renderPlayerEffects } from './ui-manager/effects.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.domCache = {
            player1Score: document.getElementById('player1Score'),
            player2Score: document.getElementById('player2Score'),
            player1Info: document.getElementById('player1Info'),
            player2Info: document.getElementById('player2Info'),
            turnIndicator: document.getElementById('turnIndicator'),
            populateBtn: document.getElementById('populateBtn'),
            loadingSkeleton: document.getElementById('gameLoadingSkeleton'),
        };
        this.lastRenderedState = {
            player1Score: null,
            player2Score: null,
            activePlayer: null,
            player1Color: null,
            player2Color: null,
            turnText: null,
            turnColor: null,
        };
    }

    /**
     * Display or hide the loading skeleton
     */
    displayLoadingSkeleton(isLoading) {
        const skeleton = this.domCache.loadingSkeleton;
        if (skeleton) {
            skeleton.classList.toggle('hidden', !isLoading);
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        // The mine chip tracks revealed mines; undo/redo restores the revealed
        // set without going through the penalty branch, so refresh it here too.
        this.game.updateMineCounter?.();

        const now = Date.now();
        if (now - this.game.lastUIUpdate < this.game.uiUpdateInterval) {
            return;
        }
        const dt = this.game.lastUIUpdate > 0 ? (now - this.game.lastUIUpdate) / 1000 : 0.016;
        this.game.lastUIUpdate = now;

        const { player1Score, player2Score, player1Info, player2Info, turnIndicator } =
            this.domCache;

        const playerCount = Math.max(2, this.game.playerCount || 2);
        for (let pNum = 1; pNum <= playerCount; pNum += 1) {
            const target = this.game.scores[pNum] ?? 0;
            const current = this.game.displayedScores[pNum] ?? target;
            const diff = target - current;
            if (this.game.scoreAnimationSpeed >= 1 || Math.abs(diff) <= 0.1) {
                this.game.displayedScores[pNum] = target;
            } else {
                this.game.displayedScores[pNum] = expDecay(current, target, 10, dt);
            }
        }

        const formatScore = (pNum) => {
            const target = this.game.scores[pNum] ?? 0;
            const displayed = this.game.displayedScores[pNum] ?? target;
            return target % 1 === 0
                ? Math.floor(displayed)
                : Number(displayed.toFixed(2)).toString();
        };

        const nextPlayer1Score = formatScore(1);
        const nextPlayer2Score = formatScore(2);

        if (this.lastRenderedState.player1Score !== nextPlayer1Score) {
            player1Score.textContent = nextPlayer1Score;
            this.lastRenderedState.player1Score = nextPlayer1Score;
        }

        if (this.lastRenderedState.player2Score !== nextPlayer2Score) {
            player2Score.textContent = nextPlayer2Score;
            this.lastRenderedState.player2Score = nextPlayer2Score;
        }

        const header = player2Info?.parentElement;
        if (header) {
            // Sync dynamic scorecards for players 3..N in online 3-6 player matches
            for (let pNum = 3; pNum <= 6; pNum += 1) {
                let card = document.getElementById(`player${pNum}Info`);
                if (pNum <= playerCount) {
                    if (!card) {
                        card = document.createElement('div');
                        card.id = `player${pNum}Info`;
                        card.className = 'player-info dynamic-player-info';
                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'player-name';
                        nameSpan.id = `player${pNum}Name`;
                        const scoreSpan = document.createElement('span');
                        scoreSpan.className = 'player-score score';
                        scoreSpan.id = `player${pNum}Score`;
                        card.append(nameSpan, scoreSpan);
                        header.appendChild(card);
                    }
                    const nameEl = card.querySelector('.player-name');
                    const scoreEl = card.querySelector('.player-score');
                    if (nameEl) nameEl.textContent = getPlayerName(this.game, pNum);
                    if (scoreEl) scoreEl.textContent = String(formatScore(pNum));
                    card.classList.toggle('active', this.game.currentPlayer === pNum);
                    card.style.setProperty('--player-swatch', getPlayerColor(this.game, pNum));
                } else if (card) {
                    card.remove();
                }
            }
        }

        if (this.lastRenderedState.activePlayer !== this.game.currentPlayer) {
            player1Info.classList.toggle('active', this.game.currentPlayer === 1);
            player2Info.classList.toggle('active', this.game.currentPlayer === 2);
            this.lastRenderedState.activePlayer = this.game.currentPlayer;
        }

        const p1Color = getPlayerColor(this.game, 1);
        const p2Color = getPlayerColor(this.game, 2);
        if (this.lastRenderedState.player1Color !== p1Color) {
            player1Info.style.setProperty('--player-swatch', p1Color);
            this.lastRenderedState.player1Color = p1Color;
        }

        if (this.lastRenderedState.player2Color !== p2Color) {
            player2Info.style.setProperty('--player-swatch', p2Color);
            this.lastRenderedState.player2Color = p2Color;
        }

        this.updatePlayerEffectsDisplay(1, player1Info);
        this.updatePlayerEffectsDisplay(2, player2Info);

        let turnText;
        if (this.game.isMultiplayer) {
            this.game.isMyTurn = this.game.currentPlayer === this.game.myPlayerNumber;
            turnText = this.game.isMyTurn
                ? 'Your Turn'
                : playerCount > 2
                  ? `${getPlayerName(this.game, this.game.currentPlayer)}'s Turn`
                  : "Opponent's Turn";
        } else {
            turnText = `Player ${this.game.currentPlayer}'s Turn`;
        }

        const bannerLocked = Number(this.turnBannerLockUntil) > Date.now();
        if (!bannerLocked) {
            if (this.lastRenderedState.turnText !== turnText) {
                turnIndicator.textContent = turnText;
                this.lastRenderedState.turnText = turnText;
                announceStatus(turnText);
            }

            const turnColor = getPlayerColor(this.game, this.game.currentPlayer);
            if (this.lastRenderedState.turnColor !== turnColor) {
                turnIndicator.style.setProperty('--turn-color', turnColor);
                this.lastRenderedState.turnColor = turnColor;
            }
        }
    }

    /**
     * Update the visual display of active effects for a player
     */
    updatePlayerEffectsDisplay(playerNum, playerInfoElement) {
        renderPlayerEffects(this.game, playerNum, playerInfoElement);
    }

    /**
     * Update populate button visibility
     */
    updatePopulateButtonVisibility() {
        const populateBtn = this.domCache.populateBtn;
        if (!populateBtn) return;

        if (this.game.isMultiplayer && !this.game.isHost) {
            populateBtn.classList.add('hidden');
            return;
        }

        const safeLines = this.game.gameLogic.getSafeLines();

        if (safeLines.length === 0) {
            populateBtn.classList.add('hidden');
        } else {
            populateBtn.classList.remove('hidden');
        }
    }

    updateUndoRedoControls() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (!undoBtn || !redoBtn) {
            return;
        }

        if (this.game.isMultiplayer) {
            undoBtn.disabled = true;
            redoBtn.disabled = true;
            return;
        }

        const lockForAI = this.game.localMode === 'ai' && this.game.aiThinking;
        const lockForTutorial = this.game.tutorialSystem?.isActive?.() === true;
        undoBtn.disabled = lockForAI || lockForTutorial || this.game.moveHistory.length === 0;
        redoBtn.disabled = lockForAI || lockForTutorial || this.game.redoHistory.length === 0;
    }

    updateReplayControls() {
        const saveLocalBtn = document.getElementById('saveLocalBtn');
        const replayBackBtn = document.getElementById('replayBackBtn');
        const replayForwardBtn = document.getElementById('replayForwardBtn');
        const replayRestartBtn = document.getElementById('replayRestartBtn');

        if (!saveLocalBtn || !replayBackBtn || !replayForwardBtn || !replayRestartBtn) {
            return;
        }

        if (this.game.isMultiplayer) {
            saveLocalBtn.disabled = true;
            replayBackBtn.disabled = true;
            replayForwardBtn.disabled = true;
            replayRestartBtn.disabled = true;
            return;
        }

        const lockForAI = this.game.localMode === 'ai' && this.game.aiThinking;
        const lockForTutorial = this.game.tutorialSystem?.isActive?.() === true;
        const hasHistory = this.game.moveHistory.length > 0;
        saveLocalBtn.disabled = lockForAI || lockForTutorial;
        replayBackBtn.disabled =
            lockForAI || lockForTutorial || !hasHistory || this.game.replayIndex <= 0;
        replayForwardBtn.disabled =
            lockForAI ||
            lockForTutorial ||
            !hasHistory ||
            this.game.replayIndex >= this.game.moveHistory.length;
        replayRestartBtn.disabled =
            lockForAI || lockForTutorial || !hasHistory || this.game.replayIndex === 0;
    }

    /**
     * Trigger bonus turn visual
     */
    triggerBonusTurnVisual() {
        showBonusTurnVisual(this.game, () => this.updateUI());
    }

    /**
     * Trigger skip turn visual
     */
    triggerSkipTurnVisual(skippedPlayer) {
        showSkipTurnVisual(this.game, skippedPlayer, () => this.updateUI());
    }

    /**
     * Trigger double points visual
     */
    triggerDoublePointsVisual() {
        showDoublePointsVisual(this.game, () => this.updateUI());
    }

    /**
     * Trigger double line reminder
     */
    triggerDoubleLineReminder() {
        showDoubleLineReminder(this.game, () => this.updateUI());
    }

    /**
     * Show winner screen
     */
    showWinner() {
        renderWinnerScreen(this.game);
    }

    /**
     * Show game over splash pop-up (Levels timeout)
     */
    showGameOverSplash() {
        showGameOverSplash(this.game);
    }

    /**
     * Hide game over splash pop-up
     */
    hideGameOverSplash() {
        hideGameOverSplash();
    }

    /**
     * Stop active celebration animations and remove canvases
     */
    stopCelebrations() {
        stopCelebrationAnimations();
    }
}
