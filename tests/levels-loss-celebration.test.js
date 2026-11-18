import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelsProgress } from '../src/ui/LevelsProgress.js';
import { showWinner } from '../ui-manager/celebrations.js';

describe('Levels mode loss celebration and sprite stake', () => {
    beforeEach(() => {
        localStorage.clear();
        HTMLCanvasElement.prototype.getContext = () => ({
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
        });
        document.body.innerHTML = `
            <h1 id="winnerScreenTitle">Game Over!</h1>
            <div id="winnerText"></div>
            <div id="finalScores"></div>
            <button id="playAgain"></button>
            <button id="winnerLevelsBtn"></button>
        `;
        window.welcomeAnimation = {
            syncWithLevelsProgress: vi.fn(),
        };
    });

    it('deducts 1 sprite on defeat and does not deduct twice if showWinner is called again', () => {
        LevelsProgress.triggerLevelsMode();
        LevelsProgress.recordLevelWin(1);
        LevelsProgress.recordLevelWin(2);
        expect(LevelsProgress.getState().spritesObtained).toBe(3);

        const mockGame = {
            isLevelsMode: true,
            currentLevel: 3,
            scores: { 1: 2, 2: 5 }, // Player 1 lost to AI
            player1Color: '#ff0000',
            player2Color: '#0000ff',
            soundManager: {
                playInvalidSound: vi.fn(),
                playVictorySound: vi.fn(),
            },
        };

        showWinner(mockGame);

        expect(mockGame._levelResultRecorded).toBe(true);
        expect(LevelsProgress.getState().spritesObtained).toBe(2);
        const winnerText = document.getElementById('winnerText');
        expect(winnerText.innerHTML).toContain('💔 −1 Sprite');
        expect(winnerText.innerHTML).toContain('Total: 2');
        expect(mockGame.soundManager.playInvalidSound).toHaveBeenCalled();

        // Re-call showWinner on the same game instance
        showWinner(mockGame);
        expect(LevelsProgress.getState().spritesObtained).toBe(2); // Still 2, not 1!
    });

    it('treats a draw as a win: +1 sprite, level recorded, next level offered', () => {
        LevelsProgress.triggerLevelsMode();
        // Start with 1 sprite
        expect(LevelsProgress.getState().spritesObtained).toBe(1);

        const mockGame = {
            isLevelsMode: true,
            currentLevel: 2,
            scores: { 1: 2, 2: 2 }, // Draw in Levels mode = win
            player1Color: '#ff0000',
            player2Color: '#0000ff',
            soundManager: {
                playInvalidSound: vi.fn(),
                playVictorySound: vi.fn(),
            },
        };

        showWinner(mockGame);

        const state = LevelsProgress.getState();
        expect(state.spritesObtained).toBe(2);
        expect(state.completedLevels).toContain(2);
        expect(mockGame._nextLevelToPlay).toBe(3);
        expect(mockGame._levelResultRecorded).toBe(true);

        const winnerText = document.getElementById('winnerText');
        expect(winnerText.innerHTML).toContain('Draw');
        expect(winnerText.innerHTML).toContain('+1 Sprite');
        expect(document.getElementById('winnerScreenTitle').textContent).toBe('Draw!');
        const ranks = [...document.querySelectorAll('#finalScores .final-score-rank')].map(
            (el) => el.textContent
        );
        expect(ranks).toEqual(['🥇', '🥇']);
        expect(mockGame.soundManager.playVictorySound).toHaveBeenCalled();
        expect(mockGame.soundManager.playInvalidSound).not.toHaveBeenCalled();
    });

    it('still takes a sprite when the AI out-scores the player', () => {
        LevelsProgress.triggerLevelsMode();
        LevelsProgress.recordLevelWin(1);
        expect(LevelsProgress.getState().spritesObtained).toBe(2);

        const mockGame = {
            isLevelsMode: true,
            currentLevel: 2,
            scores: { 1: 1, 2: 3 }, // AI wins
            player1Color: '#ff0000',
            player2Color: '#0000ff',
            soundManager: {
                playInvalidSound: vi.fn(),
                playVictorySound: vi.fn(),
            },
        };

        showWinner(mockGame);

        expect(LevelsProgress.getState().spritesObtained).toBe(1);
        expect(document.getElementById('winnerText').innerHTML).toContain('Level 2 Failed');
        expect(mockGame._nextLevelToPlay).toBe(2);
        expect(mockGame.soundManager.playInvalidSound).toHaveBeenCalled();
    });

    it('shows level 100 completion secret announcement when beating level 100', () => {
        // Unlock up to level 100
        for (let lvl = 1; lvl < 100; lvl++) {
            LevelsProgress.recordLevelWin(lvl);
        }

        const mockGame = {
            isLevelsMode: true,
            currentLevel: 100,
            scores: { 1: 10, 2: 5 }, // Win level 100!
            player1Color: '#ff0000',
            player2Color: '#0000ff',
            soundManager: {
                playInvalidSound: vi.fn(),
                playVictorySound: vi.fn(),
            },
        };

        showWinner(mockGame);

        const winnerText = document.getElementById('winnerText');
        expect(winnerText.innerHTML).toContain('You beat level 100! Secret unlocked');
        expect(LevelsProgress.isEasterEggUnlocked()).toBe(true);
    });
});
