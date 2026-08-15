/**
 * Screen transition utilities for ShapeKeeper
 * @module ui/ScreenTransition
 */

let selectedGridSize = null;
let fullscreenTriggered = false;

/**
 * Show a specific screen by ID
 * @param {string} screenId - The ID of the screen to show
 */
export function showScreen(screenId) {
    const newScreen = document.getElementById(screenId);

    // Focus is handled in two beats around the visibility flip. The browser raises a
    // synchronous "aria-hidden on focused element" warning the moment a focused
    // control's ancestor gains `aria-hidden="true"`, so any control inside the
    // outgoing screen must be blurred BEFORE the flip. The incoming screen is still
    // `hidden`/`inert` at that point, and focusing a hidden element is a no-op that
    // silently drops focus to <body>, so the incoming target is focused AFTER the
    // flip instead.
    const activeEl = document.activeElement;
    const leavingFocused =
        activeEl &&
        activeEl !== newScreen &&
        activeEl.closest('.screen') &&
        activeEl.closest('.screen').id !== screenId;

    if (leavingFocused) {
        activeEl.blur();
    }

    document.querySelectorAll('.screen').forEach((screen) => {
        const isActive = screen.id === screenId;
        screen.classList.toggle('active', isActive);
        screen.hidden = !isActive;
        screen.setAttribute('aria-hidden', String(!isActive));
        screen.inert = !isActive;
    });

    if (leavingFocused && newScreen) {
        const focusTarget =
            newScreen.querySelector(
                'button:not([hidden]):not([disabled]), [href], input:not([hidden]):not([disabled]), select:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])'
            ) || newScreen;
        focusTarget.focus({ preventScroll: true });
    }
}

/**
 * Get the currently selected grid size
 * @returns {number|null} Selected grid size
 */
export function getSelectedGridSize() {
    return selectedGridSize;
}

/**
 * Set the selected grid size
 * @param {number} size - Grid size to select
 */
export function setSelectedGridSize(size) {
    selectedGridSize = size;
}

/**
 * Check if fullscreen has been triggered
 * @returns {boolean} Whether fullscreen has been triggered
 */
export function isFullscreenTriggered() {
    return fullscreenTriggered;
}

/**
 * Set fullscreen triggered flag
 * @param {boolean} triggered - Whether fullscreen has been triggered
 */
export function setFullscreenTriggered(triggered) {
    fullscreenTriggered = triggered;
}
