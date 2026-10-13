import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { checkRateLimit } from '../rateLimit';

export const updatePlayer = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        name: v.optional(v.string()),
        color: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const rl = await checkRateLimit(ctx, 'updatePlayer', args.sessionId);
        if (!rl.allowed) return { error: 'Rate limit exceeded', resetMs: rl.resetMs };

        const player = await ctx.db
            .query('players')
            .withIndex('by_room_and_session', (q: any) => q.eq('roomId', args.roomId).eq('sessionId', args.sessionId))
            .first();

        if (!player) return { error: 'Player not found in room' };

        const updates: Record<string, unknown> = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.color !== undefined) updates.color = args.color;

        if (Object.keys(updates).length > 0) {
            await ctx.db.patch(player._id, updates);
        }

        return { success: true };
    },
});