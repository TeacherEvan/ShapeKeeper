import { internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { isTurnExpired } from '../games/turn_deadline';
import { resolveTurnDurationMs } from '../games/turn_duration';

/**
 * Cron entry point: sweep every active room's turn deadline.
 *
 * Runs every 5 seconds (see convex/crons.ts). For each 'playing' room
 * whose Allowed Time has expired, enqueues internal.games.expireTurn.
 * This guarantees authoritative random-line placement per AGENTS.md,
 * eliminating the competing skip-only race condition.
 */
export const sweepAllTurnDeadlines = internalMutation({
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

      await ctx.scheduler.runAfter(0, internal.games.expireTurn, {
        roomId: room._id,
        expectedTurnEndTime: room.turnEndTime,
      });
      swept += 1;
    }

    return { scanned: playingRooms.length, swept };
  },
});
