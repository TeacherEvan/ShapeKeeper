/**
 * Lava Timer Particle Engine (FR-1 / NFR-1 / NFR-2)
 *
 * Pure, canvas-agnostic physics for bouncing lava particles constrained to the
 * gameplay board bounding box. No DOM/canvas dependency so it is unit-testable
 * under vitest (jsdom). The renderer layer (renderer/lava-timer.js) consumes
 * `updateLavaParticles` output and draws it at LAVA_OPACITY behind the dots.
 */

import { GAME_CONSTANTS } from '../constants.js';

/**
 * Compute the board bounding box from game state.
 * Matches the plan's definition:
 *   minX = offsetX, maxX = offsetX + (cols-1)*cellSize
 *   minY = offsetY, maxY = offsetY + (rows-1)*cellSize
 * @param {object} game - must expose offsetX, offsetY, cellSize, gridCols, gridRows
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}}
 */
export function computeBoardBounds(game) {
    const minX = game.offsetX;
    const minY = game.offsetY;
    const maxX = game.offsetX + (game.gridCols - 1) * game.cellSize;
    const maxY = game.offsetY + (game.gridRows - 1) * game.cellSize;
    return { minX, minY, maxX, maxY };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function createLavaParticle(bounds) {
    const r =
        GAME_CONSTANTS.LAVA_PARTICLE_RADIUS_MIN +
        Math.random() *
            (GAME_CONSTANTS.LAVA_PARTICLE_RADIUS_MAX - GAME_CONSTANTS.LAVA_PARTICLE_RADIUS_MIN);
    const angle = Math.random() * Math.PI * 2;
    const speed = GAME_CONSTANTS.LAVA_PARTICLE_SPEED * (0.6 + Math.random() * 0.8);
    return {
        x: clamp(
            bounds.minX + r + Math.random() * Math.max(1, bounds.maxX - bounds.minX - 2 * r),
            bounds.minX + r,
            bounds.maxX - r
        ),
        y: clamp(
            bounds.minY + r + Math.random() * Math.max(1, bounds.maxY - bounds.minY - 2 * r),
            bounds.minY + r,
            bounds.maxY - r
        ),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r,
    };
}

/**
 * Initialize the lava particle array, all spawned strictly INSIDE the board.
 * @param {object} game
 * @param {number} [count]
 * @returns {Array<object>}
 */
export function initializeLavaParticles(game, count = GAME_CONSTANTS.LAVA_PARTICLE_COUNT) {
    const bounds = computeBoardBounds(game);
    const particles = [];
    for (let i = 0; i < count; i++) particles.push(createLavaParticle(bounds));
    return particles;
}

/**
 * Advance all lava particles one tick with hard board-boundary clamping.
 * Elastic reflection on the inner wall (radius offset) with LAVA_BOUNCE_DAMPING.
 * When remaining time <= LAVA_URGENCY_THRESHOLD_MS the particles escalate:
 * speed scale 1.85 and upward buoyancy.
 *
 * @param {Array<object>} particles
 * @param {object} game
 * @param {number} remainingMs - time left on the turn timer
 * @returns {Array<object>} the same array (mutated in place)
 */
export function updateLavaParticles(particles, game, remainingMs) {
    const bounds = computeBoardBounds(game);
    const urgent = remainingMs <= GAME_CONSTANTS.LAVA_URGENCY_THRESHOLD_MS;
    const speedScale = urgent ? GAME_CONSTANTS.LAVA_URGENCY_SPEED_SCALE : 1;
    const buoyancy = urgent ? GAME_CONSTANTS.LAVA_URGENCY_BUOYANCY : 0;

    for (const p of particles) {
        p.x += p.vx * speedScale;
        p.y += p.vy * speedScale - buoyancy;

        // Elastic boundary reflection; clamp hard so particles never leak (NFR-1).
        if (p.x - p.r < bounds.minX) {
            p.x = bounds.minX + p.r;
            p.vx = Math.abs(p.vx) * GAME_CONSTANTS.LAVA_BOUNCE_DAMPING;
        } else if (p.x + p.r > bounds.maxX) {
            p.x = bounds.maxX - p.r;
            p.vx = -Math.abs(p.vx) * GAME_CONSTANTS.LAVA_BOUNCE_DAMPING;
        }
        if (p.y - p.r < bounds.minY) {
            p.y = bounds.minY + p.r;
            p.vy = Math.abs(p.vy) * GAME_CONSTANTS.LAVA_BOUNCE_DAMPING;
        } else if (p.y + p.r > bounds.maxY) {
            p.y = bounds.maxY - p.r;
            p.vy = -Math.abs(p.vy) * GAME_CONSTANTS.LAVA_BOUNCE_DAMPING;
        }

        // Final safety clamp (covers floating-point edge cases).
        p.x = clamp(p.x, bounds.minX + p.r, bounds.maxX - p.r);
        p.y = clamp(p.y, bounds.minY + p.r, bounds.maxY - p.r);
    }
    return particles;
}

/**
 * True when every particle lies strictly within the board bounding box.
 * Used as an invariant assertion in tests.
 * @param {Array<object>} particles
 * @param {object} game
 */
export function allParticlesInBounds(particles, game) {
    const { minX, minY, maxX, maxY } = computeBoardBounds(game);
    return particles.every(
        (p) =>
            p.x - p.r >= minX - 1e-6 &&
            p.x + p.r <= maxX + 1e-6 &&
            p.y - p.r >= minY - 1e-6 &&
            p.y + p.r <= maxY + 1e-6
    );
}
