/**
 * ShapeKeeper - Input Handler
 * Mouse and touch input handling for the game
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import {
    handleCanvasBlur,
    handleCanvasFocus,
    handleKeyDown,
    handleKeyboardSelection,
    moveKeyboardFocus,
    setKeyboardFocusDot,
} from './input-handler/keyboard-controls.js';
import {
    getSquareAtPosition,
    handleClick,
    handleMouseMove,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    processClick,
    updateSelectionRibbon,
} from './input-handler/pointer-controls.js';
import { getNearestDot } from './utils.js';

export class InputHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.activeTouches = new Map();
        this.touchStartDot = null;
        this.lastInteractionTime = 0;
        this.lastTouchTime = 0;
        this.selectionLocked = false;
        this.hoveredDot = null;
        this.selectionRibbon = null;
        this._listenersAttached = false;
        this._boundHandlers = {
            touchStart: this.handleTouchStart.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            touchEnd: this.handleTouchEnd.bind(this),
            click: this.handleClick.bind(this),
            mouseMove: this.handleMouseMove.bind(this),
            keyDown: this.handleKeyDown.bind(this),
            focus: this.handleCanvasFocus.bind(this),
            blur: this.handleCanvasBlur.bind(this),
            contextMenu: this.handleContextMenu.bind(this),
        };

        this.setupEventListeners();
    }

    /**
     * Setup all input event listeners
     */
    setupEventListeners() {
        this.attachEventListeners();
    }

    /**
     * Attach input listeners to the current canvas
     */
    attachEventListeners() {
        if (!this.canvas || this._listenersAttached) {
            return;
        }

        // Multi-touch event listeners
        this.canvas.addEventListener('touchstart', this._boundHandlers.touchStart, {
            passive: false,
        });
        this.canvas.addEventListener('touchmove', this._boundHandlers.touchMove, {
            passive: false,
        });
        this.canvas.addEventListener('touchend', this._boundHandlers.touchEnd, {
            passive: false,
        });
        this.canvas.addEventListener('touchcancel', this._boundHandlers.touchEnd, {
            passive: false,
        });

        // Keep mouse support
        this.canvas.setAttribute('tabindex', this.canvas.getAttribute('tabindex') || '0');
        this.canvas.addEventListener('click', this._boundHandlers.click);
        this.canvas.addEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.addEventListener('keydown', this._boundHandlers.keyDown);
        this.canvas.addEventListener('focus', this._boundHandlers.focus);
        this.canvas.addEventListener('blur', this._boundHandlers.blur);
        this.canvas.addEventListener('contextmenu', this._boundHandlers.contextMenu);

        this._listenersAttached = true;
    }

    /**
     * Detach input listeners from the current canvas
     */
    detachEventListeners() {
        if (!this.canvas || !this._listenersAttached) {
            return;
        }

        this.canvas.removeEventListener('touchstart', this._boundHandlers.touchStart);
        this.canvas.removeEventListener('touchmove', this._boundHandlers.touchMove);
        this.canvas.removeEventListener('touchend', this._boundHandlers.touchEnd);
        this.canvas.removeEventListener('touchcancel', this._boundHandlers.touchEnd);
        this.canvas.removeEventListener('click', this._boundHandlers.click);
        this.canvas.removeEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.removeEventListener('keydown', this._boundHandlers.keyDown);
        this.canvas.removeEventListener('focus', this._boundHandlers.focus);
        this.canvas.removeEventListener('blur', this._boundHandlers.blur);
        this.canvas.removeEventListener('contextmenu', this._boundHandlers.contextMenu);

        this._listenersAttached = false;
    }

    /**
     * Reset transient input state during lifecycle changes
     */
    resetTransientState() {
        this.activeTouches.clear();
        this.touchStartDot = null;
        this.selectionLocked = false;
        this.hoveredDot = null;
        this.selectionRibbon = null;
        this.game.keyboardFocusDot = null;

        this.game.touchStartDot = null;
        this.game.hoveredDot = null;
        this.game.selectionRibbon = null;
    }

    syncPreviewState() {
        this.game.hoveredDot = this.hoveredDot;
        this.game.selectionRibbon = this.selectionRibbon;
    }

    setKeyboardFocusDot(dot, { announce = true } = {}) {
        setKeyboardFocusDot(this, dot, { announce });
    }

    handleCanvasFocus() {
        handleCanvasFocus(this);
    }

    handleCanvasBlur() {
        handleCanvasBlur(this);
    }

    moveKeyboardFocus(rowDelta, colDelta) {
        moveKeyboardFocus(this, rowDelta, colDelta);
    }

    handleKeyboardSelection() {
        handleKeyboardSelection(this);
    }

    handleKeyDown(e) {
        handleKeyDown(this, e);
    }

    /**
     * Move the handler to a replacement canvas without duplicating listeners
     * @param {HTMLCanvasElement} nextCanvas
     */
    rebindCanvas(nextCanvas) {
        if (!nextCanvas || nextCanvas === this.canvas) {
            return;
        }

        this.detachEventListeners();
        this.resetTransientState();
        this.canvas = nextCanvas;
        this.attachEventListeners();
    }

    /**
     * Prevent context menu on the canvas
     * @param {Event} e
     */
    handleContextMenu(e) {
        e.preventDefault();
    }

    /**
     * Get nearest dot to click position
     */
    getNearestDot(x, y) {
        return getNearestDot(
            x,
            y,
            this.game.offsetX,
            this.game.offsetY,
            this.game.cellSize,
            this.game.gridRows,
            this.game.gridCols
        );
    }

    /**
     * Handle mouse click
     */
    handleClick(e) {
        handleClick(this, e);
    }

    /**
     * Handle mouse move for hover effects
     */
    handleMouseMove(e) {
        handleMouseMove(this, e);
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        handleTouchStart(this, e);
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        handleTouchMove(this, e);
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        handleTouchEnd(this, e);
    }

    /**
     * Process click at position (shared between mouse and touch)
     */
    processClick(x, y) {
        processClick(this, x, y);
    }

    /**
     * Get square at position
     */
    getSquareAtPosition(x, y) {
        return getSquareAtPosition(this, x, y);
    }

    /**
     * Update selection ribbon position
     */
    updateSelectionRibbon(x, y) {
        updateSelectionRibbon(this, x, y);
    }

    /**
     * Get current input state
     */
    getState() {
        return {
            hoveredDot: this.hoveredDot,
            selectionRibbon: this.selectionRibbon,
        };
    }

    /**
     * Cleanup listeners for teardown/tests
     */
    destroy() {
        this.detachEventListeners();
        this.resetTransientState();
    }
}
