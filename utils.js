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
 * Check if two dots are adjacent (orthogonal or diagonal)
 * @param {Object} dot1 - First dot {row, col}
 * @param {Object} dot2 - Second dot {row, col}
 * @returns {boolean} True if adjacent
 */
export function areAdjacent(dot1, dot2) {
    const rowDiff = Math.abs(dot1.row - dot2.row);
    const colDiff = Math.abs(dot1.col - dot2.col);
    // Orthogonal (horizontal/vertical) OR diagonal (45°)
    return (
        (rowDiff === 1 && colDiff === 0) ||
        (rowDiff === 0 && colDiff === 1) ||
        (rowDiff === 1 && colDiff === 1)
    ); // Diagonal!
}

/**
 * Get the type of line between two dots
 * @param {Object} dot1 - First dot {row, col}
 * @param {Object} dot2 - Second dot {row, col}
 * @returns {'horizontal' | 'vertical' | 'diagonal' | 'invalid'}
 */
export function getLineType(dot1, dot2) {
    const rowDiff = Math.abs(dot1.row - dot2.row);
    const colDiff = Math.abs(dot1.col - dot2.col);

    if (rowDiff === 0 && colDiff === 1) return 'horizontal';
    if (rowDiff === 1 && colDiff === 0) return 'vertical';
    if (rowDiff === 1 && colDiff === 1) return 'diagonal';
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
 * Get the cell key for a triangle based on its vertices
 * A triangle claims the cell containing its vertices
 * @param {Array} vertices - Array of 3 vertex objects {row, col}
 * @returns {string} Cell key "row,col"
 */
export function getTriangleCellKey(vertices) {
    // A triangle is always within a single cell
    // The cell is determined by the minimum row and col of the vertices
    const minRow = Math.min(vertices[0].row, vertices[1].row, vertices[2].row);
    const minCol = Math.min(vertices[0].col, vertices[1].col, vertices[2].col);
    return `${minRow},${minCol}`;
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