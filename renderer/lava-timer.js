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
import { prefersReducedMotion } from '../utils.js';

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

const _lavaSpriteCache = { normal: null, urgent: null };

function getLavaSprite(urgent) {
    const key = urgent ? 'urgent' : 'normal';
    if (_lavaSpriteCache[key]) return _lavaSpriteCache[key];
    if (typeof document === 'undefined') return null;

    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const sctx = c.getContext?.('2d');
    if (!sctx) return null;

    const half = size / 2;
    const grad = sctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, urgent ? 'rgba(255,90,30,0.9)' : 'rgba(255,140,40,0.9)');
    grad.addColorStop(1, 'rgba(255,60,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
    _lavaSpriteCache[key] = c;
    return c;
}

/**
 * Draw the lava timer layer (particles + de-collided countdown pill).
 * @param {object} game - exposes ctx, lava, logicalWidth/Height, and a
 *                        `turnRemainingMs` field (optional; >=0 shows countdown)
 * @param {number} [remainingMs] - optional override; defaults to game.turnRemainingMs
 */
export function drawLavaTimer(game, remainingMs) {
    const ctx = game.ctx;
    if (!ctx) return;

    const remaining = remainingMs != null ? remainingMs : game.turnRemainingMs;
    if (remaining == null) return;

    const lava = ensureLavaSystem(game);
    if (remainingMs == null && game.turnRemainingMs == null) return;
    if (!lava.initialized) initLavaSystem(game);

    if (!prefersReducedMotion()) {
        updateLavaParticles(lava.particles, game, remaining);
    }

    ctx.save();
    ctx.globalAlpha = GAME_CONSTANTS.LAVA_OPACITY;

    const urgent = remaining <= GAME_CONSTANTS.LAVA_URGENCY_THRESHOLD_MS;
    const sprite = getLavaSprite(urgent);
    for (const p of lava.particles) {
        if (sprite && typeof ctx.drawImage === 'function') {
            ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        } else {
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grad.addColorStop(0, urgent ? 'rgba(255,90,30,0.9)' : 'rgba(255,140,40,0.9)');
            grad.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    if (remaining >= 0) {
        const label = formatCountdown(remaining);
        const canUsePill = (game.offsetY ?? 0) >= 46 && typeof ctx.roundRect === 'function';
        const dark =
            typeof document === 'undefined' ||
            document.documentElement?.getAttribute?.('data-theme') !== 'light';
        ctx.save();
        if (canUsePill) {
            const pillW = 76;
            const pillH = 28;
            const cx = game.logicalWidth / 2;
            const cy = Math.max(20, game.offsetY - 34);
            ctx.beginPath();
            ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 999);
            ctx.fillStyle = dark ? 'rgba(19, 26, 44, 0.88)' : 'rgba(250, 250, 254, 0.92)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = urgent ? 'rgba(255, 106, 42, 0.85)' : 'rgba(255, 176, 136, 0.45)';
            ctx.stroke();
            ctx.fillStyle = urgent ? (dark ? '#ff7d47' : '#c23b08') : dark ? '#ffd1b3' : '#7c4912';
            ctx.font = '700 14px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy);
        } else {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = urgent ? '#FF6A2A' : '#FFB088';
            ctx.font = 'bold 40px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, game.logicalWidth / 2, game.logicalHeight / 2);
        }
        ctx.restore();
    }
}
