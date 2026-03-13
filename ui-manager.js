/**
 * ShapeKeeper - UI Manager
 * User interface updates and DOM manipulation
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { announceStatus } from './src/ui/AccessibilityAnnouncer.js';
import {
    showWinner as renderWinnerScreen,
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
        const now = Date.now();
        if (now - this.game.lastUIUpdate < this.game.uiUpdateInterval) {
            return;
        }
        this.game.lastUIUpdate = now;

        const { player1Score, player2Score, player1Info, player2Info, turnIndicator } =
            this.domCache;

        // Animate score counting
        const player1ScoreDiff = this.game.scores[1] - this.game.displayedScores[1];
        const player2ScoreDiff = this.game.scores[2] - this.game.displayedScores[2];

        if (Math.abs(player1ScoreDiff) > 0.1) {
            this.game.displayedScores[1] += player1ScoreDiff * this.game.scoreAnimationSpeed;
        } else {
            this.game.displayedScores[1] = this.game.scores[1];
        }

        if (Math.abs(player2ScoreDiff) > 0.1) {
            this.game.displayedScores[2] += player2ScoreDiff * this.game.scoreAnimationSpeed;
        } else {
            this.game.displayedScores[2] = this.game.scores[2];
        }

        const nextPlayer1Score = Math.floor(this.game.displayedScores[1]);
        const nextPlayer2Score = Math.floor(this.game.displayedScores[2]);

        if (this.lastRenderedState.player1Score !== nextPlayer1Score) {
            player1Score.textContent = nextPlayer1Score;
            this.lastRenderedState.player1Score = nextPlayer1Score;
        }

        if (this.lastRenderedState.player2Score !== nextPlayer2Score) {
            player2Score.textContent = nextPlayer2Score;
            this.lastRenderedState.player2Score = nextPlayer2Score;
        }

        if (this.lastRenderedState.activePlayer !== this.game.currentPlayer) {
            player1Info.classList.toggle('active', this.game.currentPlayer === 1);
            player2Info.classList.toggle('active', this.game.currentPlayer === 2);
            this.lastRenderedState.activePlayer = this.game.currentPlayer;
        }

        if (this.lastRenderedState.player1Color !== this.game.player1Color) {
            player1Info.style.color = this.game.player1Color;
            this.lastRenderedState.player1Color = this.game.player1Color;
        }

        if (this.lastRenderedState.player2Color !== this.game.player2Color) {
            player2Info.style.color = this.game.player2Color;
            this.lastRenderedState.player2Color = this.game.player2Color;
        }

        this.updatePlayerEffectsDisplay(1, player1Info);
        this.updatePlayerEffectsDisplay(2, player2Info);

        let turnText;
        if (this.game.isMultiplayer) {
            this.game.isMyTurn = this.game.currentPlayer === this.game.myPlayerNumber;
            turnText = this.game.isMyTurn ? 'Your Turn' : "Opponent's Turn";
        } else {
            turnText = `Player ${this.game.currentPlayer}'s Turn`;
        }

        if (this.lastRenderedState.turnText !== turnText) {
            turnIndicator.textContent = turnText;
            this.lastRenderedState.turnText = turnText;
            announceStatus(turnText);
        }

        const turnColor =
            this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;
        if (this.lastRenderedState.turnColor !== turnColor) {
            turnIndicator.style.color = turnColor;
            this.lastRenderedState.turnColor = turnColor;
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
}
