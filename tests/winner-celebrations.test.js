// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showWinner, stopCelebrationAnimations } from '../ui-manager/celebrations.js';

function renderWinnerDom() {
    document.body.innerHTML = `
        <section id="gameScreen" class="screen active"></section>
        <section id="winnerScreen" class="screen" hidden>
            <div class="winner-container">
                <h1 id="winnerScreenTitle">Game Over!</h1>
                <h2 id="winnerText"></h2>
                <div id="finalScores" class="final-scores"></div>
                <button id="playAgain">Play Again</button>
                <button id="winnerLevelsBtn" hidden>Levels Grid</button>
                <button id="winnerMainMenu">Main Menu</button>
            </div>
        </section>
    `;
}

describe('Winner celebrations — 6-player names, ranks, and clean class reset', () => {
    beforeEach(() => {
        vi.stubGlobal('matchMedia', () => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        renderWinnerDom();
    });

    afterEach(() => {
        stopCelebrationAnimations();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('renders all 6 player names with distinct ranks and compact multi-player-scores class', () => {
        const game = {
            playerCount: 6,
            isMultiplayer: true,
            isLevelsMode: false,
            playerNames: {
                1: 'TeacherEvan',
                2: 'Alex',
                3: 'Sarah',
                4: 'Marcus',
                5: 'Priya',
                6: 'Devon',
            },
            playerColors: {
                1: '#ef4444',
                2: '#3b82f6',
                3: '#22c55e',
                4: '#f5b727',
                5: '#8b5cf6',
                6: '#06b6d4',
            },
            scores: { 1: 4, 2: 14, 3: 9, 4: 11, 5: 2, 6: 7 },
        };

        showWinner(game);

        const finalScores = document.getElementById('finalScores');
        expect(finalScores.classList.contains('multi-player-scores')).toBe(true);

        const rows = Array.from(finalScores.querySelectorAll('.final-score-entry')).map((el) => ({
            rank: el.querySelector('.final-score-rank').textContent,
            name: el.querySelector('.final-score-name').textContent,
            pts: el.querySelector('.final-score-points').textContent,
        }));

        expect(rows).toEqual([
            { rank: '🥇', name: 'Alex', pts: '14' },
            { rank: '🥈', name: 'Marcus', pts: '11' },
            { rank: '🥉', name: 'Sarah', pts: '9' },
            { rank: '#4', name: 'Devon', pts: '7' },
            { rank: '#5', name: 'TeacherEvan', pts: '4' },
            { rank: '#6', name: 'Priya', pts: '2' },
        ]);
    });

    it('clears stale winner-loss-heading class on a subsequent victory', () => {
        const lossGame = {
            playerCount: 2,
            isLevelsMode: true,
            currentLevel: 1,
            playerColors: { 1: '#ef4444', 2: '#3b82f6' },
            scores: { 1: 1, 2: 3 },
        };
        showWinner(lossGame);
        expect(
            document.getElementById('winnerText').classList.contains('winner-loss-heading')
        ).toBe(true);

        const winGame = {
            playerCount: 2,
            isLevelsMode: false,
            playerColors: { 1: '#ef4444', 2: '#3b82f6' },
            scores: { 1: 5, 2: 2 },
        };
        showWinner(winGame);
        expect(
            document.getElementById('winnerText').classList.contains('winner-loss-heading')
        ).toBe(false);
    });
});
