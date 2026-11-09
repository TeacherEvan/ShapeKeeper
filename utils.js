import { GAME_CONSTANTS } from './constants.js';

/**
 * ShapeKeeper - Utility Functions
 * Common utility functions for the Dots and Boxes game
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

/**
 * Generate a random color for the populate feature
 * Ensures it's visually distinct from player 1 and 2 colors
 * @returns {string} Hex color string
 */
export function generateRandomColor() {
    // Generate random RGB values
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);

    // Convert to hex
    const toHex = (val) => val.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Easing function: ease-out-quad
 * @param {number} t - Progress 0-1
 * @returns {number} Eased value 0-1
 */
export function easeOutQuad(t) {
    return t * (2 - t);
}

/**
 * Linear interpolation
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Progress 0-1
 * @returns {number} Interpolated value
 */
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Check if two dots are adjacent orthogonally
 * @param {Object} dot1 - First dot {row, col}
 * @param {Object} dot2 - Second dot {row, col}
 * @returns {boolean} True if adjacent
 */
export function areAdjacent(dot1, dot2) {
    const rowDiff = Math.abs(dot1.row - dot2.row);
    const colDiff = Math.abs(dot1.col - dot2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

/**
 * Get the type of line between two dots
 * @param {Object} dot1 - First dot {row, col}
 * @param {Object} dot2 - Second dot {row, col}
 * @returns {'horizontal' | 'vertical' | 'invalid'}
 */
export function getLineType(dot1, dot2) {
    const rowDiff = Math.abs(dot1.row - dot2.row);
    const colDiff = Math.abs(dot1.col - dot2.col);

    if (rowDiff === 0 && colDiff === 1) return 'horizontal';
    if (rowDiff === 1 && colDiff === 0) return 'vertical';
    return 'invalid';
}

/**
 * Get the line key for two dots
 * @param {Object} dot1 - First dot {row, col}
 * @param {Object} dot2 - Second dot {row, col}
 * @returns {string} Line key "row,col-row,col"
 */
export function getLineKey(dot1, dot2) {
    const [first, second] = [dot1, dot2].sort((a, b) =>
        a.row === b.row ? a.col - b.col : a.row - b.row
    );
    return `${first.row},${first.col}-${second.row},${second.col}`;
}

/**
 * Parse a line key string into start and end dot objects
 * @param {string} lineKey - Format: "row,col-row,col"
 * @returns {Array} [startDot, endDot]
 */
export function parseLineKey(lineKey) {
    const [start, end] = lineKey.split('-').map((s) => {
        const [row, col] = s.split(',').map(Number);
        return { row, col };
    });
    return [start, end];
}

/**
 * Parse a square key string into row and col
 * @param {string} squareKey - Format: "row,col"
 * @returns {Object} {row, col}
 */
export function parseSquareKey(squareKey) {
    const [row, col] = squareKey.split(',').map(Number);
    return { row, col };
}

/**
 * Get the nearest dot to a screen position if it is within selection range
 * @param {number} x - Screen x coordinate relative to the canvas
 * @param {number} y - Screen y coordinate relative to the canvas
 * @param {number} offsetX - Grid horizontal offset
 * @param {number} offsetY - Grid vertical offset
 * @param {number} cellSize - Grid cell size in pixels
 * @param {number} gridRows - Number of grid rows
 * @param {number} gridCols - Number of grid columns
 * @returns {{row: number, col: number} | null} The nearest dot or null
 */
export function getNearestDot(
    x,
    y,
    offsetX,
    offsetY,
    cellSize,
    gridRows,
    gridCols,
    selectionRadiusMultiplier = 0.5
) {
    const col = Math.round((x - offsetX) / cellSize) + 0;
    const row = Math.round((y - offsetY) / cellSize) + 0;

    if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) {
        return null;
    }

    const dotX = offsetX + col * cellSize;
    const dotY = offsetY + row * cellSize;
    const distance = Math.hypot(x - dotX, y - dotY);

    return distance <= cellSize * selectionRadiusMultiplier ? { row, col } : null;
}

export function getDotSelectionRadiusMultiplier(isTouchDevice = false) {
    return isTouchDevice ? 0.68 : 0.5;
}

export function getDotRenderRadius(cellSize, isTouchDevice = false) {
    const scaledRadius = cellSize * (isTouchDevice ? 0.12 : 0.08);
    const minimumRadius = isTouchDevice ? 4 : 2.6;
    const maximumRadius = isTouchDevice ? 6.5 : 4;

    return Math.max(
        GAME_CONSTANTS.DOT_RADIUS,
        Math.max(minimumRadius, Math.min(scaledRadius, maximumRadius))
    );
}

/**
 * In-place array compaction for animation cleanup
 * More efficient than filter() for hot paths
 * @private
 * @param {Array} arr - Array to compact
 * @param {number} now - Current timestamp
 * @param {Function} keepPredicate - Function to determine if item should be kept
 */
export function compactAnimationArray(arr, now, keepPredicate) {
    if (!arr || arr.length === 0) return;
    let writeIndex = 0;
    for (let i = 0; i < arr.length; i++) {
        if (keepPredicate(arr[i])) {
            arr[writeIndex++] = arr[i];
        }
    }
    arr.length = writeIndex;
}

export function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/**
 * Safely format a color with alpha transparency for Canvas 2D / CSS.
 * Clamps alpha to [0, 1] to prevent invalid negative hex values (e.g. #ff0000-5).
 * Expands 3-digit hex (#RGB) to 6-digit hex before appending alpha.
 * Replaces existing alpha in 8-digit hex (#RRGGBBAA).
 * Falls back safely for non-hex colors.
 *
 * @param {string} color - Hex color (#RGB, #RRGGBB, #RRGGBBAA) or CSS color
 * @param {number} alpha - Alpha value (0 to 1)
 * @returns {string} Safe color string with alpha applied
 */
export function formatHexAlpha(color, alpha) {
    if (typeof color !== 'string') return '#00000000';
    const clamped = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
    const alphaHex = Math.floor(clamped * 255)
        .toString(16)
        .padStart(2, '0');

    const trimmed = color.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
        return `${trimmed}${alphaHex}`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        const [, r, g, b] = trimmed;
        return `#${r}${r}${g}${g}${b}${b}${alphaHex}`;
    }
    if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
        return `${trimmed.slice(0, 7)}${alphaHex}`;
    }
    const rgbMatch = trimmed.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
        return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${clamped})`;
    }
    return trimmed;
}

/**
 * Frame-rate independent exponential decay.
 *
 * A per-frame multiplier (`value *= 0.9`) converges at a different speed on a
 * 60 Hz and a 120 Hz display. This closes the same fraction of the remaining
 * gap per *second*, so the motion is identical at any refresh rate.
 *
 * @param {number} current - Current value
 * @param {number} target - Value being approached
 * @param {number} decayPerSecond - Rate constant (higher = snappier)
 * @param {number} dtSeconds - Elapsed seconds since the previous frame
 * @returns {number} Decayed value
 */
export function expDecay(current, target, decayPerSecond, dtSeconds) {
    const dt = Math.max(0, Number(dtSeconds) || 0);
    return target + (current - target) * Math.exp(-decayPerSecond * dt);
}
