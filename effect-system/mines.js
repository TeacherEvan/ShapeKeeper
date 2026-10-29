/**
 * ShapeKeeper — mine placement policy
 *
 * A "mine" is a hidden box that cuts the claiming player's score to 20% when
 * the box is completed. Product rules (owner, 2026-10-30):
 *
 * - No mines before level 15.
 * - Level 15 opens with 2 mines, placed at random.
 * - The count doubles every 10 levels: 2, 4, 8, 16, ...
 * - Mines are invisible until they fire; the box then keeps a 💣 marker.
 * - Density is capped so late boards never become wall-to-wall mines.
 *
 * Everything here is pure so the policy can be tested without a game instance.
 */

export const FIRST_MINE_LEVEL = 15;
export const BASE_MINE_COUNT = 2;
export const MINE_LEVEL_STEP = 10;

/**
 * Ceiling on how much of the board may be mined. The raw doubling rule reaches
 * 100% of the board around level 55; at that point every box is a trap and the
 * board stops being a game. 25% keeps the late levels brutal but playable.
 */
export const MAX_MINE_DENSITY = 0.25;

/**
 * How many mines a level gets.
 *
 * @param {number} level - 1..100 levels-mode level
 * @param {number} totalSquares - playable boxes on this board
 * @returns {number} mine count, always <= totalSquares
 */
export function getMineCountForLevel(level, totalSquares) {
    const lvl = Number(level);
    const squares = Math.floor(Number(totalSquares));
    if (!Number.isFinite(lvl) || !Number.isFinite(squares) || squares <= 0) return 0;
    if (lvl < FIRST_MINE_LEVEL) return 0;

    const doublings = Math.floor((lvl - FIRST_MINE_LEVEL) / MINE_LEVEL_STEP);
    const raw = BASE_MINE_COUNT * 2 ** doublings;
    const densityCap = Math.max(BASE_MINE_COUNT, Math.floor(squares * MAX_MINE_DENSITY));

    return Math.min(raw, densityCap, squares);
}

/**
 * Pick `count` distinct square keys at random (Fisher–Yates).
 *
 * @param {string[]} squareKeys - every playable box key on the board
 * @param {number} count - how many mines to place
 * @param {() => number} rng - injectable RNG for deterministic tests
 * @returns {string[]} the mined square keys
 */
export function placeMines(squareKeys, count, rng = Math.random) {
    if (!Array.isArray(squareKeys) || squareKeys.length === 0) return [];

    const keys = squareKeys.slice();
    const mines = Math.max(0, Math.min(Math.floor(Number(count) || 0), keys.length));
    if (mines === 0) return [];

    for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
    }

    return keys.slice(0, mines);
}

/**
 * True when a square-multiplier entry is a mine. The value check keeps older
 * boards (and saved games) that predate the explicit `isMine` flag working.
 *
 * @param {{ type?: string, value?: number, isMine?: boolean } | undefined} data
 * @returns {boolean}
 */
export function isMineMultiplier(data) {
    if (!data || data.type !== 'multiplier') return false;
    return data.isMine === true || data.value === 0.2;
}

/**
 * How many mines are still hidden. Drives the footer chip, which is the
 * persistent explanation of the mechanic after the level-start toast is gone.
 *
 * @param {Record<string, object>} squareMultipliers
 * @param {Set<string>|string[]} [revealed]
 * @returns {number}
 */
export function countHiddenMines(squareMultipliers, revealed) {
    if (!squareMultipliers || typeof squareMultipliers !== 'object') return 0;

    const seen = revealed instanceof Set ? revealed : new Set(revealed || []);
    let hidden = 0;
    for (const [key, data] of Object.entries(squareMultipliers)) {
        if (isMineMultiplier(data) && !seen.has(key)) hidden += 1;
    }
    return hidden;
}
