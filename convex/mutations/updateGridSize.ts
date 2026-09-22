import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getHostTokenHash } from '../utils/roomUtils';

export const updateGridSize = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        gridSize: v.number(),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db.get(args.roomId);
        if (!room) return { error: 'Room not found' };

        // Verify host authorization
        if (room.hostTokenHash) {
            if (!args.hostToken) return { error: 'Host token required' };
            const providedHash = await getHostTokenHash(args.hostToken);
            if (providedHash !== room.hostTokenHash) return { error: 'Invalid host token' };
        } else {
            // Legacy room: fall back to sessionId check
            if (room.hostPlayerId !== args.sessionId) return { error: 'Only host can update grid size' };
        }

        if (room.status !== 'lobby') return { error: 'Cannot change grid size after game started' };

        const validSizes = [5, 10, 20, 30];
        if (!validSizes.includes(args.gridSize)) return { error: 'Invalid grid size' };

        await ctx.db.patch(args.roomId, { gridSize: args.gridSize, updatedAt: Date.now() });
        return { success: true };
    },
});