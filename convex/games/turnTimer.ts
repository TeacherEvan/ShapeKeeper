import { internal } from '../_generated/api';

export const ALLOWED_TURN_DURATIONS_MS = [0, 10000, 15000, 30000, 60000] as const;
export const DEFAULT_TURN_DURATION_MS = 15000;

/** Unknown/legacy values => 0 (Off), so rooms created before this feature stay untimed. */
export function normalizeTurnDuration(value: unknown): number {
    return typeof value === 'number' && (ALLOWED_TURN_DURATIONS_MS as readonly number[]).includes(value)
        ? value
        : 0;
}

/** Patch the room and (re)arm the deadline + scheduled expiry. Duration 0 clears both. */
export async function armTurnTimer(
    ctx: any,
    roomId: any,
    room: any,
    now: number,
    extraPatch: Record<string, unknown> = {}
): Promise<void> {
    const duration = normalizeTurnDuration(room.turnDurationMs);
    if (duration === 0) {
        await ctx.db.patch(roomId, { ...extraPatch, turnStartTime: undefined, turnEndTime: undefined });
        return;
    }
    const turnEndTime = now + duration;
    await ctx.db.patch(roomId, { ...extraPatch, turnStartTime: now, turnEndTime });
    await ctx.scheduler.runAt(turnEndTime, internal.games.expireTurn, {
        roomId,
        expectedTurnEndTime: turnEndTime,
    });
}

/** Scheduled at turnEndTime. No-op if the turn already moved on (stale schedule). */
export async function expireTurnHandler(ctx: any, args: any): Promise<void> {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== 'playing' || room.turnEndTime !== args.expectedTurnEndTime) return;
    const players = (
        await ctx.db.query('players').withIndex('by_room', (q: any) => q.eq('roomId', args.roomId)).collect()
    ).sort((a: any, b: any) => a.playerIndex - b.playerIndex);
    if (players.length < 2) return;
    const now = Date.now();
    await armTurnTimer(ctx, args.roomId, room, now, {
        currentPlayerIndex: (room.currentPlayerIndex + 1) % players.length,
        updatedAt: now,
    });
}
