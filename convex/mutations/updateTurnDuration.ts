import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getHostTokenHash } from '../utils/roomUtils';
import { validateTurnDurationSeconds } from '../games/turn_duration';
import { ALLOWED_TURN_DURATIONS_MS } from '../games/turnTimer';
import { checkRateLimit } from '../rate_limit';

// Update the per-turn "Allowed Time" countdown (host only, lobby state only).
// seconds = 0 means "no limit"; otherwise a whole number of seconds.
export const updateTurnDuration = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
        turnDurationSeconds: v.optional(v.number()),
        turnDurationMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const rl = await checkRateLimit(ctx, 'updateTurnDuration', args.sessionId);
        if (!rl.allowed) return { error: 'Rate limit exceeded', resetMs: rl.resetMs };

        const room = await ctx.db.get(args.roomId);
        if (!room) return { error: 'Room not found' };

        // Verify host authorization (same pattern as updateGridSize)
        if (room.hostTokenHash) {
            if (!args.hostToken) return { error: 'Host token required' };
            const providedHash = await getHostTokenHash(args.hostToken);
            if (providedHash !== room.hostTokenHash) return { error: 'Invalid host token' };
        } else {
            // Legacy room: fall back to sessionId check
            if (room.hostPlayerId !== args.sessionId) return { error: 'Only host can update turn duration' };
        }

        if (room.status !== 'lobby') return { error: 'Cannot change turn duration after game started' };

        let seconds = args.turnDurationSeconds;
        let ms = args.turnDurationMs;

        const patchData: Record<string, any> = {
            updatedAt: Date.now(),
        };

        if (seconds !== undefined) {
            const validation = validateTurnDurationSeconds(seconds);
            if (!validation.ok) return { error: validation.error };
            seconds = validation.seconds;
            patchData.turnDurationSeconds = seconds;
            if (ms === undefined) {
                ms = (seconds ?? 0) * 1000;
                patchData.turnDurationMs = ms;
            }
        }

        if (ms !== undefined) {
            if (seconds === undefined && !(ALLOWED_TURN_DURATIONS_MS as readonly number[]).includes(ms)) {
                return { error: 'Invalid turn duration' };
            }
            patchData.turnDurationMs = ms;
        }

        if (seconds === undefined && ms === undefined) {
            return { error: 'Must provide turnDurationSeconds or turnDurationMs' };
        }

        await ctx.db.patch(args.roomId, patchData);
        return { success: true };
    },
});
