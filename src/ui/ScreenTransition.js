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

    // Capture focus BEFORE mutating visibility attributes. The browser raises a
    // synchronous "aria-hidden on focused element" warning the moment a focused
    // control's ancestor gains `aria-hidden="true"`. If the focused element
    // lives in a screen we are about to hide, move focus to the incoming screen
    // first so no focused control is ever inside an aria-hidden subtree.
    const activeEl = document.activeElement;
    const leavingFocused =
        activeEl &&
        activeEl !== newScreen &&
        activeEl.closest('.screen') &&
        activeEl.closest('.screen').id !== screenId;

    if (leavingFocused && newScreen) {
        const focusTarget =
            newScreen.querySelector(
                'button:not([hidden]):not([disabled]), [href], input:not([hidden]):not([disabled]), select:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])'
            ) || newScreen;
        focusTarget.focus({ preventScroll: true });
    }

    document.querySelectorAll('.screen').forEach((screen) => {
        const isActive = screen.id === screenId;
        screen.classList.toggle('active', isActive);
        screen.hidden = !isActive;
        screen.setAttribute('aria-hidden', String(!isActive));
        screen.inert = !isActive;
    });
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
