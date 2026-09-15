import { areAdjacent } from '../utils.js';

export function getSquareAtPosition(handler, x, y) {
    const col = Math.floor((x - handler.game.offsetX) / handler.game.cellSize);
    const row = Math.floor((y - handler.game.offsetY) / handler.game.cellSize);

    if (
        row >= 0 &&
        row < handler.game.gridRows - 1 &&
        col >= 0 &&
        col < handler.game.gridCols - 1
    ) {
        return `${row},${col}`;
    }

    return null;
}

function getPointerCoordinates(handler, event, stored) {
    const rect = handler.canvas.getBoundingClientRect();
    const x = (stored ? stored.x : event.clientX) - rect.left;
    const y = (stored ? stored.y : event.clientY) - rect.top;
    return { x, y };
}

function selectOrDrawAt(handler, x, y) {
    const dot = handler.getNearestDot(x, y);
    if (!dot) {
        if (!handler.selectionLocked) {
            handler.game.selectedDot = null;
            handler.game.draw();
        }
        return;
    }

    if (!handler.game.selectedDot) {
        if (
            handler.game.tutorialSystem?.isActive?.() &&
            !handler.game.tutorialSystem.canSelectDot(dot)
        ) {
            return;
        }
        handler.game.selectedDot = dot;
        handler.game.tutorialSystem?.onDotSelected?.(dot);
        handler.selectionLocked = true;
        handler.setKeyboardFocusDot(dot, { announce: false });
        handler.game.draw();
        return;
    }

    if (handler.game.selectedDot.row === dot.row && handler.game.selectedDot.col === dot.col) {
        handler.game.selectedDot = null;
        handler.selectionLocked = false;
        handler.game.draw();
        return;
    }

    if (areAdjacent(handler.game.selectedDot, dot)) {
        handler.game.drawLine(handler.game.selectedDot, dot);
        handler.selectionLocked = false;
    } else {
        handler.game.animationSystem.triggerInvalidLineFlash(
            handler.game.selectedDot,
            dot,
            handler.game.offsetX,
            handler.game.offsetY,
            handler.game.cellSize
        );
        handler.game.selectedDot = dot;
        handler.selectionLocked = true;
    }

    handler.setKeyboardFocusDot(dot, { announce: false });
    handler.game.draw();
}

export function handlePointerDown(handler, event) {
    event.preventDefault?.();
    const now = Date.now();
    if (now - handler.lastInteractionTime < (handler.game.pointerInteractionThrottleMs || 50)) {
        return;
    }
    handler.lastInteractionTime = now;
    handler.game.soundManager.ensureAudioContext?.();

    const pointerId = event.pointerId;
    const { x, y } = getPointerCoordinates(handler, event, null);
    handler.activePointers.set(pointerId, { x, y });

    try {
        handler.canvas.setPointerCapture?.(pointerId);
    } catch {
        // Browser may deny capture; pointer events still fire normally.
    }

    selectOrDrawAt(handler, x, y);
}

export function handlePointerMove(handler, event) {
    const now = Date.now();
    if (now - handler.lastPointerMoveTime < (handler.game.pointerMoveThrottleMs || 16)) {
        return;
    }
    handler.lastPointerMoveTime = now;

    const stored = handler.activePointers.get(event.pointerId);
    const { x, y } = getPointerCoordinates(handler, event, stored);
    if (stored) {
        stored.x = x;
        stored.y = y;
    }

    const dot = handler.getNearestDot(x, y);
    if (dot && handler.game.selectedDot && areAdjacent(handler.game.selectedDot, dot)) {
        handler.canvas.style.cursor = 'pointer';
    } else {
        handler.canvas.style.cursor = '';
    }
    handler.hoveredDot = dot;
    handler.syncPreviewState();
    handler.game.draw();
}

export function handlePointerUp(handler, event) {
    event.preventDefault?.();
    const pointerId = event.pointerId;
    handler.activePointers.delete(pointerId);

    try {
        if (
            handler.canvas?.releasePointerCapture &&
            handler.canvas.hasPointerCapture?.(pointerId)
        ) {
            handler.canvas.releasePointerCapture(pointerId);
        }
    } catch {
        // Pointer may already be released.
    }

    // Use the event's own coordinates for the release point, not the stored
    // down position: a drag from dot A to dot B must resolve at B.
    const rect = handler.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dot = handler.getNearestDot(x, y);

    // A tap (down and up on the same dot) keeps the selection; a drag to an
    // adjacent dot draws a line. This is the tap-to-select / drag-to-draw
    // contract exercised by the InputHandler test suite.
    if (!dot) {
        return;
    }

    if (!handler.game.selectedDot) {
        if (
            handler.game.tutorialSystem?.isActive?.() &&
            !handler.game.tutorialSystem.canSelectDot(dot)
        ) {
            return;
        }
        handler.game.selectedDot = dot;
        handler.game.tutorialSystem?.onDotSelected?.(dot);
        handler.selectionLocked = true;
        handler.setKeyboardFocusDot(dot, { announce: false });
        handler.game.draw();
        return;
    }

    if (handler.game.selectedDot.row === dot.row && handler.game.selectedDot.col === dot.col) {
        return;
    }

    if (areAdjacent(handler.game.selectedDot, dot)) {
        handler.game.drawLine(handler.game.selectedDot, dot);
        handler.selectionLocked = false;
    } else {
        handler.game.animationSystem.triggerInvalidLineFlash(
            handler.game.selectedDot,
            dot,
            handler.game.offsetX,
            handler.game.offsetY,
            handler.game.cellSize
        );
        handler.game.selectedDot = dot;
        handler.selectionLocked = true;
    }

    handler.setKeyboardFocusDot(dot, { announce: false });
    handler.game.draw();
}

export function handlePointerCancel(handler, event) {
    const pointerId = event.pointerId;
    handler.activePointers.delete(pointerId);
    try {
        if (
            handler.canvas?.releasePointerCapture &&
            handler.canvas.hasPointerCapture?.(pointerId)
        ) {
            handler.canvas.releasePointerCapture(pointerId);
        }
    } catch {
        // Pointer may already be released.
    }
    // Preserve the currently selected start dot; only clear transient tracking.
    handler.selectionRibbon = null;
    handler.syncPreviewState();
    handler.game.draw();
}
