import { areAdjacent } from '../utils.js';

function getClientCoordinates(handler, event) {
    const rect = handler.canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
}

function clearPreview(handler) {
    handler.hoveredDot = null;
    handler.selectionRibbon = null;
    handler.syncPreviewState();
}

function releasePointerCapture(handler, pointerId) {
    if (handler.canvas?.releasePointerCapture && handler.canvas.hasPointerCapture?.(pointerId)) {
        try {
            handler.canvas.releasePointerCapture(pointerId);
        } catch {
            // The browser can release capture before pointerup/pointercancel is delivered.
        }
    }
}

function getSelectionDistance(handler, x, y, dot) {
    return Math.hypot(
        x - (handler.game.offsetX + dot.col * handler.game.cellSize),
        y - (handler.game.offsetY + dot.row * handler.game.cellSize)
    );
}

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

function handleCellInteraction(handler, clickedCell) {
    const clickedHasSquare = clickedCell && !!handler.game.squares[clickedCell];

    if (!clickedCell || !clickedHasSquare) {
        return false;
    }

    if (handler.game.isMultiplayer) {
        const isSquareOwner = handler.game.squares[clickedCell] === handler.game.myPlayerNumber;
        if (!isSquareOwner) {
            return true;
        }
    }

    if (handler.game.tileEffects[clickedCell] && !handler.game.revealedEffects.has(clickedCell)) {
        handler.game.revealTileEffect(clickedCell);
        return true;
    }

    if (!handler.game.revealedMultipliers.has(clickedCell)) {
        handler.game.revealMultiplier(clickedCell);
        return true;
    }

    return false;
}

function selectDot(handler, dot) {
    if (
        handler.game.tutorialSystem?.isActive?.() &&
        !handler.game.tutorialSystem.canSelectDot(dot)
    ) {
        return false;
    }

    handler.game.selectedDot = dot;
    handler.touchStartDot = dot;
    handler.game.touchStartDot = dot;
    handler.selectionLocked = true;
    handler.game.tutorialSystem?.onDotSelected?.(dot);
    handler.setKeyboardFocusDot(dot, { announce: false });
    return true;
}

function tryDrawFromSelection(handler, dot, { sameDotClears = true } = {}) {
    if (!handler.game.selectedDot || !dot) {
        return false;
    }

    const startDot = handler.game.selectedDot;
    if (startDot.row === dot.row && startDot.col === dot.col) {
        if (!sameDotClears) {
            return true;
        }
        handler.game.selectedDot = null;
        handler.touchStartDot = null;
        handler.game.touchStartDot = null;
        handler.selectionLocked = false;
        clearPreview(handler);
        return true;
    }

    if (areAdjacent(startDot, dot)) {
        const lineKey = handler.game.getLineKey(startDot, dot);
        if (!handler.game.lines.has(lineKey)) {
            handler.game.drawLine(startDot, dot);
            handler.selectionLocked = false;
        } else {
            handler.selectionLocked = true;
        }
        return true;
    }

    handler.game.animationSystem.triggerInvalidLineFlash(
        startDot,
        dot,
        handler.game.offsetX,
        handler.game.offsetY,
        handler.game.cellSize
    );
    handler.game.selectedDot = dot;
    handler.touchStartDot = dot;
    handler.game.touchStartDot = dot;
    handler.selectionLocked = true;
    return true;
}

export function handleClick(handler, event) {
    // Pointerup handles primary pointer interaction. The click event is retained only
    // as a keyboard/legacy activation fallback and is ignored when it follows a pointer.
    const now = Date.now();
    if (now < (handler.suppressNextClickUntil || 0)) {
        handler.suppressNextClickUntil = 0;
        return;
    }
    if (
        now - handler.lastTouchTime < 500 ||
        now - handler.lastInteractionTime < (handler.game.pointerInteractionThrottleMs || 50)
    ) {
        return;
    }

    handler.lastInteractionTime = now;
    handler.suppressNextClickUntil = now + 500;
    handler.game.soundManager.ensureAudioContext();

    const { x, y } = getClientCoordinates(handler, event);
    processClick(handler, x, y);
}

export function handleMouseMove(handler, event) {
    const { x, y } = getClientCoordinates(handler, event);
    const dot = handler.getNearestDot(x, y);
    const oldHoveredDot = handler.hoveredDot;

    if (dot && handler.game.selectedDot && areAdjacent(handler.game.selectedDot, dot)) {
        handler.canvas.style.cursor = 'pointer';
        const lineKey = handler.game.getLineKey(handler.game.selectedDot, dot);
        handler.hoveredDot = handler.game.lines.has(lineKey) ? null : dot;
    } else if (dot) {
        handler.canvas.style.cursor = 'pointer';
        handler.hoveredDot = null;
    } else {
        handler.canvas.style.cursor = 'default';
        handler.hoveredDot = null;
    }

    if (
        oldHoveredDot?.row !== handler.hoveredDot?.row ||
        oldHoveredDot?.col !== handler.hoveredDot?.col
    ) {
        handler.syncPreviewState();
        handler.game.draw();
    }
}

