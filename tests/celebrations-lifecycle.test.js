// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    launchFireworks,
    showWinner,
    stopCelebrationAnimations,
} from '../ui-manager/celebrations.js';

describe('Celebrations lifecycle and Light-theme contrast (P1-13)', () => {
    let origGetContext;
    let origRAF;
    let origCAF;
    let mockCtx;

    beforeEach(() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.innerHTML = `
            <div id="gameScreen" class="active"></div>
            <div id="winnerScreen">
                <h1 id="winnerScreenTitle"></h1>
                <h2 id="winnerText"></h2>
                <div id="finalScores"></div>
                <button id="playAgain"></button>
                <button id="winnerLevelsBtn"></button>
            </div>
        `;
        mockCtx = {
            setTransform: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            globalCompositeOperation: 'source-over',
            fillStyle: '',
        };
        origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx);
        origRAF = window.requestAnimationFrame;
        origCAF = window.cancelAnimationFrame;
    });

    afterEach(() => {
        stopCelebrationAnimations();
        HTMLCanvasElement.prototype.getContext = origGetContext;
        window.requestAnimationFrame = origRAF;
        window.cancelAnimationFrame = origCAF;
        vi.restoreAllMocks();
    });

    it('uses destination-out composite fade in launchFireworks so Light theme is never veiled black', () => {
        let rafCb = null;
        window.requestAnimationFrame = vi.fn((cb) => {
            rafCb = cb;
            return 1;
        });
        window.cancelAnimationFrame = vi.fn();

        const compositeOps = [];
        Object.defineProperty(mockCtx, 'globalCompositeOperation', {
            get: () => compositeOps[compositeOps.length - 1] || 'source-over',
            set: (v) => {
                compositeOps.push(v);
            },
            configurable: true,
        });

        launchFireworks('#1D4ED8');
        expect(typeof rafCb).toBe('function');
        rafCb(100);

        expect(compositeOps).toContain('destination-out');
        stopCelebrationAnimations();
        expect(document.getElementById('fireworksCanvas')).toBeNull();
    });

    it('renders showWinner reward/loss notes with CSS classes and zero inline low-contrast hexes', () => {
        window.requestAnimationFrame = vi.fn(() => 1);
        window.cancelAnimationFrame = vi.fn();

        const game = {
            isLevelsMode: true,
            currentLevel: 1,
            scores: { 1: 4, 2: 0 },
            player1Color: '#FF5C5C',
            player2Color: '#3B82F6',
            soundManager: { playVictorySound: vi.fn(), playInvalidSound: vi.fn() },
        };

        showWinner(game);
        const winnerHtml = document.getElementById('winnerText').innerHTML;
        expect(winnerHtml).not.toContain('#00f0ff');
        expect(winnerHtml).not.toContain('#ffd700');
        expect(winnerHtml).not.toContain('#FFB088');
        expect(document.querySelector('.winner-reward-note')).toBeTruthy();
    });
});
