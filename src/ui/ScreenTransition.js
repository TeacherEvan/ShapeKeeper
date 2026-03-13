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
