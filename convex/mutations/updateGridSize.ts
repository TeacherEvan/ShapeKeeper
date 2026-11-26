import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { isAuthorisedHostAsync } from '../auth/token';

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

        // Verify host authorization (sessionId + constant-time hostTokenHash)
        if (room.hostPlayerId !== args.sessionId) {
            return { error: 'Only host can update grid size' };
        }
        if (room.hostTokenHash) {
            if (!args.hostToken) return { error: 'Host token required' };
            if (!(await isAuthorisedHostAsync(room, args.sessionId, args.hostToken))) {
                return { error: 'Invalid host token' };
            }
        }

        if (room.status !== 'lobby') return { error: 'Cannot change grid size after game started' };

        const validSizes = [5, 10, 20, 30];
        if (!validSizes.includes(args.gridSize)) return { error: 'Invalid grid size' };

        await ctx.db.patch(args.roomId, { gridSize: args.gridSize, updatedAt: Date.now() });
        return { success: true };
    },
});