// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { GameState } from '../game-state.js';

describe('GameState.setupCanvas layout bounds (P1-11)', () => {
    it('subtracts topTimerPad before computing cellSizeHeight so Level 100 fits inside 1280x600 container', () => {
        document.body.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'game-canvas-container';
        Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true });
        Object.defineProperty(container, 'clientHeight', { value: 433, configurable: true });
        const canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        container.appendChild(canvas);
        document.body.appendChild(container);

        const originalDpr = window.devicePixelRatio;
        Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });

        const mockCtx = {
            scale: vi.fn(),
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
        };
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx);

        try {
            const game = {
                gridSize: { rows: 15, cols: 10 },
                isLevelsMode: true,
                canvas,
                inputHandler: { rebindCanvas: vi.fn() },
            };
            const state = new GameState(game);
            state.setupCanvas();

            expect(game.logicalHeight).toBeLessThanOrEqual(433);
            expect(game.canvas.width).toBe(game.logicalWidth * 2); // DPR clamped at 2
        } finally {
            HTMLCanvasElement.prototype.getContext = origGetContext;
            Object.defineProperty(window, 'devicePixelRatio', {
                value: originalDpr,
                configurable: true,
            });
        }
    });
});
