import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Create a new room
export { createRoom } from './mutations/createRoom';

// Join an existing room
export { joinRoom } from './mutations/joinRoom';

// Leave a room
export { leaveRoom } from './mutations/leaveRoom';

// Toggle ready status
export { toggleReady } from './mutations/toggleReady';

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

// Update grid size (host only). hostToken is the raw token returned by
// createRoom; the server hashes it and compares against the room's
// hostTokenHash. Optional for backwards compat with rooms created before
// this deploy (the handler falls back to a sessionId-only check for those).
export const updateGridSize = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        gridSize: v.number(),
    },
    handler: updateGridSizeHandler,
});

// Update party mode (host only).
export const updatePartyMode = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        partyMode: v.boolean(),
    },
    handler: updatePartyModeHandler,
});

// Get room by code (for joining)
export { getRoomByCode } from './queries/roomQueries';

// Get room state (for subscriptions). sessionId is optional; when supplied,
// the response includes isHost / isYou flags.
export const getRoom = query({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.optional(v.string()),
    },
    handler: getRoomHandler,
});

// Start the game (host only)
export { startGame } from './mutations/startGame';
