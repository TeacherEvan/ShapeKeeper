/**
 * ShapeKeeper - Input Handler
 * Mouse and touch input handling for the game
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { areAdjacent, getNearestDot } from './utils.js';

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

        this.setupEventListeners();
    }

    /**
     * Setup all input event listeners
     */
    setupEventListeners() {
        // Multi-touch event listeners
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), {
            passive: false,
        });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), {
            passive: false,
        });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), {
            passive: false,
        });
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), {
            passive: false,
        });

        // Keep mouse support
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    /**
     * Get nearest dot to click position
     */
    getNearestDot(x, y) {
        return getNearestDot(x, y, this.game.offsetX, this.game.offsetY, this.game.cellSize, this.game.gridRows, this.game.gridCols);
    }

    /**
     * Handle mouse click
     */
    handleClick(e) {
        // Prevent mouse events that follow touch events
        const now = Date.now();
        if (now - this.lastTouchTime < 500) {
            return; // Ignore mouse events shortly after touch
        }

        // Prevent rapid duplicate events
        if (now - this.lastInteractionTime < 50) {
            return; // Debounce rapid clicks
        }
        this.lastInteractionTime = now;

        // Ensure audio context on click
        this.game.soundManager.ensureAudioContext();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.processClick(x, y);
    }

    /**
     * Handle mouse move for hover effects
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dot = this.getNearestDot(x, y);
        const oldHoveredDot = this.hoveredDot;

        if (dot && this.game.selectedDot && areAdjacent(this.game.selectedDot, dot)) {
            this.canvas.style.cursor = 'pointer';
            // Track hovered dot for preview line
            const lineKey = this.game.getLineKey(this.game.selectedDot, dot);
            if (!this.game.lines.has(lineKey)) {
                this.hoveredDot = dot;
            } else {
                this.hoveredDot = null;
            }
        } else if (dot) {
            this.canvas.style.cursor = 'pointer';
            this.hoveredDot = null;
        } else {
            this.canvas.style.cursor = 'default';
            this.hoveredDot = null;
        }

        // Redraw if hover state changed
        if (
            oldHoveredDot?.row !== this.hoveredDot?.row ||
            oldHoveredDot?.col !== this.hoveredDot?.col
        ) {
            this.game.draw();
        }
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        e.preventDefault();

        // Mark that we're handling touch events
        this.lastTouchTime = Date.now();

        // Ensure audio context on touch
        this.game.soundManager.ensureAudioContext();

        // Debounce to prevent event conflicts with Chrome extensions
        const now = Date.now();
        if (now - this.lastInteractionTime < 50) {
            return;
        }
        this.lastInteractionTime = now;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Store touch info
            this.activeTouches.set(touch.identifier, { x, y, startTime: Date.now() });

            // Add touch visual
            this.game.animationSystem.addTouchVisual(x, y);
        }

        this.game.draw();
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Update touch position
            if (this.activeTouches.has(touch.identifier)) {
                this.activeTouches.set(touch.identifier, {
                    x,
                    y,
                    startTime: this.activeTouches.get(touch.identifier).startTime,
                });
            }

            // Update selection ribbon during drag
            this.updateSelectionRibbon(x, y);
        }
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        e.preventDefault();

        // Mark touch interaction
        this.lastTouchTime = Date.now();

        // Debounce to prevent duplicate events
        const now = Date.now();
        if (now - this.lastInteractionTime < 50) {
            return;
        }
        this.lastInteractionTime = now;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Check if tapping on a completed square or triangle-claimed cell
            const clickedCell = this.getSquareAtPosition(x, y);
            const clickedHasSquare = clickedCell && !!this.game.squares[clickedCell];
            const clickedHasTriangle = clickedCell && this.game.triangleCellOwners?.has(clickedCell);

            if (clickedCell && (clickedHasSquare || clickedHasTriangle)) {
                // In multiplayer mode, only the owning player can reveal/activate bonuses
                if (this.game.isMultiplayer) {
                    const isSquareOwner =
                        clickedHasSquare && this.game.squares[clickedCell] === this.game.myPlayerNumber;
                    const isTriangleOwner =
                        clickedHasTriangle &&
                        this.game.triangleCellOwners.get(clickedCell).has(this.game.myPlayerNumber);
                    if (!isSquareOwner && !isTriangleOwner) {
                        this.activeTouches.delete(touch.identifier);
                        continue;
                    }
                }

                // Check for tile effect first
                if (this.game.tileEffects[clickedCell] && !this.game.revealedEffects.has(clickedCell)) {
                    this.game.revealTileEffect(clickedCell);
                    this.activeTouches.delete(touch.identifier);
                    continue;
                }

                // Fall back to multiplier reveal
                if (!this.game.revealedMultipliers.has(clickedCell)) {
                    if (clickedHasSquare) {
                        this.game.revealMultiplier(clickedCell);
                    } else {
                        this.game.revealMultiplierForCell(clickedCell);
                    }
                    this.activeTouches.delete(touch.identifier);
                    continue;
                }
            }

            // Get the dot at the touch end position
            const endDot = this.getNearestDot(x, y);

            if (endDot) {
                const distance = Math.sqrt(
                    Math.pow(x - (this.game.offsetX + endDot.col * this.game.cellSize), 2) +
                        Math.pow(y - (this.game.offsetY + endDot.row * this.game.cellSize), 2)
                );

                // Only process if touch ended near a dot
                if (distance <= this.game.cellSize * 0.5) {
                    // Check for two-tap interaction to draw a line
                    if (
                        this.game.selectedDot &&
                        (this.game.selectedDot.row !== endDot.row || this.game.selectedDot.col !== endDot.col)
                    ) {
                        // Different dot selected - check if adjacent
                        if (areAdjacent(this.game.selectedDot, endDot)) {
                            this.game.drawLine(this.game.selectedDot, endDot);
                            // Selection cleared and unlocked in drawLine()
                        } else {
                            // Non-adjacent dot tapped - trigger invalid line flash
                            this.game.animationSystem.triggerInvalidLineFlash(
                                this.game.selectedDot,
                                endDot,
                                this.game.offsetX,
                                this.game.offsetY,
                                this.game.cellSize
                            );
                            // Select the new dot
                            this.game.selectedDot = endDot;
                            this.touchStartDot = endDot;
                            this.selectionLocked = true;
                        }
                    } else if (!this.game.selectedDot) {
                        // No dot selected - select this one
                        this.game.selectedDot = endDot;
                        this.touchStartDot = endDot;
                        this.selectionLocked = true;
                    } else {
                        // Same dot tapped - deselect
                        this.game.selectedDot = null;
                        this.touchStartDot = null;
                        this.selectionLocked = false;
                    }
                }
            }

            this.activeTouches.delete(touch.identifier);
        }

        // Clear selection ribbon on touch end
        this.selectionRibbon = null;

        // Redraw to show selection changes
        if (this.activeTouches.size === 0) {
            this.game.draw();
        }
    }

    /**
     * Process click at position (shared between mouse and touch)
     */
    processClick(x, y) {
        // Check if clicking on a completed square or triangle-claimed cell
        const clickedCell = this.getSquareAtPosition(x, y);
        const clickedHasSquare = clickedCell && !!this.game.squares[clickedCell];
        const clickedHasTriangle = clickedCell && this.game.triangleCellOwners?.has(clickedCell);

        if (clickedCell && (clickedHasSquare || clickedHasTriangle)) {
            // In multiplayer mode, only the owning player can reveal/activate bonuses
            if (this.game.isMultiplayer) {
                const isSquareOwner =
                    clickedHasSquare && this.game.squares[clickedCell] === this.game.myPlayerNumber;
                const isTriangleOwner =
                    clickedHasTriangle &&
                    this.game.triangleCellOwners.get(clickedCell).has(this.game.myPlayerNumber);
                if (!isSquareOwner && !isTriangleOwner) {
                    return;
                }
            }

            // Check for tile effect first
            if (this.game.tileEffects[clickedCell] && !this.game.revealedEffects.has(clickedCell)) {
                this.game.revealTileEffect(clickedCell);
                return;
            }

            // Fall back to multiplier reveal
            if (!this.game.revealedMultipliers.has(clickedCell)) {
                if (clickedHasSquare) {
                    this.game.revealMultiplier(clickedCell);
                } else {
                    // For triangles, check if there's a multiplier or effect
                    if (this.game.squareMultipliers[clickedCell]) {
                        this.game.revealMultiplierForCell(clickedCell);
                    } else {
                        // No multiplier, show shape message!
                        this.game.showShapeMessage(clickedCell);
                    }
                }
                return;
            } else if (
                clickedHasTriangle &&
                !this.game.squareMultipliers[clickedCell] &&
                !this.game.tileEffects[clickedCell]
            ) {
                // Already revealed (or nothing to reveal), show message again
                this.game.showShapeMessage(clickedCell);
                return;
            }
        }

        const dot = this.getNearestDot(x, y);
        if (!dot) {
            // Only deselect if clicking far from any dot
            if (!this.selectionLocked) {
                this.game.selectedDot = null;
                this.game.draw();
            }
            return;
        }

        if (!this.game.selectedDot) {
            // Select first dot
            this.game.selectedDot = dot;
            this.selectionLocked = true; // Lock selection until action is taken
            this.game.draw();
        } else if (this.game.selectedDot.row === dot.row && this.game.selectedDot.col === dot.col) {
            // Clicked same dot - deselect
            this.game.selectedDot = null;
            this.selectionLocked = false;
            this.game.draw();
        } else {
            if (areAdjacent(this.game.selectedDot, dot)) {
                this.game.drawLine(this.game.selectedDot, dot);
                this.selectionLocked = false; // Unlock after action
            } else {
                // Clicked non-adjacent dot - trigger invalid line flash
                this.game.animationSystem.triggerInvalidLineFlash(
                    this.game.selectedDot,
                    dot,
                    this.game.offsetX,
                    this.game.offsetY,
                    this.game.cellSize
                );
                // Select the new dot
                this.game.selectedDot = dot;
                this.selectionLocked = true;
            }

            this.game.draw();
        }
    }

    /**
     * Get square at position
     */
    getSquareAtPosition(x, y) {
        // Convert screen coordinates to grid coordinates
        const col = Math.floor((x - this.game.offsetX) / this.game.cellSize);
        const row = Math.floor((y - this.game.offsetY) / this.game.cellSize);

        if (row >= 0 && row < this.game.gridRows - 1 && col >= 0 && col < this.game.gridCols - 1) {
            return `${row},${col}`;
        }
        return null;
    }

    /**
     * Update selection ribbon position
     */
    updateSelectionRibbon(x, y) {
        if (!this.game.selectedDot) {
            this.selectionRibbon = null;
            return;
        }

        const dot = this.getNearestDot(x, y);
        if (dot && areAdjacent(this.game.selectedDot, dot)) {
            const lineKey = this.game.getLineKey(this.game.selectedDot, dot);
            if (!this.game.lines.has(lineKey)) {
                this.selectionRibbon = {
                    targetX: this.game.offsetX + dot.col * this.game.cellSize,
                    targetY: this.game.offsetY + dot.row * this.game.cellSize,
                };
                return;
            }
        }

        // If not near a valid dot, show ribbon to cursor position
        this.selectionRibbon = { targetX: x, targetY: y };
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
}