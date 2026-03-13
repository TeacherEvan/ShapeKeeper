import { announceStatus } from '../src/ui/AccessibilityAnnouncer.js';
import { areAdjacent } from '../utils.js';

function clearSelectionPreview(handler) {
    handler.hoveredDot = null;
    handler.selectionRibbon = null;
    handler.syncPreviewState();
}

export function setKeyboardFocusDot(handler, dot, { announce = true } = {}) {
    if (!dot) {
        return;
    }

    const nextDot = {
        row: Math.max(0, Math.min(handler.game.gridRows - 1, dot.row)),
        col: Math.max(0, Math.min(handler.game.gridCols - 1, dot.col)),
    };

    const currentDot = handler.game.keyboardFocusDot;
    const changed = currentDot?.row !== nextDot.row || currentDot?.col !== nextDot.col;

    handler.game.keyboardFocusDot = nextDot;

    if (
        handler.game.selectedDot &&
        (handler.game.selectedDot.row !== nextDot.row ||
            handler.game.selectedDot.col !== nextDot.col) &&
        areAdjacent(handler.game.selectedDot, nextDot)
    ) {
        const lineKey = handler.game.getLineKey(handler.game.selectedDot, nextDot);
        handler.hoveredDot = handler.game.lines.has(lineKey) ? null : nextDot;
        handler.selectionRibbon = null;
    } else {
        clearSelectionPreview(handler);
    }

    handler.syncPreviewState();

    if (changed && announce) {
        announceStatus(`Board focus row ${nextDot.row + 1}, column ${nextDot.col + 1}.`);
    }
}

export function handleCanvasFocus(handler) {
    setKeyboardFocusDot(
        handler,
        handler.game.keyboardFocusDot || handler.game.selectedDot || { row: 0, col: 0 },
        { announce: false }
    );
    handler.game.draw();
    announceStatus(
        'Game board focused. Use arrow keys to move between dots, Enter or Space to select, and Escape to clear selection.'
    );
}

export function handleCanvasBlur(handler) {
    handler.hoveredDot = null;
    handler.selectionRibbon = null;
    handler.game.keyboardFocusDot = null;
    handler.syncPreviewState();
    handler.game.draw();
}

export function moveKeyboardFocus(handler, rowDelta, colDelta) {
    const currentDot = handler.game.keyboardFocusDot ||
        handler.game.selectedDot || { row: 0, col: 0 };
    setKeyboardFocusDot(handler, {
        row: currentDot.row + rowDelta,
        col: currentDot.col + colDelta,
    });
    handler.game.draw();
}

export function handleKeyboardSelection(handler) {
    const focusedDot = handler.game.keyboardFocusDot ||
        handler.game.selectedDot || { row: 0, col: 0 };
    setKeyboardFocusDot(handler, focusedDot, { announce: false });

    if (!handler.game.selectedDot) {
        handler.game.selectedDot = focusedDot;
        handler.selectionLocked = true;
        handler.syncPreviewState();
        handler.game.draw();
        announceStatus(`Selected dot row ${focusedDot.row + 1}, column ${focusedDot.col + 1}.`);
        return;
    }

    if (
        handler.game.selectedDot.row === focusedDot.row &&
        handler.game.selectedDot.col === focusedDot.col
    ) {
        handler.game.selectedDot = null;
        handler.selectionLocked = false;
        clearSelectionPreview(handler);
        handler.game.draw();
        announceStatus('Selection cleared.');
        return;
    }

    if (areAdjacent(handler.game.selectedDot, focusedDot)) {
        const lineKey = handler.game.getLineKey(handler.game.selectedDot, focusedDot);
        if (handler.game.lines.has(lineKey)) {
            announceStatus('That line has already been drawn. Choose a different adjacent dot.');
            return;
        }

        announceStatus(
            `Drawing line from row ${handler.game.selectedDot.row + 1}, column ${handler.game.selectedDot.col + 1} to row ${focusedDot.row + 1}, column ${focusedDot.col + 1}.`
        );
        handler.game.drawLine(handler.game.selectedDot, focusedDot);
        clearSelectionPreview(handler);
        handler.game.draw();
        return;
    }

    handler.game.animationSystem.triggerInvalidLineFlash(
        handler.game.selectedDot,
        focusedDot,
        handler.game.offsetX,
        handler.game.offsetY,
        handler.game.cellSize
    );
    handler.game.selectedDot = focusedDot;
    handler.selectionLocked = true;
    clearSelectionPreview(handler);
    handler.game.draw();
    announceStatus('Move to an adjacent dot before drawing a line.');
}

export function handleKeyDown(handler, event) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
    }

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            moveKeyboardFocus(handler, -1, 0);
            break;
        case 'ArrowDown':
            event.preventDefault();
            moveKeyboardFocus(handler, 1, 0);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            moveKeyboardFocus(handler, 0, -1);
            break;
        case 'ArrowRight':
            event.preventDefault();
            moveKeyboardFocus(handler, 0, 1);
            break;
        case 'Enter':
        case ' ':
            event.preventDefault();
            handler.game.soundManager.ensureAudioContext();
            handleKeyboardSelection(handler);
            break;
        case 'Escape':
            if (handler.game.selectedDot) {
                event.preventDefault();
                handler.game.selectedDot = null;
                handler.selectionLocked = false;
                clearSelectionPreview(handler);
                handler.game.draw();
                announceStatus('Selection cleared.');
            }
            break;
        default:
            break;
    }
}
