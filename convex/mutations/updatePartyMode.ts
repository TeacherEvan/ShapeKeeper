import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getHostTokenHash } from '../utils/roomUtils';

export const updatePartyMode = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        partyMode: v.boolean(),
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
            if (room.hostPlayerId !== args.sessionId) return { error: 'Only host can update party mode' };
        }

        if (room.status !== 'lobby') return { error: 'Cannot change party mode after game started' };

        await ctx.db.patch(args.roomId, { partyMode: args.partyMode, updatedAt: Date.now() });
        return { success: true };
    },
});