import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
    createRoomHandler,
    joinRoomHandler,
    leaveRoomHandler,
    toggleReadyHandler,
    updatePlayerHandler,
} from './rooms/mutations';
import { getRoomByCodeHandler, getRoomHandler } from './rooms/queries';
import { startGameHandler, updateGridSizeHandler, updatePartyModeHandler } from './rooms/settings';

// Create a new room
export const createRoom = mutation({
    args: {
        sessionId: v.string(),
        playerName: v.string(),
        gridSize: v.number(),
        partyMode: v.optional(v.boolean()),
    },
    handler: createRoomHandler,
});

// Join an existing room
export const joinRoom = mutation({
    args: {
        roomCode: v.string(),
        sessionId: v.string(),
        playerName: v.string(),
    },
    handler: joinRoomHandler,
});

// Leave a room
export const leaveRoom = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: leaveRoomHandler,
});

// Toggle ready status
export const toggleReady = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: toggleReadyHandler,
});

// Update player settings (name, color)
export const updatePlayer = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        name: v.optional(v.string()),
        color: v.optional(v.string()),
    },
    handler: updatePlayerHandler,
});

// Update grid size (host only)
export const updateGridSize = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        gridSize: v.number(),
    },
    handler: updateGridSizeHandler,
});

// Update party mode (host only)
export const updatePartyMode = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        partyMode: v.boolean(),
    },
    handler: updatePartyModeHandler,
});

// Get room by code (for joining)
export const getRoomByCode = query({
    args: {
        roomCode: v.string(),
    },
    handler: getRoomByCodeHandler,
});

// Get room state (for subscriptions)
export const getRoom = query({
    args: {
        roomId: v.id('rooms'),
    },
    handler: getRoomHandler,
});

// Start the game (host only)
export const startGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: startGameHandler,
});
