import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
    // Game rooms/sessions
    rooms: defineTable({
        roomCode: v.string(), // 6-character code for joining
        hostPlayerId: v.string(), // Session ID of the host
        // SHA-256 of the server-issued hostToken. Created in createRoom and
        // required by every host-gated mutation. Optional only because rooms
        // created before this deploy do not have it; the auth helper
        // isAuthorisedHost falls back to a sessionId-only check for those
        // legacy rooms.
        hostTokenHash: v.optional(v.string()),
        gridSize: v.number(), // 5, 10, 20, or 30
        partyMode: v.optional(v.boolean()), // Party mode enabled (tile effects)
        status: v.union(v.literal('lobby'), v.literal('playing'), v.literal('finished')),
        currentPlayerIndex: v.number(), // Index into players array for current turn
        createdAt: v.number(),
        updatedAt: v.number(),
        // Turn timing metadata (FR-2 / FR-3): authoritative server clock for the
        // online turn countdown. Clients derive their local countdown from these.
        turnStartTime: v.optional(v.number()), // server epoch (ms) when current turn began
        turnEndTime: v.optional(v.number()), // server epoch (ms) when current turn ends
        lastTurnClientSentAt: v.optional(v.number()), // client send timestamp of last move
        lastTurnServerReceivedAt: v.optional(v.number()), // server receipt timestamp of last move
    })
        .index('by_code', ['roomCode'])
        .index('by_status', ['status']),

    // Players in rooms
    players: defineTable({
        roomId: v.id('rooms'),
        sessionId: v.string(), // Browser session identifier
        name: v.string(),
        color: v.string(), // Hex color code
        score: v.number(),
        isReady: v.boolean(),
        isConnected: v.boolean(),
        playerIndex: v.number(), // Turn order (0-5)
        joinedAt: v.number(),
    })
        .index('by_room', ['roomId'])
        .index('by_session', ['sessionId'])
        .index('by_room_and_session', ['roomId', 'sessionId']),

    // Game state - lines drawn
    lines: defineTable({
        roomId: v.id('rooms'),
        lineKey: v.string(), // Normalized line key like "1,2-1,3"
        playerId: v.id('players'), // Who drew this line
        playerIndex: v.number(), // For quick color lookup
        createdAt: v.number(),
    })
        .index('by_room', ['roomId'])
        .index('by_room_and_key', ['roomId', 'lineKey']),

    // Completed squares
    squares: defineTable({
        roomId: v.id('rooms'),
        squareKey: v.string(), // Key like "1,2" for row,col
        playerId: v.id('players'), // Who completed this square
        playerIndex: v.number(), // For quick color lookup
        multiplier: v.optional(
            v.object({
                type: v.union(v.literal('multiplier'), v.literal('truthOrDare')),
                value: v.optional(v.number()),
            })
        ),
        // Set by revealMultiplierHandler on first successful reveal. Stops a
        // hostile client from re-calling revealMultiplier to apply the bonus
        // a second time. The browser's revealedMultipliers Set is UI-only;
        // this is the authoritative flag.
        multiplierRevealed: v.optional(v.boolean()),
        createdAt: v.number(),
    })
        .index('by_room', ['roomId'])
        .index('by_room_and_key', ['roomId', 'squareKey']),
});
