import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InputHandler } from './input-handler.js';

function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
        bottom: 200,
        height: 200,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
        x: 0,
        y: 0,
    });
    document.body.appendChild(canvas);
    return canvas;
}

function dispatchCanvasClick(canvas, x, y) {
    canvas.dispatchEvent(
        new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
        })
    );
}

function dispatchCanvasTouchEvent(canvas, type, touches) {
    const event = new Event(type, {
        bubbles: true,
        cancelable: true,
    });
    Object.defineProperty(event, 'changedTouches', {
        configurable: true,
        value: touches,
    });
    canvas.dispatchEvent(event);
}

function dispatchCanvasKey(canvas, key) {
    canvas.dispatchEvent(
        new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key,
        })
    );
}

describe('Root InputHandler canvas lifecycle', () => {
    let game;

    beforeEach(() => {
        document.body.innerHTML = '';
        game = {
            animationSystem: {
                addTouchVisual: vi.fn(),
                triggerInvalidLineFlash: vi.fn(),
            },
            cellSize: 40,
            draw: vi.fn(),
            drawLine: vi.fn(),
            getLineKey: vi.fn(() => '0,0-0,1'),
            gridCols: 5,
            gridRows: 5,
            hoveredDot: null,
            isMultiplayer: false,
            lines: new Set(),
            offsetX: 20,
            offsetY: 20,
            playerEffects: { 1: {}, 2: {} },
            revealedEffects: new Set(),
            revealedMultipliers: new Set(),
            selectedDot: null,
            selectionRibbon: null,
            showShapeMessage: vi.fn(),
            soundManager: {
                ensureAudioContext: vi.fn(),
            },
            squareMultipliers: {},
            squares: {},
            tileEffects: {},
            touchStartDot: null,
            triangleCellOwners: new Map(),
        };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('rebinds listeners to a replacement canvas and ignores the detached canvas', () => {
        const originalCanvas = createCanvas();
        const replacementCanvas = createCanvas();
        const handler = new InputHandler(originalCanvas, game);

        dispatchCanvasClick(originalCanvas, 20, 20);
        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        game.selectedDot = null;
        handler.lastInteractionTime = 0;

        handler.rebindCanvas(replacementCanvas);
        expect(handler.canvas).toBe(replacementCanvas);

        dispatchCanvasClick(originalCanvas, 20, 20);
        expect(game.selectedDot).toBeNull();

        handler.lastInteractionTime = 0;
        dispatchCanvasClick(replacementCanvas, 20, 20);
        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        handler.destroy();
    });

    it('supports keyboard navigation across board dots', () => {
        const canvas = createCanvas();
        const handler = new InputHandler(canvas, game);

        canvas.dispatchEvent(new FocusEvent('focus'));
        expect(game.keyboardFocusDot).toEqual({ row: 0, col: 0 });

        dispatchCanvasKey(canvas, 'ArrowRight');
        expect(game.keyboardFocusDot).toEqual({ row: 0, col: 1 });

        dispatchCanvasKey(canvas, 'ArrowDown');
        expect(game.keyboardFocusDot).toEqual({ row: 1, col: 1 });

        handler.destroy();
    });

    it('draws an adjacent line with keyboard selection controls', () => {
        const canvas = createCanvas();
        const handler = new InputHandler(canvas, game);

        canvas.dispatchEvent(new FocusEvent('focus'));

        dispatchCanvasKey(canvas, 'Enter');
        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        dispatchCanvasKey(canvas, 'ArrowRight');
        dispatchCanvasKey(canvas, 'Enter');

        expect(game.drawLine).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 1 });

        handler.destroy();
    });

    it('accepts native-speed touch taps when selecting adjacent dots', () => {
        const canvas = createCanvas();
        const handler = new InputHandler(canvas, game);

        dispatchCanvasTouchEvent(canvas, 'touchstart', [
            { clientX: 20, clientY: 20, identifier: 1 },
        ]);
        dispatchCanvasTouchEvent(canvas, 'touchend', [
            { clientX: 20, clientY: 20, identifier: 1 },
        ]);

        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        dispatchCanvasTouchEvent(canvas, 'touchstart', [
            { clientX: 60, clientY: 20, identifier: 2 },
        ]);
        dispatchCanvasTouchEvent(canvas, 'touchend', [
            { clientX: 60, clientY: 20, identifier: 2 },
        ]);

        expect(game.drawLine).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 1 });

        handler.destroy();
    });
});
