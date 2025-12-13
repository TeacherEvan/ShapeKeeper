/**
 * ShapeKeeper Input Handler
 * Handles touch and mouse input with debouncing and gesture detection
 * @module game/InputHandler
 */

/**
 * Input event data
 * @typedef {Object} InputEvent
 * @property {number} x - Canvas X coordinate
 * @property {number} y - Canvas Y coordinate
 * @property {string} type - 'start', 'move', 'end'
 * @property {boolean} isTouchDevice - Whether input is from touch
 */

export class InputHandler {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            touchDebounceMs: 100,
            doubleTapMs: 300,
            longPressMs: 500,
            dragThreshold: 10,
            ...options,
        };

        // State
        this.isEnabled = true;
        this.isTouchDevice = false;
        this.lastTouchTime = 0;
        this.lastTapTime = 0;
        this.lastTapPosition = null;
        this.touchStartPosition = null;
        this.isDragging = false;
        this.longPressTimer = null;
        this.selectionLocked = false;

        // Callbacks
        this.onTap = null;
        this.onDoubleTap = null;
        this.onLongPress = null;
        this.onDragStart = null;
        this.onDrag = null;
        this.onDragEnd = null;
        this.onHover = null;

        this._boundHandlers = {};
        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Touch events
        this._boundHandlers.touchStart = this._handleTouchStart.bind(this);
        this._boundHandlers.touchMove = this._handleTouchMove.bind(this);
        this._boundHandlers.touchEnd = this._handleTouchEnd.bind(this);

        // Mouse events
        this._boundHandlers.mouseDown = this._handleMouseDown.bind(this);
        this._boundHandlers.mouseMove = this._handleMouseMove.bind(this);
        this._boundHandlers.mouseUp = this._handleMouseUp.bind(this);
        this._boundHandlers.mouseLeave = this._handleMouseLeave.bind(this);

        // Click event (fallback)
        this._boundHandlers.click = this._handleClick.bind(this);

        // Add listeners
        this.canvas.addEventListener('touchstart', this._boundHandlers.touchStart, {
            passive: false,
        });
        this.canvas.addEventListener('touchmove', this._boundHandlers.touchMove, {
            passive: false,
        });
        this.canvas.addEventListener('touchend', this._boundHandlers.touchEnd, { passive: false });
        this.canvas.addEventListener('mousedown', this._boundHandlers.mouseDown);
        this.canvas.addEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.addEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.addEventListener('mouseleave', this._boundHandlers.mouseLeave);
        this.canvas.addEventListener('click', this._boundHandlers.click);

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Get canvas coordinates from event
     * @private
     * @param {TouchEvent|MouseEvent} e - Event object
     * @returns {{x: number, y: number}}
     */
    _getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    /**
     * Calculate distance between two points
     * @private
     */
    _distance(p1, p2) {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    /**
     * Handle touch start
     * @private
     */
    _handleTouchStart(e) {
        if (!this.isEnabled) return;
        e.preventDefault();

        this.isTouchDevice = true;
        this.lastTouchTime = Date.now();

        const pos = this._getCanvasCoordinates(e);
        this.touchStartPosition = pos;
        this.isDragging = false;

        // Start long press timer
        this.longPressTimer = setTimeout(() => {
            if (this.touchStartPosition && !this.isDragging) {
                if (this.onLongPress) {
                    this.onLongPress(pos);
                }
            }
        }, this.options.longPressMs);
    }

    /**
     * Handle touch move
     * @private
     */
    _handleTouchMove(e) {
        if (!this.isEnabled || !this.touchStartPosition) return;
        e.preventDefault();

        const pos = this._getCanvasCoordinates(e);
        const distance = this._distance(this.touchStartPosition, pos);

        if (distance > this.options.dragThreshold && !this.isDragging) {
            this.isDragging = true;
            clearTimeout(this.longPressTimer);

            if (this.onDragStart) {
                this.onDragStart(this.touchStartPosition);
            }
        }

        if (this.isDragging && this.onDrag) {
            this.onDrag(pos, this.touchStartPosition);
        }
    }

    /**
     * Handle touch end
     * @private
     */
    _handleTouchEnd(e) {
        if (!this.isEnabled) return;
        e.preventDefault();

        clearTimeout(this.longPressTimer);

        const pos = this._getCanvasCoordinates(e);
        const now = Date.now();

        if (this.isDragging) {
            if (this.onDragEnd) {
                this.onDragEnd(pos, this.touchStartPosition);
            }
        } else {
            // Check for double tap
            if (
                this.lastTapPosition &&
                now - this.lastTapTime < this.options.doubleTapMs &&
                this._distance(pos, this.lastTapPosition) < 30
            ) {
                if (this.onDoubleTap) {
                    this.onDoubleTap(pos);
                }
                this.lastTapPosition = null;
            } else {
                // Single tap
                if (this.onTap) {
                    this.onTap(pos);
                }
                this.lastTapPosition = pos;
                this.lastTapTime = now;
            }
        }

        this.touchStartPosition = null;
        this.isDragging = false;
    }

    /**
     * Handle mouse down
     * @private
     */
    _handleMouseDown(e) {
        if (!this.isEnabled) return;

        // Ignore if recent touch
        if (Date.now() - this.lastTouchTime < this.options.touchDebounceMs) {
            return;
        }

        this.isTouchDevice = false;
        const pos = this._getCanvasCoordinates(e);
        this.touchStartPosition = pos;
        this.isDragging = false;

        // Long press for mouse
        this.longPressTimer = setTimeout(() => {
            if (this.touchStartPosition && !this.isDragging) {
                if (this.onLongPress) {
                    this.onLongPress(pos);
                }
            }
        }, this.options.longPressMs);
    }

    /**
     * Handle mouse move
     * @private
     */
    _handleMouseMove(e) {
        if (!this.isEnabled) return;

        const pos = this._getCanvasCoordinates(e);

        // Hover callback (always)
        if (this.onHover) {
            this.onHover(pos);
        }

        // Drag handling
        if (this.touchStartPosition) {
            const distance = this._distance(this.touchStartPosition, pos);

            if (distance > this.options.dragThreshold && !this.isDragging) {
                this.isDragging = true;
                clearTimeout(this.longPressTimer);

                if (this.onDragStart) {
                    this.onDragStart(this.touchStartPosition);
                }
            }

            if (this.isDragging && this.onDrag) {
                this.onDrag(pos, this.touchStartPosition);
            }
        }
    }

    /**
     * Handle mouse up
     * @private
     */
    _handleMouseUp(e) {
        if (!this.isEnabled) return;

        clearTimeout(this.longPressTimer);

        if (this.isDragging) {
            const pos = this._getCanvasCoordinates(e);
            if (this.onDragEnd) {
                this.onDragEnd(pos, this.touchStartPosition);
            }
        }

        this.touchStartPosition = null;
        this.isDragging = false;
    }

    /**
     * Handle mouse leave
     * @private
     */
    _handleMouseLeave(e) {
        clearTimeout(this.longPressTimer);
        this.touchStartPosition = null;
        this.isDragging = false;
    }

    /**
     * Handle click (fallback)
     * @private
     */
    _handleClick(e) {
        if (!this.isEnabled) return;

        // Ignore if handled by touch or dragging
        if (this.isTouchDevice || this.isDragging) return;
        if (Date.now() - this.lastTouchTime < this.options.touchDebounceMs) return;

        const pos = this._getCanvasCoordinates(e);
        if (this.onTap) {
            this.onTap(pos);
        }
    }

    /**
     * Lock selection (prevent Chrome extension interference)
     */
    lockSelection() {
        this.selectionLocked = true;
        this.canvas.style.userSelect = 'none';
        this.canvas.style.webkitUserSelect = 'none';
    }

    /**
     * Unlock selection
     */
    unlockSelection() {
        this.selectionLocked = false;
        this.canvas.style.userSelect = '';
        this.canvas.style.webkitUserSelect = '';
    }

    /**
     * Enable input handling
     */
    enable() {
        this.isEnabled = true;
    }

    /**
     * Disable input handling
     */
    disable() {
        this.isEnabled = false;
        clearTimeout(this.longPressTimer);
        this.touchStartPosition = null;
        this.isDragging = false;
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        this.canvas.removeEventListener('touchstart', this._boundHandlers.touchStart);
        this.canvas.removeEventListener('touchmove', this._boundHandlers.touchMove);
        this.canvas.removeEventListener('touchend', this._boundHandlers.touchEnd);
        this.canvas.removeEventListener('mousedown', this._boundHandlers.mouseDown);
        this.canvas.removeEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.removeEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.removeEventListener('mouseleave', this._boundHandlers.mouseLeave);
        this.canvas.removeEventListener('click', this._boundHandlers.click);

        clearTimeout(this.longPressTimer);
    }
}
