import { areAdjacent } from '../utils.js';

function getTouchCoordinates(handler, touch) {
    const rect = handler.canvas.getBoundingClientRect();
    return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
    };
}

function clearPreview(handler) {
    handler.hoveredDot = null;
    handler.selectionRibbon = null;
    handler.syncPreviewState();
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
        const isSquareOwner =
            clickedHasSquare && handler.game.squares[clickedCell] === handler.game.myPlayerNumber;
        if (!isSquareOwner) {
            // Opponent-tap mechanic: an opponent clicking a completed square
            // reduces its effective multiplier to 0.5x (capped). The server
            // validates and broadcasts the change via the Convex subscription.
            // See `docs/feature-opponent-tap.md` and `convex/games/state.ts`.
            handler.game.tapSquare(clickedCell);
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

export function handleClick(handler, event) {
    const now = Date.now();
    if (
        now - handler.lastTouchTime < 500 ||
        now - handler.lastInteractionTime < (handler.game.pointerInteractionThrottleMs || 50)
    ) {
        return;
    }

    handler.lastInteractionTime = now;
    handler.game.soundManager.ensureAudioContext();

    const rect = handler.canvas.getBoundingClientRect();
    processClick(handler, event.clientX - rect.left, event.clientY - rect.top);
}

export function handleMouseMove(handler, event) {
    const rect = handler.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
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

export function handleTouchStart(handler, event) {
    event.preventDefault();
    handler.lastTouchTime = Date.now();
    handler.game.soundManager.ensureAudioContext();

    const now = Date.now();
    if (now - handler.lastInteractionTime < (handler.game.touchInteractionThrottleMs || 50)) {
        return;
    }
    handler.lastInteractionTime = now;

    for (const touch of event.changedTouches) {
        const { x, y } = getTouchCoordinates(handler, touch);
        handler.activeTouches.set(touch.identifier, { x, y, startTime: Date.now() });
        handler.game.animationSystem.addTouchVisual(x, y);
    }

    handler.game.draw();
}

export function handleTouchMove(handler, event) {
    event.preventDefault();
    const now = Date.now();
    if (now - handler.lastTouchMoveTime < (handler.game.touchMoveThrottleMs || 16)) {
        return;
    }
    handler.lastTouchMoveTime = now;

    for (const touch of event.changedTouches) {
        const { x, y } = getTouchCoordinates(handler, touch);
        if (handler.activeTouches.has(touch.identifier)) {
            handler.activeTouches.set(touch.identifier, {
                x,
                y,
                startTime: handler.activeTouches.get(touch.identifier).startTime,
            });
        }
        updateSelectionRibbon(handler, x, y);
    }
}

export function handleTouchEnd(handler, event) {
    event.preventDefault();
    handler.lastTouchTime = Date.now();

    for (const touch of event.changedTouches) {
        const { x, y } = getTouchCoordinates(handler, touch);
        const clickedCell = getSquareAtPosition(handler, x, y);
        const clickedHasSquare = clickedCell && !!handler.game.squares[clickedCell];

        if (clickedCell && clickedHasSquare) {
            if (handler.game.isMultiplayer) {
                const isSquareOwner =
                    clickedHasSquare &&
                    handler.game.squares[clickedCell] === handler.game.myPlayerNumber;
                if (!isSquareOwner) {
                    // Opponent tap — same as the mouse path. See
                    // handleCellInteraction above for the full description.
                    handler.game.tapSquare(clickedCell);
                    handler.activeTouches.delete(touch.identifier);
                    continue;
                }
            }

            if (
                handler.game.tileEffects[clickedCell] &&
                !handler.game.revealedEffects.has(clickedCell)
            ) {
                handler.game.revealTileEffect(clickedCell);
                handler.activeTouches.delete(touch.identifier);
                continue;
            }

            if (!handler.game.revealedMultipliers.has(clickedCell)) {
                handler.game.revealMultiplier(clickedCell);
                handler.activeTouches.delete(touch.identifier);
                continue;
            }
        }

        const endDot = handler.getNearestDot(x, y);
        if (endDot) {
            const distance = Math.sqrt(
                Math.pow(x - (handler.game.offsetX + endDot.col * handler.game.cellSize), 2) +
                    Math.pow(y - (handler.game.offsetY + endDot.row * handler.game.cellSize), 2)
            );

            if (
                distance <=
                handler.game.cellSize * (handler.game.selectionRadiusMultiplier || 0.5)
            ) {
                if (
                    handler.game.selectedDot &&
                    (handler.game.selectedDot.row !== endDot.row ||
                        handler.game.selectedDot.col !== endDot.col)
                ) {
                    if (areAdjacent(handler.game.selectedDot, endDot)) {
                        handler.game.drawLine(handler.game.selectedDot, endDot);
                    } else {
                        handler.game.animationSystem.triggerInvalidLineFlash(
                            handler.game.selectedDot,
                            endDot,
                            handler.game.offsetX,
                            handler.game.offsetY,
                            handler.game.cellSize
                        );
                        handler.game.selectedDot = endDot;
                        handler.touchStartDot = endDot;
                        handler.selectionLocked = true;
                    }
                } else if (!handler.game.selectedDot) {
                    if (
                        handler.game.tutorialSystem?.isActive?.() &&
                        !handler.game.tutorialSystem.canSelectDot(endDot)
                    ) {
                        handler.activeTouches.delete(touch.identifier);
                        continue;
                    }
                    handler.game.selectedDot = endDot;
                    handler.game.tutorialSystem?.onDotSelected?.(endDot);
                    handler.touchStartDot = endDot;
                    handler.selectionLocked = true;
                } else {
                    handler.game.selectedDot = null;
                    handler.touchStartDot = null;
                    handler.selectionLocked = false;
                }
            }
        }

        handler.activeTouches.delete(touch.identifier);
    }

    handler.selectionRibbon = null;
    handler.syncPreviewState();

    if (handler.activeTouches.size === 0) {
        handler.lastInteractionTime = Date.now();
        handler.game.draw();
    }
}

export function processClick(handler, x, y) {
    const clickedCell = getSquareAtPosition(handler, x, y);
    if (handleCellInteraction(handler, clickedCell)) {
        return;
    }

    const dot = handler.getNearestDot(x, y);
    if (!dot) {
        if (!handler.selectionLocked) {
            handler.game.selectedDot = null;
            clearPreview(handler);
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
        clearPreview(handler);
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

export function updateSelectionRibbon(handler, x, y) {
    if (!handler.game.selectedDot) {
        handler.selectionRibbon = null;
        handler.syncPreviewState();
        return;
    }

    const dot = handler.getNearestDot(x, y);
    if (dot && areAdjacent(handler.game.selectedDot, dot)) {
        const lineKey = handler.game.getLineKey(handler.game.selectedDot, dot);
        if (!handler.game.lines.has(lineKey)) {
            handler.selectionRibbon = {
                targetX: handler.game.offsetX + dot.col * handler.game.cellSize,
                targetY: handler.game.offsetY + dot.row * handler.game.cellSize,
            };
            handler.syncPreviewState();
            return;
        }
    }

    handler.selectionRibbon = { targetX: x, targetY: y };
    handler.syncPreviewState();
}
