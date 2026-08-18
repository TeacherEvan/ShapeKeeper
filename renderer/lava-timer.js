/**
 * Lava Timer Renderer (FR-1 / NFR-2)
 *
 * Draws the bounded lava particle layer + centered countdown at LAVA_OPACITY
 * (0.40) behind the gameplay dots/lines/squares. Called from Renderer.draw()
 * at the Layer-2 slot (after ambient particles, before lines & dots).
 *
 * `drawLavaTimer` is canvas-backed (game.ctx). The numeric formatting helper
 * `formatCountdown` is pure and unit-tested (tests/lava-renderer.test.js).
 */

import { GAME_CONSTANTS, TIMING_CONSTANTS } from '../constants.js';
import { initializeLavaParticles, updateLavaParticles } from '../particle-system/lava-particles.js';

/**
 * Format remaining milliseconds into a jitter-free, quantized display string.
 * Quantized to COUNTDOWN_QUANTIZE_MS (0.1s) and rendered with fixed-width
 * styling expectation (tabular-nums applied by the caller).
 * @param {number} remainingMs
 * @returns {string} e.g. "7.2s" or "0.0s"
 */
export function formatCountdown(remainingMs) {
    const clamped = Math.max(0, remainingMs);
    const quantized =
        Math.floor(clamped / TIMING_CONSTANTS.COUNTDOWN_QUANTIZE_MS) *
        TIMING_CONSTANTS.COUNTDOWN_QUANTIZE_MS;
    return (quantized / 1000).toFixed(1) + 's';
}

/**
 * Ensure a lava particle array exists on the game object.
 * @param {object} game
 */
export function ensureLavaSystem(game) {
    if (!game.lava) {
        game.lava = { particles: null, initialized: false };
    }
    return game.lava;
}

/**
 * Initialize the lava particle system for the current game/board.
 * @param {object} game - must expose offsetX, offsetY, cellSize, gridCols, gridRows
 */
export function initLavaSystem(game) {
    const lava = ensureLavaSystem(game);
    lava.particles = initializeLavaParticles(game);
    lava.initialized = true;
    return lava;
}

/**
 * Draw the lava timer layer (particles + centered countdown).
 * @param {object} game - exposes ctx, lava, logicalWidth/Height, and a
 *                        `turnRemainingMs` field (optional; >=0 shows countdown)
 * @param {number} [remainingMs] - optional override; defaults to game.turnRemainingMs
 */
export function drawLavaTimer(game, remainingMs) {
    const ctx = game.ctx;
    if (!ctx) return;
    const lava = ensureLavaSystem(game);
    if (!lava.initialized) initLavaSystem(game);

    const remaining = remainingMs != null ? remainingMs : (game.turnRemainingMs ?? 0);

    // Advance physics (behind dots, 40% opacity max).
    updateLavaParticles(lava.particles, game, remaining);

    ctx.save();
    ctx.globalAlpha = GAME_CONSTANTS.LAVA_OPACITY;

    // Glowing lava particles with upward urgency tint.
    const urgent = remaining <= GAME_CONSTANTS.LAVA_URGENCY_THRESHOLD_MS;
    for (const p of lava.particles) {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        const core = urgent ? 'rgba(255,90,30,0.9)' : 'rgba(255,140,40,0.9)';
        grad.addColorStop(0, core);
        grad.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Centered countdown text (also at 40% opacity, behind dots).
    if (remaining >= 0) {
        ctx.save();
        ctx.globalAlpha = GAME_CONSTANTS.LAVA_OPACITY;
        ctx.fillStyle = urgent ? '#FF6A2A' : '#FFB088';
        ctx.font = 'bold 48px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatCountdown(remaining), game.logicalWidth / 2, game.logicalHeight / 2);
        ctx.restore();
    }
}
