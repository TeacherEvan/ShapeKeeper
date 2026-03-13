import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { drawLineHandler } from './games/draw';
import {
    endGameHandler,
    getGameStateHandler,
    populateLinesHandler,
    resetGameHandler,
    revealMultiplierHandler,
} from './games/state';

// Draw a line (make a move)
export const drawLine = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        lineKey: v.string(), // Normalized line key like "1,2-1,3"
    },
    handler: drawLineHandler,
});

// Get game state (lines and squares)
export const getGameState = query({
    args: {
        roomId: v.id('rooms'),
    },
    handler: getGameStateHandler,
});

// Reveal a multiplier (apply score bonus)
export const revealMultiplier = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        squareKey: v.string(),
    },
    handler: revealMultiplierHandler,
});

// End game early (host only, or by vote)
export const endGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: endGameHandler,
});

// Reset game (go back to lobby)
export const resetGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: resetGameHandler,
});

/**
 * Populate lines (host only) - adds safe lines that don't complete squares
 * This feature allows the host to add random "safe" lines to prevent stalemates
 * Safe lines are those that won't immediately complete any square
 *
 * @mutation populateLines
 * @permission host-only (validated server-side)
 * @returns {success: boolean, linesPopulated: number} | {error: string}
 *
 * TODO: [FEATURE] Consider allowing host to configure populate percentage
 * TODO: [FEATURE] Add undo functionality for populate action
 * TODO: [OPTIMIZATION] Batch line insertions for better performance on large populate counts
 */
export const populateLines = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        lineKeys: v.array(v.string()), // Array of normalized line keys (e.g., ["1,2-1,3", "2,3-3,3"])
    },
    handler: populateLinesHandler,
});
