import { mutation } from '../_generated/server';
import { log } from '../log';

/**
 * Reap abandoned lobbies.
 *
 * A lobby whose `updatedAt` is older than the TTL has seen no activity —
 * no joins, no leaves, no settings changes — for that long. The common
 * cause is a host who closed the tab: the room sits at `status: 'lobby'`
 * forever and haunts everyone's JOIN LOBBY browser. The client fires a
 * best-effort leave on `beforeunload` (convex-client.js), but that can be
 * dropped when a tab dies hard — this sweep is the backstop.
 *
 * The TTL is deliberately generous: a host legitimately waits for friends
 * to get ready, and every join bumps `updatedAt`, so only a genuinely
 * dead lobby (zero activity for hours) is reaped. In-progress matches are
 * never touched (status !== 'lobby').
 */
const STALE_LOBBY_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export const sweepStaleLobbies = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_LOBBY_TTL_MS;

    const rooms = await ctx.db
      .query('rooms')
      .withIndex('by_status', (q: any) => q.eq('status', 'lobby'))
      .collect();
    let swept = 0;

    for (const room of rooms as any[]) {
      if (room.status !== 'lobby') continue;
      if ((room.updatedAt ?? 0) > cutoff) continue;

      const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
        .collect();

      for (const player of players) {
        await ctx.db.delete(player._id);
      }
      await ctx.db.delete(room._id);
      swept += 1;

      log('[sweepStaleLobbies] Reaped abandoned lobby', {
        roomId: room._id,
        roomCode: room.roomCode,
        idleMs: Date.now() - (room.updatedAt ?? 0),
      });
    }

    return { swept };
  },
});
