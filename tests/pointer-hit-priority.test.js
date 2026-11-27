import { describe, expect, it, vi } from 'vitest';
import {
    handlePointerDown,
    handlePointerUp,
    processClick,
} from '../input-handler/pointer-controls.js';

function makeHandler(overrides = {}) {
    const game = {
        gridRows: 4,
        gridCols: 4,
        cellSize: 60,
        offsetX: 20,
        offsetY: 20,
        isMultiplayer: false,
        currentPlayer: 1,
        myPlayerNumber: 1,
        selectedDot: null,
        squares: { '0,0': 2 },
        squareMultipliers: {},
        revealedMultipliers: new Set(),
        lines: new Set(),
        getLineKey: (d1, d2) => `${d1.row},${d1.col}-${d2.row},${d2.col}`,
        drawLine: vi.fn(),
        tapSquare: vi.fn(),
        draw: vi.fn(),
        soundManager: { ensureAudioContext: vi.fn() },
        animationSystem: { triggerInvalidLineFlash: vi.fn() },
        ...overrides,
    };

    const canvas = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: () => false,
    };

    return {
        game,
        canvas,
        activePointers: new Map(),
        selectionLocked: false,
        hoveredDot: null,
        selectionRibbon: null,
        syncPreviewState: vi.fn(),
        setKeyboardFocusDot: vi.fn(),
        getNearestDot: (x, y) => {
            const col = Math.round((x - game.offsetX) / game.cellSize);
            const row = Math.round((y - game.offsetY) / game.cellSize);
            if (row < 0 || row >= game.gridRows || col < 0 || col >= game.gridCols) return null;
            const dist = Math.hypot(
                x - (game.offsetX + col * game.cellSize),
                y - (game.offsetY + row * game.cellSize)
            );
            return dist <= game.cellSize * 0.4 ? { row, col } : null;
        },
    };
}

describe('pointer-controls hit priority (P1-3)', () => {
    it('does not swallow dot clicks near an opponent square in local/Levels mode', () => {
        const handler = makeHandler();
        // Player selects dot (1,0), then clicks 4px inside opponent square (0,0) near dot (1,1)
        handler.game.selectedDot = { row: 1, col: 0 };
        const nearDot11X = 20 + 60 - 4; // 76 (inside col 0, 4px from dot (1,1))
        const nearDot11Y = 20 + 60 - 4; // 76 (inside row 0, 4px from dot (1,1))

        handlePointerDown(handler, {
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: nearDot11X,
            clientY: nearDot11Y,
            preventDefault: vi.fn(),
        });
        handlePointerUp(handler, {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: nearDot11X,
            clientY: nearDot11Y,
            preventDefault: vi.fn(),
        });

        expect(handler.game.drawLine).toHaveBeenCalledWith({ row: 1, col: 0 }, { row: 1, col: 1 });
        expect(handler.game.tapSquare).not.toHaveBeenCalled();
    });

    it('still allows tapping the center of an unrevealed multiplayer multiplier square', () => {
        const handler = makeHandler({
            isMultiplayer: true,
            squareMultipliers: { '0,0': { type: 'multiplier', value: 2 } },
        });
        // Center of cell (0,0): x = 50, y = 50 (distance to nearest dot = 42.4 > 24)
        processClick(handler, 50, 50);

        expect(handler.game.tapSquare).toHaveBeenCalledWith('0,0');
        expect(handler.game.drawLine).not.toHaveBeenCalled();
    });
});
