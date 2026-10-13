import { clearRoomBoard } from './state';
import { armTurnTimer } from './turnTimer';
import { checkRateLimit } from '../rateLimit';

export async function requestRematchHandler(ctx: any, args: any) {
    const rl = await checkRateLimit(ctx, 'requestRematch', args.sessionId);
    if (!rl.allowed) return { error: 'Rate limit exceeded', resetMs: rl.resetMs };

    const room = await ctx.db.get(args.roomId);
    if (!room) return { error: 'Room not found' };
    if (room.status !== 'finished') return { error: 'Game is not finished' };

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
    if (!players.some((p: any) => p.sessionId === args.sessionId)) {
        return { error: 'Not a player in this room' };
    }

    const votes = new Set<string>(room.rematchVotes ?? []);
    votes.add(args.sessionId);
    const connected = players.filter((p: any) => p.isConnected);
    const everyoneVoted = connected.length >= 2 && connected.every((p: any) => votes.has(p.sessionId));

    if (!everyoneVoted) {
        await ctx.db.patch(args.roomId, { rematchVotes: [...votes], updatedAt: Date.now() });
        return { success: true, started: false, votes: votes.size, needed: connected.length };
    }

    await clearRoomBoard(ctx, args.roomId, { resetReady: false });
    const now = Date.now();
    await armTurnTimer(ctx, args.roomId, room, now, {
        status: 'playing',
        currentPlayerIndex: 0,
        rematchVotes: [],
        updatedAt: now,
    });
    return { success: true, started: true };
}
