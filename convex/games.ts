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
        clientSentAt: v.optional(v.number()), // client epoch (ms) when the move was issued
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

export const populateLines = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        lineKeys: v.array(v.string()), // Array of normalized line keys (e.g., ["1,2-1,3", "2,3-3,3"])
    },
    handler: populateLinesHandler,
});
