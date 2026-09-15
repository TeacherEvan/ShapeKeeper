/**
 * ShapeKeeper - Input Handler
 * Unified mouse, touch, pen and keyboard input handling
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
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleClick,
    handleMouseMove,
    processClick,
    updateSelectionRibbon,
} from './input-handler/pointer-controls.js';
import { getDotSelectionRadiusMultiplier, getNearestDot } from './utils.js';

export class InputHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.activePointers = new Map();
        this.activeTouches = this.activePointers;
        this.touchStartDot = null;
        this.lastInteractionTime = 0;
        this.lastTouchTime = 0;
        this.selectionLocked = false;
        this.hoveredDot = null;
        this.selectionRibbon = null;
        this.lastPointerMoveTime = 0;
        this.lastTouchMoveTime = 0;
        this.suppressNextClickUntil = 0;
        this._listenersAttached = false;
        this._boundHandlers = {
            pointerDown: this.handlePointerDown.bind(this),
            pointerMove: this.handlePointerMove.bind(this),
            pointerUp: this.handlePointerUp.bind(this),
            pointerCancel: this.handlePointerCancel.bind(this),
            lostPointerCapture: this.handlePointerCancel.bind(this),
            click: this.handleClick.bind(this),
            mouseMove: this.handleMouseMove.bind(this),
            keyDown: this.handleKeyDown.bind(this),
            focus: this.handleCanvasFocus.bind(this),
            blur: this.handleCanvasBlur.bind(this),
            contextMenu: this.handleContextMenu.bind(this),
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        if (!this.canvas || this._listenersAttached) {
            return;
        }

        // Pointer Events unify mouse, touch and pen input and give us pointer capture
        // so a drag can finish even if the contact leaves the canvas.
        this.canvas.addEventListener('pointerdown', this._boundHandlers.pointerDown);
        this.canvas.addEventListener('pointermove', this._boundHandlers.pointerMove);
        this.canvas.addEventListener('pointerup', this._boundHandlers.pointerUp);
        this.canvas.addEventListener('pointercancel', this._boundHandlers.pointerCancel);
        this.canvas.addEventListener('lostpointercapture', this._boundHandlers.lostPointerCapture);

        this.canvas.setAttribute('tabindex', this.canvas.getAttribute('tabindex') || '0');
        this.canvas.addEventListener('click', this._boundHandlers.click);
        this.canvas.addEventListener('keydown', this._boundHandlers.keyDown);
        this.canvas.addEventListener('focus', this._boundHandlers.focus);
        this.canvas.addEventListener('blur', this._boundHandlers.blur);
        this.canvas.addEventListener('contextmenu', this._boundHandlers.contextMenu);

        this._listenersAttached = true;
    }

    detachEventListeners() {
        if (!this.canvas || !this._listenersAttached) {
            return;
        }

        this.canvas.removeEventListener('pointerdown', this._boundHandlers.pointerDown);
        this.canvas.removeEventListener('pointermove', this._boundHandlers.pointerMove);
        this.canvas.removeEventListener('pointerup', this._boundHandlers.pointerUp);
        this.canvas.removeEventListener('pointercancel', this._boundHandlers.pointerCancel);
        this.canvas.removeEventListener(
            'lostpointercapture',
            this._boundHandlers.lostPointerCapture
        );
        this.canvas.removeEventListener('click', this._boundHandlers.click);
        this.canvas.removeEventListener('keydown', this._boundHandlers.keyDown);
        this.canvas.removeEventListener('focus', this._boundHandlers.focus);
        this.canvas.removeEventListener('blur', this._boundHandlers.blur);
        this.canvas.removeEventListener('contextmenu', this._boundHandlers.contextMenu);

        this._listenersAttached = false;
    }

    resetTransientState() {
        for (const pointerId of this.activePointers.keys()) {
            if (this.canvas?.releasePointerCapture && this.canvas.hasPointerCapture?.(pointerId)) {
                try {
                    this.canvas.releasePointerCapture(pointerId);
                } catch {
                    // Pointer may already have been released/cancelled by the browser.
                }
            }
        }

        this.activePointers.clear();
        this.touchStartDot = null;
        this.selectionLocked = false;
        this.hoveredDot = null;
        this.selectionRibbon = null;
        this.lastPointerMoveTime = 0;
        this.lastTouchMoveTime = 0;
        this.suppressNextClickUntil = 0;
        this.lastTouchTime = 0;
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

    rebindCanvas(nextCanvas) {
        if (!nextCanvas || nextCanvas === this.canvas) {
            return;
        }

        this.detachEventListeners();
        this.resetTransientState();
        this.canvas = nextCanvas;
        this.attachEventListeners();
    }

    handleContextMenu(e) {
        e.preventDefault();
    }

    getNearestDot(x, y) {
        return getNearestDot(
            x,
            y,
            this.game.offsetX,
            this.game.offsetY,
            this.game.cellSize,
            this.game.gridRows,
            this.game.gridCols,
            this.game.selectionRadiusMultiplier ||
                getDotSelectionRadiusMultiplier(this.game.isTouchDevice)
        );
    }

    handleClick(e) {
        handleClick(this, e);
    }

    handleMouseMove(e) {
        handleMouseMove(this, e);
    }

    handlePointerDown(e) {
        handlePointerDown(this, e);
    }

    handlePointerMove(e) {
        handlePointerMove(this, e);
    }

    handlePointerUp(e) {
        handlePointerUp(this, e);
    }

    handlePointerCancel(e) {
        handlePointerCancel(this, e);
    }

    // Backwards-compatible entry points for existing integrations/tests.
    handleTouchStart(e) {
        this.handlePointerDown(e);
    }

    handleTouchMove(e) {
        this.handlePointerMove(e);
    }

    handleTouchEnd(e) {
        this.handlePointerUp(e);
    }

    processClick(x, y) {
        processClick(this, x, y);
    }

    getSquareAtPosition(x, y) {
        return getSquareAtPosition(this, x, y);
    }

    updateSelectionRibbon(x, y) {
        updateSelectionRibbon(this, x, y);
    }

    getState() {
        return {
            hoveredDot: this.hoveredDot,
            selectionRibbon: this.selectionRibbon,
        };
    }

    destroy() {
        this.detachEventListeners();
        this.resetTransientState();
    }
}
