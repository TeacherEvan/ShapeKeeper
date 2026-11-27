import { announceStatus } from '../ui/AccessibilityAnnouncer.js';
import { areAdjacent } from '../../utils.js';

/**
 * ShapeKeeper - Accessible Spatial DOM Keyboard Navigation Grid Tree
 * Manages an accessible DOM tree of grid cells overlaid/paired with canvas dots.
 * Supports keyboard navigation (Arrow keys), selection (Space/Enter), and Escape.
 */
export class AccessibleGridTree {
    constructor(game) {
        this.game = game;
        this.gridElement = null;
        this.dotButtons = new Map(); // key: "r,c" -> HTMLButtonElement
        this.focusedDot = null;
        this._rovingBtn = null;
        this._selectedBtn = null;
        this.isDestroyed = false;
        this._listeners = [];

        this.init();
    }

    init() {
        this.buildGridDOM();
    }

    /**
     * Build or rebuild the accessible DOM tree.
     */
    buildGridDOM() {
        if (this.gridElement && this.gridElement.parentNode) {
            this.gridElement.parentNode.removeChild(this.gridElement);
        }
        this.cleanupListeners();
        this.dotButtons.clear();
        this._rovingBtn = null;
        this._selectedBtn = null;

        const rows = this.game.gridRows || 4;
        const cols = this.game.gridCols || 4;

        const grid = document.createElement('div');
        grid.id = 'accessibleGridTree';
        grid.className = 'accessible-grid-tree visually-hidden';
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-rowcount', String(rows));
        grid.setAttribute('aria-colcount', String(cols));
        grid.setAttribute('aria-label', 'Dots and Boxes game board grid');

        for (let r = 0; r < rows; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.setAttribute('role', 'row');
            rowDiv.setAttribute('aria-rowindex', String(r + 1));

            for (let c = 0; c < cols; c++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('role', 'gridcell');
                btn.setAttribute('data-row', String(r));
                btn.setAttribute('data-col', String(c));
                btn.setAttribute('aria-rowindex', String(r + 1));
                btn.setAttribute('aria-colindex', String(c + 1));
                btn.setAttribute('aria-label', `Dot row ${r + 1}, column ${c + 1}`);
                btn.setAttribute('aria-selected', 'false');
                const isFirst = r === 0 && c === 0;
                btn.setAttribute('tabindex', isFirst ? '0' : '-1');
                if (isFirst) {
                    this._rovingBtn = btn;
                }

                this.dotButtons.set(`${r},${c}`, btn);
                rowDiv.appendChild(btn);
            }

            grid.appendChild(rowDiv);
        }

        const resolveCoords = (event) => {
            const btn = event.target?.closest?.('button[data-row][data-col]');
            if (!btn) return null;
            return {
                row: Number(btn.getAttribute('data-row')),
                col: Number(btn.getAttribute('data-col')),
            };
        };

        const onKeyDown = (e) => {
            const coords = resolveCoords(e);
            if (coords) this.handleKeyDown(coords.row, coords.col, e);
        };
        const onClick = (e) => {
            const coords = resolveCoords(e);
            if (coords) this.handleClick(coords.row, coords.col, e);
        };
        const onFocusIn = (e) => {
            const coords = resolveCoords(e);
            if (coords) this.handleFocus(coords.row, coords.col);
        };

        grid.addEventListener('keydown', onKeyDown);
        grid.addEventListener('click', onClick);
        grid.addEventListener('focusin', onFocusIn);
        this._listeners.push(
            { target: grid, type: 'keydown', listener: onKeyDown },
            { target: grid, type: 'click', listener: onClick },
            { target: grid, type: 'focusin', listener: onFocusIn }
        );

        this.gridElement = grid;

        // Insert adjacent to canvas or inside container
        const canvas = this.game.canvas || document.getElementById('gameCanvas');
        if (canvas && canvas.parentNode) {
            canvas.parentNode.insertBefore(grid, canvas.nextSibling);
        } else {
            document.body.appendChild(grid);
        }
    }

    rebuild() {
        this.buildGridDOM();
    }

    getDotButton(row, col) {
        return this.dotButtons.get(`${row},${col}`) || null;
    }

    focusDot(dot, { announce = true } = {}) {
        if (!dot) return;
        const maxRow = (this.game.gridRows || 4) - 1;
        const maxCol = (this.game.gridCols || 4) - 1;
        const targetRow = Math.max(0, Math.min(maxRow, dot.row));
        const targetCol = Math.max(0, Math.min(maxCol, dot.col));

        // O(1) roving tabindex update
        if (this._rovingBtn) {
            this._rovingBtn.setAttribute('tabindex', '-1');
        }

        const btn = this.getDotButton(targetRow, targetCol);
        if (btn) {
            btn.setAttribute('tabindex', '0');
            this._rovingBtn = btn;
            btn.focus();
        }

        this.focusedDot = { row: targetRow, col: targetCol };
        this.game.keyboardFocusDot = { row: targetRow, col: targetCol };
        this.game.showKeyboardFocusRing = true;

        if (this.game.draw) {
            this.game.draw();
        }

        if (announce) {
            announceStatus(`Board focus row ${targetRow + 1}, column ${targetCol + 1}.`);
        }
    }

