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
    handler: async (ctx, args) => {
        console.log('[updatePlayer] Update player request', {
            roomId: args.roomId,
            sessionId: args.sessionId,
            updates: { name: args.name, color: args.color },
        });

        const player = await ctx.db
            .query('players')
            .withIndex('by_room_and_session', (q) =>
                q.eq('roomId', args.roomId).eq('sessionId', args.sessionId)
            )
            .first();

        if (!player) {
            console.log('[updatePlayer] Error: Player not found', {
                roomId: args.roomId,
                sessionId: args.sessionId,
            });
            return { error: 'Player not found' };
        }

        const updates: { name?: string; color?: string } = {};
        if (args.name) updates.name = args.name;
        if (args.color) {
            // Check if color is available
            const players = await ctx.db
                .query('players')
                .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
                .collect();

            const colorInUse = players.some((p) => p._id !== player._id && p.color === args.color);

            if (colorInUse) {
                console.log('[updatePlayer] Error: Color already in use', {
                    requestedColor: args.color,
                    playerId: player._id,
                });
                return { error: 'Color already in use' };
            }
            updates.color = args.color;
        }

        await ctx.db.patch(player._id, updates);
        await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

        console.log('[updatePlayer] Player updated successfully', {
            playerId: player._id,
            updates,
        });

        return { success: true };
    },
});

// Update grid size (host only)
export const updateGridSize = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        gridSize: v.number(),
    },
    handler: async (ctx, args) => {
        console.log('[updateGridSize] Update grid size request', {
            roomId: args.roomId,
            sessionId: args.sessionId,
            newGridSize: args.gridSize,
        });

        const room = await ctx.db.get(args.roomId);
        if (!room) {
            console.log('[updateGridSize] Error: Room not found', { roomId: args.roomId });
            return { error: 'Room not found' };
        }

        if (room.hostPlayerId !== args.sessionId) {
            console.log('[updateGridSize] Error: Not host', {
                requestingSession: args.sessionId,
                hostSession: room.hostPlayerId,
            });
            return { error: 'Only the host can change grid size' };
        }

        if (room.status !== 'lobby') {
            console.log('[updateGridSize] Error: Game in progress', {
                roomId: args.roomId,
                status: room.status,
            });
            return { error: 'Cannot change grid size while game is in progress' };
        }

        await ctx.db.patch(args.roomId, {
            gridSize: args.gridSize,
            updatedAt: Date.now(),
        });

        console.log('[updateGridSize] Grid size updated', {
            roomId: args.roomId,
            oldGridSize: room.gridSize,
            newGridSize: args.gridSize,
        });

        return { success: true };
    },
});

// Update party mode (host only)
export const updatePartyMode = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        partyMode: v.boolean(),
    },
    handler: async (ctx, args) => {
        console.log('[updatePartyMode] Update party mode request', {
            roomId: args.roomId,
            sessionId: args.sessionId,
            newPartyMode: args.partyMode,
        });

        const room = await ctx.db.get(args.roomId);
        if (!room) {
            console.log('[updatePartyMode] Error: Room not found', { roomId: args.roomId });
            return { error: 'Room not found' };
        }

        if (room.hostPlayerId !== args.sessionId) {
            console.log('[updatePartyMode] Error: Not host', {
                requestingSession: args.sessionId,
                hostSession: room.hostPlayerId,
            });
            return { error: 'Only the host can change party mode' };
        }

        if (room.status !== 'lobby') {
            console.log('[updatePartyMode] Error: Game in progress', {
                roomId: args.roomId,
                status: room.status,
            });
            return { error: 'Cannot change party mode while game is in progress' };
        }

        await ctx.db.patch(args.roomId, {
            partyMode: args.partyMode,
            updatedAt: Date.now(),
        });

        console.log('[updatePartyMode] Party mode updated', {
            roomId: args.roomId,
            oldPartyMode: room.partyMode,
            newPartyMode: args.partyMode,
        });

        return { success: true };
    },
});

// Get room by code (for joining)
export { getRoomByCode, getRoom } from './queries/roomQueries';

// Get room state (for subscriptions)
export const getRoom = query({
    args: {
        roomId: v.id('rooms'),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db.get(args.roomId);
        if (!room) {
            return null;
        }

        const players = await ctx.db
            .query('players')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();

        return {
            ...room,
            players: players.sort((a, b) => a.playerIndex - b.playerIndex),
        };
    },
});

// Start the game (host only)
export { startGame } from './mutations/startGame';
