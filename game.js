/**
 * ShapeKeeper - DotsAndBoxesGame
 * Main game class orchestrating all modules
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { DotsAndBoxesGame } from './dots-and-boxes-game.js';
import { FEATURE_FLAGS } from './constants.js';

// Feature-flag bridge (FR-6). The plan specifies flags are "enabled via
// window.FEATURE_* at runtime"; this applies any window.FEATURE_LAVA_TIMER /
// window.FEATURE_SYNC_RESILIENCE set before module load into the static
// FEATURE_FLAGS object. Without this, the lava timer + sync resilience stay
// permanently gated-off in the running app (defaults are false in constants.js).
if (typeof window !== 'undefined') {
    if (typeof window.FEATURE_LAVA_TIMER === 'boolean') {
        FEATURE_FLAGS.FEATURE_LAVA_TIMER = window.FEATURE_LAVA_TIMER;
    }
    if (typeof window.FEATURE_SYNC_RESILIENCE === 'boolean') {
        FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE = window.FEATURE_SYNC_RESILIENCE;
    }
    // Expose a live read-only mirror so runtime flag state is inspectable
    // (e.g. end-to-end tests assert the bridge actually flipped the guard).
    Object.defineProperty(window, 'FEATURE_FLAGS', {
        configurable: true,
        get: () => FEATURE_FLAGS,
    });
}

// Export for use in HTML
window.DotsAndBoxesGame = DotsAndBoxesGame;

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Game initialization will be handled by the HTML
});
