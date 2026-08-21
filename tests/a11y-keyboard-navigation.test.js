import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibleGridTree } from '../src/a11y/AccessibleGridTree.js';
import * as AccessibilityAnnouncer from '../src/ui/AccessibilityAnnouncer.js';

describe('AccessibleGridTree', () => {
    let game;
    let container;

    beforeEach(() => {
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.id = 'gameContainer';
        const canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        container.appendChild(canvas);
        document.body.appendChild(container);

        const liveRegion = document.createElement('div');
        liveRegion.id = 'appLiveRegion';
        document.body.appendChild(liveRegion);

        const alertRegion = document.createElement('div');
        alertRegion.id = 'appAlertRegion';
        document.body.appendChild(alertRegion);

        game = {
            gridRows: 4,
            gridCols: 4,
            cellSize: 40,
            offsetX: 20,
            offsetY: 20,
            selectedDot: null,
            keyboardFocusDot: null,
            lines: new Set(),
            squares: {},
            animationSystem: {
                triggerInvalidLineFlash: vi.fn(),
            },
            soundManager: {
                ensureAudioContext: vi.fn(),
            },
            draw: vi.fn(),
            drawLine: vi.fn(),
            getLineKey: vi.fn((d1, d2) => {
                const r1 = Math.min(d1.row, d2.row);
                const c1 = Math.min(d1.col, d2.col);
                const r2 = Math.max(d1.row, d2.row);
                const c2 = Math.max(d1.col, d2.col);
                return `${r1},${c1}-${r2},${c2}`;
            }),
            disposables: {
                addDisposable: vi.fn((d) => d),
            },
            canvas,
        };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('a) Constructing the accessible grid tree with ARIA attributes matching grid dimensions', () => {
        it('creates a grid container with role="grid", aria-rowcount, and aria-colcount', () => {
            const tree = new AccessibleGridTree(game);
            const gridEl = tree.gridElement;

            expect(gridEl).toBeDefined();
            expect(gridEl.getAttribute('role')).toBe('grid');
            expect(gridEl.getAttribute('aria-rowcount')).toBe('4');
            expect(gridEl.getAttribute('aria-colcount')).toBe('4');
            expect(gridEl.getAttribute('aria-label')).toBe('Dots and Boxes game board grid');

            const rows = gridEl.querySelectorAll('[role="row"]');
            expect(rows.length).toBe(4);

            const buttons = gridEl.querySelectorAll('button[role="gridcell"]');
            expect(buttons.length).toBe(16);

            const firstBtn = buttons[0];
            expect(firstBtn.getAttribute('data-row')).toBe('0');
            expect(firstBtn.getAttribute('data-col')).toBe('0');
            expect(firstBtn.getAttribute('aria-rowindex')).toBe('1');
            expect(firstBtn.getAttribute('aria-colindex')).toBe('1');
            expect(firstBtn.getAttribute('aria-label')).toBe('Dot row 1, column 1');
            expect(firstBtn.getAttribute('tabindex')).toBe('0');

            tree.destroy();
        });

        it('supports rebuild / updateDimensions when grid size changes', () => {
            const tree = new AccessibleGridTree(game);
            expect(tree.gridElement.querySelectorAll('button[role="gridcell"]').length).toBe(16);

            game.gridRows = 5;
            game.gridCols = 5;
            tree.rebuild();

            expect(tree.gridElement.getAttribute('aria-rowcount')).toBe('5');
            expect(tree.gridElement.getAttribute('aria-colcount')).toBe('5');
            expect(tree.gridElement.querySelectorAll('button[role="gridcell"]').length).toBe(25);

            tree.destroy();
        });
    });

    describe('b) Arrow key navigation updating focus dot with boundary clamping', () => {
        it('navigates with ArrowRight, ArrowDown, ArrowLeft, ArrowUp with boundary clamping', () => {
            const tree = new AccessibleGridTree(game);
            tree.focusDot({ row: 0, col: 0 });

            expect(tree.focusedDot).toEqual({ row: 0, col: 0 });
            expect(game.keyboardFocusDot).toEqual({ row: 0, col: 0 });

            const firstBtn = tree.getDotButton(0, 0);
            expect(firstBtn.getAttribute('tabindex')).toBe('0');

            // Clamp on top/left
            firstBtn.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
            );
            expect(tree.focusedDot).toEqual({ row: 0, col: 0 });

            firstBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
            expect(tree.focusedDot).toEqual({ row: 0, col: 0 });

            // Move Right
            firstBtn.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
            );
            expect(tree.focusedDot).toEqual({ row: 0, col: 1 });
            expect(game.keyboardFocusDot).toEqual({ row: 0, col: 1 });

            // Move Down
            const currentBtn = tree.getDotButton(0, 1);
            currentBtn.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
            );
            expect(tree.focusedDot).toEqual({ row: 1, col: 1 });

            // Move beyond bottom-right boundary
            tree.focusDot({ row: 3, col: 3 });
            const brBtn = tree.getDotButton(3, 3);
            brBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            expect(tree.focusedDot).toEqual({ row: 3, col: 3 });

            brBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
            expect(tree.focusedDot).toEqual({ row: 3, col: 3 });

            tree.destroy();
        });
    });

    describe('c) Space/Enter selecting start dot and connecting adjacent dot to trigger game.drawLine', () => {
        it('selects dot on Enter/Space and connects adjacent dot on second selection', () => {
            const tree = new AccessibleGridTree(game);
            const btn00 = tree.getDotButton(0, 0);

            // Select (0,0)
            btn00.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            expect(game.selectedDot).toEqual({ row: 0, col: 0 });
            expect(btn00.getAttribute('aria-selected')).toBe('true');

            // Move to (0,1) and press Space
            const btn01 = tree.getDotButton(0, 1);
            btn01.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

            expect(game.drawLine).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 1 });
            expect(game.selectedDot).toBeNull();
            expect(btn00.getAttribute('aria-selected')).toBe('false');

            tree.destroy();
        });

        it('handles clicking the button element directly', () => {
            const tree = new AccessibleGridTree(game);
            const btn00 = tree.getDotButton(0, 0);
            const btn10 = tree.getDotButton(1, 0);

            btn00.click();
            expect(game.selectedDot).toEqual({ row: 0, col: 0 });

            btn10.click();
            expect(game.drawLine).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 1, col: 0 });

            tree.destroy();
        });

        it('warns / prevents drawing if line already exists', () => {
            const announceSpy = vi.spyOn(AccessibilityAnnouncer, 'announceStatus');
            game.lines.add('0,0-0,1');
            const tree = new AccessibleGridTree(game);

            const btn00 = tree.getDotButton(0, 0);
            btn00.click();

            const btn01 = tree.getDotButton(0, 1);
            btn01.click();

            expect(game.drawLine).not.toHaveBeenCalled();
            expect(announceSpy).toHaveBeenCalledWith(expect.stringContaining('already been drawn'));

            tree.destroy();
        });

        it('triggers invalid line flash and reselects if non-adjacent dot is picked', () => {
            const announceSpy = vi.spyOn(AccessibilityAnnouncer, 'announceStatus');
            const tree = new AccessibleGridTree(game);

            const btn00 = tree.getDotButton(0, 0);
            btn00.click();

            const btn22 = tree.getDotButton(2, 2);
            btn22.click();

            expect(game.drawLine).not.toHaveBeenCalled();
            expect(game.animationSystem.triggerInvalidLineFlash).toHaveBeenCalled();
            expect(game.selectedDot).toEqual({ row: 2, col: 2 });
            expect(announceSpy).toHaveBeenCalledWith(expect.stringContaining('adjacent'));

            tree.destroy();
        });
    });

    describe('d) Escape key clearing selection', () => {
        it('clears selectedDot and resets aria-selected on Escape', () => {
            const announceSpy = vi.spyOn(AccessibilityAnnouncer, 'announceStatus');
            const tree = new AccessibleGridTree(game);
            const btn00 = tree.getDotButton(0, 0);

            btn00.click();
            expect(game.selectedDot).toEqual({ row: 0, col: 0 });
            expect(btn00.getAttribute('aria-selected')).toBe('true');

            btn00.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(game.selectedDot).toBeNull();
            expect(btn00.getAttribute('aria-selected')).toBe('false');
            expect(announceSpy).toHaveBeenCalledWith('Selection cleared.');

            tree.destroy();
        });
    });

    describe('e) Screen-reader announcement calls', () => {
        it('calls announceStatus on focus changes and dot selection', () => {
            const announceSpy = vi.spyOn(AccessibilityAnnouncer, 'announceStatus');
            const tree = new AccessibleGridTree(game);

            tree.focusDot({ row: 1, col: 2 });
            expect(announceSpy).toHaveBeenCalledWith('Board focus row 2, column 3.');

            const btn12 = tree.getDotButton(1, 2);
            btn12.click();
            expect(announceSpy).toHaveBeenCalledWith('Selected dot row 2, column 3.');

            tree.destroy();
        });
    });

    describe('f) Teardown / destroy() cleaning up elements and key bindings', () => {
        it('removes the grid container from DOM and cleans up all listeners', () => {
            const tree = new AccessibleGridTree(game);
            const gridEl = tree.gridElement;
            expect(document.body.contains(gridEl)).toBe(true);

            tree.destroy();

            expect(document.body.contains(gridEl)).toBe(false);
            expect(tree.isDestroyed).toBe(true);
        });
    });
});
