import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { isTurnExpired } from '../games/turn_deadline';
import { resolveTurnDurationMs } from '../games/turn_duration';

/**
 * Cron entry point: sweep every active room's turn deadline.
 *
 * Runs every 5 seconds (see convex/crons.ts). For each 'playing' room
 * with an armed turnEndTime, enqueues the per-room sweep. The per-room
 * mutation is idempotent, so overlap between runs is harmless.
 *
 * Uses the by_status index to only touch rooms that are actually playing.
 */
export const sweepAllTurnDeadlines = mutation({
  args: {},
  handler: async (ctx: any) => {
    const playingRooms = await ctx.db
      .query('rooms')
      .withIndex('by_status', (q: any) => q.eq('status', 'playing'))
      .collect();

    let swept = 0;
    for (const room of playingRooms) {
      if (!isTurnExpired(room)) continue;
      if (resolveTurnDurationMs(room) <= 0) continue; // no limit: never armed
      // Reference by module path. The generated api types will catch this
      // after the next deploy; the cast keeps it valid locally.
      const sweepRef = 'mutations/sweepTurnDeadline:sweepTurnDeadline' as any;
      await ctx.scheduler.runAfter(0, sweepRef, {
        roomId: room._id,
      });
      swept += 1;
    }

    return { scanned: playingRooms.length, swept };
  },
});