export function handlePointerDown(handler, event) {
    if (event.button !== undefined && event.button !== 0) {
        return;
    }

    event.preventDefault();
    const now = Date.now();
    handler.lastTouchTime = event.pointerType === 'touch' ? now : handler.lastTouchTime;
    handler.lastInteractionTime = now;
    handler.game.soundManager.ensureAudioContext();

    const { x, y } = getClientCoordinates(handler, event);
    const startedWithSelection = Boolean(handler.game.selectedDot);
    handler.activePointers.set(event.pointerId, {
        x,
        y,
        startX: x,
        startY: y,
        startTime: now,
        pointerType: event.pointerType || 'mouse',
        startedWithSelection,
    });

    // A pointerdown on a dot immediately establishes the start of a line gesture.
    // This fixes the mobile swipe regression where the old touch code waited for touchend.
    const dot = handler.getNearestDot(x, y);
    if (dot && !handler.game.selectedDot) {
        selectDot(handler, dot);
    }

    // Capture whenever a pointer starts on a board dot. If a dot is already selected,
    // keep that selection until pointerup so a second tap or swipe can complete the line.
    if (dot && handler.canvas.setPointerCapture) {
        try {
            handler.canvas.setPointerCapture(event.pointerId);
        } catch {
            // Pointer capture is an enhancement; selection still works without it.
        }
    }

    handler.game.animationSystem.addTouchVisual?.(x, y);
    handler.game.draw();
}

export function handlePointerMove(handler, event) {
    if (!handler.activePointers.has(event.pointerId)) {
        // Pointer Events also replace mousemove for hover feedback on mouse/pen devices.
        if (event.pointerType !== 'touch') {
            handleMouseMove(handler, event);
        }
        return;
    }

    const now = Date.now();
    const throttleMs =
        event.pointerType === 'touch'
            ? handler.game.touchMoveThrottleMs || 24
            : handler.game.pointerMoveThrottleMs || 16;
    if (now - handler.lastPointerMoveTime < throttleMs) {
        return;
    }
    handler.lastPointerMoveTime = now;

    const { x, y } = getClientCoordinates(handler, event);
    const pointer = handler.activePointers.get(event.pointerId);
    pointer.x = x;
    pointer.y = y;

    updateSelectionRibbon(handler, x, y);
}

export function handlePointerUp(handler, event) {
    if (!handler.activePointers.has(event.pointerId)) {
        return;
    }

    event.preventDefault();
    const now = Date.now();
    if (event.pointerType === 'touch') {
        handler.lastTouchTime = now;
    }

    const { x, y } = getClientCoordinates(handler, event);
    const pointer = handler.activePointers.get(event.pointerId);
    const clickedCell = getSquareAtPosition(handler, x, y);
    if (handleCellInteraction(handler, clickedCell)) {
        handler.activePointers.delete(event.pointerId);
        releasePointerCapture(handler, event.pointerId);
        handler.selectionRibbon = null;
        handler.syncPreviewState();
        handler.game.draw();
        return;
    }

    const endDot = handler.getNearestDot(x, y);
    const selectionRadius =
        handler.game.cellSize *
        (handler.game.selectionRadiusMultiplier || (event.pointerType === 'touch' ? 0.68 : 0.5));

    if (endDot && getSelectionDistance(handler, x, y, endDot) <= selectionRadius) {
        tryDrawFromSelection(handler, endDot, {
            sameDotClears: pointer?.startedWithSelection === true,
        });
    } else if (handler.game.selectedDot) {
        // Preserve the selected start dot on an imprecise release rather than
        // interpreting the gesture as a second, unrelated selection.
        handler.selectionLocked = true;
    }

    handler.activePointers.delete(event.pointerId);
    releasePointerCapture(handler, event.pointerId);
    handler.selectionRibbon = null;
    handler.syncPreviewState();

    if (handler.activePointers.size === 0) {
        handler.lastInteractionTime = now;
        handler.game.draw();
    }
}

export function handlePointerCancel(handler, event) {
    const pointer = handler.activePointers.get(event.pointerId);
    if (!pointer) {
        return;
    }

    handler.activePointers.delete(event.pointerId);
    releasePointerCapture(handler, event.pointerId);
    handler.selectionRibbon = null;
    handler.syncPreviewState();

    if (handler.activePointers.size === 0) {
        handler.game.draw();
    }
}

// Backwards-compatible aliases for integrations that still call touch handlers.
export const handleTouchStart = handlePointerDown;
export const handleTouchMove = handlePointerMove;
export const handleTouchEnd = handlePointerUp;

export function processClick(handler, x, y) {
    const clickedCell = getSquareAtPosition(handler, x, y);
    if (handleCellInteraction(handler, clickedCell)) {
        return;
    }

    const dot = handler.getNearestDot(x, y);
    if (!dot) {
        if (!handler.selectionLocked) {
            handler.game.selectedDot = null;
            handler.game.draw();
        }
        return;
    }

    if (!handler.game.selectedDot) {
        if (!selectDot(handler, dot)) {
            return;
        }
        handler.game.draw();
        return;
    }

    tryDrawFromSelection(handler, dot);
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
