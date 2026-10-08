import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getHostTokenHash } from '../utils/roomUtils';
import { validateTurnDurationSeconds } from '../games/turn_duration';

// Update the per-turn "Allowed Time" countdown (host only, lobby state only).
// seconds = 0 means "no limit"; otherwise a whole number of seconds.
export const updateTurnDuration = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        turnDurationSeconds: v.number(),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db.get(args.roomId);
        if (!room) return { error: 'Room not found' };

        // Verify host authorization (same pattern as updateGridSize)
        if (room.hostTokenHash) {
            if (!args.hostToken) return { error: 'Host token required' };
            const providedHash = await getHostTokenHash(args.hostToken);
            if (providedHash !== room.hostTokenHash) return { error: 'Invalid host token' };
        } else {
            if (room.hostPlayerId !== args.sessionId) return { error: 'Only host can update turn duration' };
        }

        if (room.status !== 'lobby') return { error: 'Cannot change turn duration after game started' };

        const validation = validateTurnDurationSeconds(args.turnDurationSeconds);
        if (!validation.ok) return { error: validation.error };

        await ctx.db.patch(args.roomId, {
            turnDurationSeconds: validation.seconds,
            updatedAt: Date.now(),
        });
        return { success: true, turnDurationSeconds: validation.seconds };
    },
});
