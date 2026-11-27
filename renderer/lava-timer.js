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
    if (urgent) {
        grad.addColorStop(0, 'rgba(255, 224, 190, 0.98)');
        grad.addColorStop(0.35, 'rgba(255, 82, 48, 0.82)');
        grad.addColorStop(0.72, 'rgba(220, 38, 38, 0.30)');
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    } else {
        grad.addColorStop(0, 'rgba(255, 238, 170, 0.95)');
        grad.addColorStop(0.35, 'rgba(245, 165, 39, 0.72)');
        grad.addColorStop(0.72, 'rgba(234, 88, 12, 0.26)');
        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    }
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
        updateLavaParticles(lava.particles, game, remaining, game.lastFrameDtSeconds ?? 1 / 60);
    }

    ctx.save();
    ctx.globalAlpha = GAME_CONSTANTS.LAVA_OPACITY;

    const urgent = remaining <= GAME_CONSTANTS.LAVA_URGENCY_THRESHOLD_MS;
    if (urgent && game.offsetX != null && game.gridCols && game.gridRows && game.cellSize) {
        const boardW = (game.gridCols - 1) * game.cellSize;
        const boardH = (game.gridRows - 1) * game.cellSize;
        if (typeof ctx.createLinearGradient === 'function') {
            const heatGrad = ctx.createLinearGradient(
                0,
                game.offsetY + boardH - Math.min(48, boardH * 0.35),
                0,
                game.offsetY + boardH
            );
            heatGrad.addColorStop(0, 'rgba(255, 70, 30, 0)');
            heatGrad.addColorStop(1, 'rgba(255, 70, 30, 0.42)');
            ctx.fillStyle = heatGrad;
            ctx.fillRect(
                game.offsetX,
                game.offsetY + boardH - Math.min(48, boardH * 0.35),
                boardW,
                Math.min(48, boardH * 0.35)
            );
        }
    }

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
            const pillW = 96;
            const pillH = 30;
            const cx = game.logicalWidth / 2;
            const cy = Math.max(19, game.offsetY - 40);
            const totalMs = Math.max(1000, game.turnDurationMs || 7000);
            const progress = Math.max(0, Math.min(1, remaining / totalMs));

            ctx.beginPath();
            ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 999);
            ctx.fillStyle = dark ? 'rgba(15, 20, 31, 0.94)' : 'rgba(255, 253, 248, 0.96)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = urgent
                ? 'rgba(255, 107, 122, 0.85)'
                : dark
                  ? 'rgba(245, 183, 39, 0.5)'
                  : 'rgba(140, 85, 0, 0.36)';
            ctx.stroke();

            // Integrated glowing thermal gauge bar along the bottom inner track
            const trackW = pillW - 24;
            const trackX = cx - trackW / 2;
            const trackY = cy + pillH / 2 - 4.5;
            ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(20, 24, 33, 0.1)';
            ctx.beginPath();
            ctx.roundRect(trackX, trackY, trackW, 2.5, 2);
            ctx.fill();

            if (progress > 0.01) {
                ctx.fillStyle = urgent
                    ? dark
                        ? '#ff6b7a'
                        : '#be123c'
                    : dark
                      ? '#f5b727'
                      : '#8c5500';
                ctx.beginPath();
                ctx.roundRect(trackX, trackY, Math.max(4, trackW * progress), 2.5, 2);
                ctx.fill();
            }

            // Ember status indicator dot inside the left edge of the pill
            ctx.beginPath();
            ctx.arc(cx - pillW / 2 + 14, cy - 1.5, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = urgent ? (dark ? '#ff7d47' : '#be123c') : dark ? '#f5b727' : '#8c5500';
            ctx.fill();

            ctx.fillStyle = urgent ? (dark ? '#ff8f9b' : '#be123c') : dark ? '#f6f3eb' : '#141821';
            ctx.font = '700 13.5px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx + 6, cy - 1.5);
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
