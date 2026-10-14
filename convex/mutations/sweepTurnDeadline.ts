import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

/**
 * Sweep one room's turn deadline. Called by the cron (every 5s) for each
 * active room so an expired turn is skipped even when the timed-out
 * player's client is frozen, disconnected, or hostile — the gap the
 * drawLine-time enforcement cannot close on its own.
 *
 * Idempotent: enforceTurnDeadline re-checks isTurnExpired() against the
 * CURRENT room state and only acts when the deadline has actually passed.
 * Safe to run concurrently against the same room (Convex serialises
 * mutations per document, and a second invocation after a skip sees a
 * fresh, unexpired turnEndTime).
 *
 * Intentionally internal: clients never call this directly.
 */
export const sweepTurnDeadline = internalMutation({
  args: {
    roomId: v.id('rooms'),
  },
  handler: async (ctx: any, args: { roomId: any }) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return { skipped: false, reason: 'room_not_found' };
    if (room.status !== 'playing') return { skipped: false, reason: 'not_playing' };

    const { enforceTurnDeadline } = await import('../services/turnDeadlineEnforcer');
    const result = await enforceTurnDeadline(ctx, room, args.roomId);
    if (!result) return { skipped: false, reason: 'not_expired' };

    return {
      skipped: true,
      skippedPlayerIndex: result.skippedPlayerIndex,
      skippedPlayerName: result.skippedPlayerName,
      nextPlayerIndex: result.nextPlayerIndex,
    };
  },
});
