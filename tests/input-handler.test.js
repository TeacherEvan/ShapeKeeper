import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputHandler } from '../input-handler.js';

function makeGame() {
    return {
        offsetX: 0,
        offsetY: 0,
        cellSize: 40,
        gridRows: 5,
        gridCols: 5,
        isTouchDevice: false,
        selectionRadiusMultiplier: 1,
        keyboardFocusDot: null,
        touchStartDot: null,
        hoveredDot: null,
        selectionRibbon: null,
        key: {},
    };
}

describe('InputHandler', () => {
    let canvas;
    let game;
    let handler;
    beforeEach(() => {
        canvas = document.createElement('canvas');
        canvas.setAttribute('tabindex', '0');
        document.body.appendChild(canvas);
        game = makeGame();
        handler = new InputHandler(canvas, game);
    });
    afterEach(() => {
        handler.destroy();
        canvas.remove();
    });

    it('attaches listeners and sets tabindex on the canvas', () => {
        expect(handler._listenersAttached).toBe(true);
        expect(canvas.getAttribute('tabindex')).toBe('0');
    });

    it('detachEventListeners clears the attached flag', () => {
        handler.detachEventListeners();
        expect(handler._listenersAttached).toBe(false);
    });

    it('rebindCanvas swaps canvas without duplicating listeners', () => {
        const next = document.createElement('canvas');
        document.body.appendChild(next);
        handler.rebindCanvas(next);
        expect(handler.canvas).toBe(next);
        expect(handler._listenersAttached).toBe(true);
        // double-rebind to same canvas is a no-op
        handler.rebindCanvas(next);
        expect(handler.canvas).toBe(next);
        next.remove();
    });

    it('handleContextMenu prevents the default context menu', () => {
        let prevented = false;
        const e = {
            preventDefault: () => {
                prevented = true;
            },
        };
        handler.handleContextMenu(e);
        expect(prevented).toBe(true);
    });

    it('getState exposes hovered dot and selection ribbon', () => {
        handler.hoveredDot = { row: 1, col: 2 };
        const state = handler.getState();
        expect(state.hoveredDot).toEqual({ row: 1, col: 2 });
        expect(state.selectionRibbon).toBeNull();
    });

    it('resetTransientState clears transient input state and forwards to game', () => {
        handler.hoveredDot = { row: 1, col: 1 };
        handler.selectionLocked = true;
        handler.resetTransientState();
        expect(handler.hoveredDot).toBeNull();
        expect(handler.selectionLocked).toBe(false);
        expect(game.keyboardFocusDot).toBeNull();
    });

    it('destroy detaches listeners fully', () => {
        handler.destroy();
        expect(handler._listenersAttached).toBe(false);
    });
});
