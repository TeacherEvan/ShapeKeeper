import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getHostTokenHash } from '../utils/roomUtils';
import { ALLOWED_TURN_DURATIONS_MS } from '../games/turnTimer';

export const updateTurnDuration = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        turnDurationMs: v.number(),
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
            if (room.hostPlayerId !== args.sessionId) return { error: 'Only host can update turn duration' };
        }

        if (room.status !== 'lobby') return { error: 'Cannot change turn duration after game started' };

        if (!(ALLOWED_TURN_DURATIONS_MS as readonly number[]).includes(args.turnDurationMs)) {
            return { error: 'Invalid turn duration' };
        }

        await ctx.db.patch(args.roomId, { turnDurationMs: args.turnDurationMs, updatedAt: Date.now() });
        return { success: true };
    },
});