    handleFocus(row, col) {
        this.focusedDot = { row, col };
        this.game.keyboardFocusDot = { row, col };
        this.game.showKeyboardFocusRing = true;
        if (this.game.draw) {
            this.game.draw();
        }
    }

    handleKeyDown(row, col, event) {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.moveFocus(-1, 0);
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveFocus(1, 0);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.moveFocus(0, -1);
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.moveFocus(0, 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.selectDot(row, col);
                break;
            case 'Escape':
                event.preventDefault();
                this.clearSelection();
                break;
            default:
                break;
        }
    }

    moveFocus(rowDelta, colDelta) {
        const current = this.focusedDot || { row: 0, col: 0 };
        const next = {
            row: current.row + rowDelta,
            col: current.col + colDelta,
        };
        this.focusDot(next);
    }

    handleClick(row, col, event) {
        if (event) {
            event.preventDefault();
        }
        this.selectDot(row, col);
    }

    selectDot(row, col) {
        const dot = { row, col };
        if (this.game.soundManager?.ensureAudioContext) {
            this.game.soundManager.ensureAudioContext();
        }

        if (!this.game.selectedDot) {
            if (
                this.game.tutorialSystem?.isActive?.() &&
                !this.game.tutorialSystem.canSelectDot(dot)
            ) {
                return;
            }

            this.game.selectedDot = dot;
            this.updateAriaSelected();
            this.game.tutorialSystem?.onDotSelected?.(dot);
            if (this.game.draw) {
                this.game.draw();
            }
            announceStatus(`Selected dot row ${row + 1}, column ${col + 1}.`);
            return;
        }

        // Clicking the same dot clears selection
        if (this.game.selectedDot.row === row && this.game.selectedDot.col === col) {
            this.clearSelection();
            return;
        }

        const startDot = this.game.selectedDot;

        if (areAdjacent(startDot, dot)) {
            const lineKey = this.game.getLineKey
                ? this.game.getLineKey(startDot, dot)
                : `${Math.min(startDot.row, dot.row)},${Math.min(startDot.col, dot.col)}-${Math.max(startDot.row, dot.row)},${Math.max(startDot.col, dot.col)}`;

            if (this.game.lines && this.game.lines.has(lineKey)) {
                announceStatus(
                    'That line has already been drawn. Choose a different adjacent dot.'
                );
                return;
            }

            announceStatus(
                `Drawing line from row ${startDot.row + 1}, column ${startDot.col + 1} to row ${row + 1}, column ${col + 1}.`
            );
            const finishSelection = () => {
                this.game.selectedDot = null;
                this.updateAriaSelected();
                if (this.game.draw) {
                    this.game.draw();
                }
            };
            this.game.selectionLocked = true;
            try {
                const drawResult = this.game.drawLine(startDot, dot);
                if (drawResult && typeof drawResult.then === 'function') {
                    drawResult
                        .then(() => finishSelection())
                        .finally(() => {
                            this.game.selectionLocked = false;
                        });
                } else {
                    finishSelection();
                    this.game.selectionLocked = false;
                }
            } catch (err) {
                this.game.selectionLocked = false;
                throw err;
            }
            return;
        }

        // Non-adjacent selection
        if (this.game.animationSystem?.triggerInvalidLineFlash) {
            this.game.animationSystem.triggerInvalidLineFlash(
                startDot,
                dot,
                this.game.offsetX || 0,
                this.game.offsetY || 0,
                this.game.cellSize || 40
            );
        }

        this.game.selectedDot = dot;
        this.updateAriaSelected();
        if (this.game.draw) {
            this.game.draw();
        }
        announceStatus('Move to an adjacent dot before drawing a line.');
    }

    clearSelection() {
        if (this.game.selectedDot) {
            this.game.selectedDot = null;
            this.updateAriaSelected();
            if (this.game.draw) {
                this.game.draw();
            }
            announceStatus('Selection cleared.');
        }
    }

    updateAriaSelected() {
        if (this._selectedBtn) {
            this._selectedBtn.setAttribute('aria-selected', 'false');
            this._selectedBtn = null;
        }
        if (this.game.selectedDot) {
            const btn = this.getDotButton(this.game.selectedDot.row, this.game.selectedDot.col);
            if (btn) {
                btn.setAttribute('aria-selected', 'true');
                this._selectedBtn = btn;
            }
        }
    }

    cleanupListeners() {
        for (const { target, type, listener } of this._listeners) {
            try {
                target.removeEventListener(type, listener);
            } catch {
                // ignore
            }
        }
        this._listeners = [];
    }

    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        this.cleanupListeners();
        if (this.gridElement && this.gridElement.parentNode) {
            this.gridElement.parentNode.removeChild(this.gridElement);
        }
        this.dotButtons.clear();
        this.gridElement = null;
    }
}
