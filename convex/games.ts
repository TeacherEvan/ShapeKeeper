import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { drawLineHandler } from './games/draw';
import { requestRematchHandler } from './games/rematch';
import { POPULATE_PLAYER_INDEX } from './games/shared';
import { expireTurnHandler } from './games/turnTimer';
import { log, errorLog, warn } from './log';
import {
    endGameHandler,
    getGameStateHandler,
    populateLinesHandler,
    resetGameHandler,
    revealMultiplierHandler,
    tapSquareHandler,
} from './games/state';

export const expireTurn = internalMutation({
    args: { roomId: v.id('rooms'), expectedTurnEndTime: v.number() },
    handler: expireTurnHandler,
});

// Draw a line (make a move). Rate-limited, lineKey-validated, deadline-enforced.
export const drawLine = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        lineKey: v.string(),
        clientSentAt: v.optional(v.number()),
    },
    handler: drawLineHandler,
});

// Opponent tap: reduce a completed opponent square's multiplier (see docs/feature-opponent-tap.md).
export const tapSquare = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        squareKey: v.string(),
    },
    handler: tapSquareHandler,
});

// Get game state (lines and squares)
export const getGameState = query({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.optional(v.string()),
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

// End game early (host only). hostToken is the raw token returned by
// createRoom; the server hashes it and compares against room.hostTokenHash.
export const endGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
    },
    handler: endGameHandler,
});

// Reset game (go back to lobby). Host only.
export const resetGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
    },
    handler: resetGameHandler,
});

// Request rematch (consent-based, requires all connected players).
export const requestRematch = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: requestRematchHandler,
});

/**
 * Populate lines (host only) - adds safe lines that don't complete squares
 * This feature allows the host to add random "safe" lines to prevent stalemates
 * Safe lines are those that won't immediately complete any square
 *
 * @mutation populateLines
 * @permission host-only (validated server-side)
 * @returns {success: boolean, linesPopulated: number} | {error: string}
 */
export const populateLines = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        lineKeys: v.array(v.string()), // Array of normalized line keys (e.g., ["1,2-1,3", "2,3-3,3"])
    },
    handler: populateLinesHandler,
});
