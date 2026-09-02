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

function dispatchCanvasPointerEvent(
    canvas,
    type,
    { clientX, clientY, pointerId = 1, pointerType = 'touch', button = 0 }
) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries({
        clientX,
        clientY,
        pointerId,
        pointerType,
        button,
    })) {
        Object.defineProperty(event, key, { configurable: true, value });
    }
    event.preventDefault = vi.fn();
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
            soundManager: {
                ensureAudioContext: vi.fn(),
            },
            squareMultipliers: {},
            squares: {},
            tileEffects: {},
            touchStartDot: null,
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

        dispatchCanvasPointerEvent(canvas, 'pointerdown', {
            clientX: 20,
            clientY: 20,
            pointerId: 1,
        });
        dispatchCanvasPointerEvent(canvas, 'pointerup', {
            clientX: 20,
            clientY: 20,
            pointerId: 1,
        });

        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        dispatchCanvasPointerEvent(canvas, 'pointerdown', {
            clientX: 60,
            clientY: 20,
            pointerId: 2,
        });
        dispatchCanvasPointerEvent(canvas, 'pointerup', {
            clientX: 60,
            clientY: 20,
            pointerId: 2,
        });

        expect(game.drawLine).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 1 });

        handler.destroy();
    });

    it('draws a line when a touch/pen/mouse drag starts on one dot and ends on an adjacent dot', () => {
        const canvas = createCanvas();
        const handler = new InputHandler(canvas, game);

        dispatchCanvasPointerEvent(canvas, 'pointerdown', {
            clientX: 20,
            clientY: 20,
            pointerId: 10,
            pointerType: 'touch',
        });
        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        dispatchCanvasPointerEvent(canvas, 'pointermove', {
            clientX: 60,
            clientY: 20,
            pointerId: 10,
            pointerType: 'touch',
        });
        dispatchCanvasPointerEvent(canvas, 'pointerup', {
            clientX: 60,
            clientY: 20,
            pointerId: 10,
            pointerType: 'touch',
        });

        expect(game.drawLine).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 1 });
        expect(handler.activePointers.size).toBe(0);

        handler.destroy();
    });

    it('cancels an active pointer without drawing or losing the selected start dot', () => {
        const canvas = createCanvas();
        const handler = new InputHandler(canvas, game);

        dispatchCanvasPointerEvent(canvas, 'pointerdown', {
            clientX: 20,
            clientY: 20,
            pointerId: 11,
            pointerType: 'touch',
        });
        dispatchCanvasPointerEvent(canvas, 'pointercancel', {
            clientX: 60,
            clientY: 20,
            pointerId: 11,
            pointerType: 'touch',
        });

        expect(game.drawLine).not.toHaveBeenCalled();
        expect(game.selectedDot).toEqual({ row: 0, col: 0 });
        expect(handler.activePointers.size).toBe(0);

        handler.destroy();
    });

    it('uses the larger mobile selection radius for touch targeting', () => {
        game.isTouchDevice = true;
        game.selectionRadiusMultiplier = 0.68;

        const canvas = createCanvas();
        const handler = new InputHandler(canvas, game);

        dispatchCanvasPointerEvent(canvas, 'pointerdown', {
            clientX: 36,
            clientY: 36,
            pointerId: 1,
        });
        dispatchCanvasPointerEvent(canvas, 'pointerup', {
            clientX: 36,
            clientY: 36,
            pointerId: 1,
        });

        expect(game.selectedDot).toEqual({ row: 0, col: 0 });

        handler.destroy();
    });
});
