import { internalMutation } from '../_generated/server';
import { cancelTurnTimer } from '../games/turnTimer';
import { log } from '../log';
import { pruneExpiredRateLimits } from '../rate_limit';

const STALE_LOBBY_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const STALE_MATCH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for abandoned playing/finished rooms

async function deleteRoomCascade(ctx: any, room: any) {
  await cancelTurnTimer(ctx, room);

  const players = await ctx.db
    .query('players')
    .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
    .collect();
  for (const player of players) {
    await ctx.db.delete(player._id);
  }

  const lines = await ctx.db
    .query('lines')
    .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
    .collect();
  for (const line of lines) {
    await ctx.db.delete(line._id);
  }

  const squares = await ctx.db
    .query('squares')
    .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
    .collect();
  for (const square of squares) {
    await ctx.db.delete(square._id);
  }

  await ctx.db.delete(room._id);
}

export const sweepStaleLobbies = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const lobbyCutoff = now - STALE_LOBBY_TTL_MS;
    const matchCutoff = now - STALE_MATCH_TTL_MS;

    const statusTtls: Array<{ status: 'lobby' | 'playing' | 'finished'; cutoff: number }> = [
      { status: 'lobby', cutoff: lobbyCutoff },
      { status: 'playing', cutoff: matchCutoff },
      { status: 'finished', cutoff: matchCutoff },
    ];

    let swept = 0;

    for (const { status, cutoff } of statusTtls) {
      const rooms = await ctx.db
        .query('rooms')
        .withIndex('by_status', (q: any) => q.eq('status', status))
        .collect();

      for (const room of rooms as any[]) {
        if (room.status !== status) continue;
        if ((room.updatedAt ?? 0) > cutoff) continue;

        await deleteRoomCascade(ctx, room);
        swept += 1;

        log('[sweepStaleLobbies] Reaped stale room', {
          roomId: room._id,
          roomCode: room.roomCode,
          status: room.status,
          idleMs: now - (room.updatedAt ?? 0),
        });
      }
    }

    await pruneExpiredRateLimits(ctx);

    return { swept };
  },
});
