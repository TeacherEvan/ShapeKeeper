import { internal } from '../_generated/api';
import { applyLineForPlayer } from './draw';
import { getAllLineKeys, pickRandomFreeLine } from './shared';

export const ALLOWED_TURN_DURATIONS_MS = [0, 10000, 15000, 30000, 60000] as const;
export const DEFAULT_TURN_DURATION_MS = 15000;

/** Unknown/legacy values => 0 (Off), so rooms created before this feature stay untimed. */
export function normalizeTurnDuration(value: unknown): number {
    return typeof value === 'number' && (ALLOWED_TURN_DURATIONS_MS as readonly number[]).includes(value)
        ? value
        : 0;
}

/** Cancel any previously scheduled turn-expiry job for a room. */
export async function cancelTurnTimer(ctx: any, room: any): Promise<void> {
    if (room?.turnTimerJobId && typeof ctx.scheduler?.cancel === 'function') {
        try {
            await ctx.scheduler.cancel(room.turnTimerJobId);
        } catch {
            // Job already fired or cancelled
        }
    }
}

/** Patch the room and (re)arm the deadline + scheduled expiry. Duration 0 clears both. */
export async function armTurnTimer(
    ctx: any,
    roomId: any,
    room: any,
    now: number,
    extraPatch: Record<string, unknown> = {}
): Promise<void> {
    await cancelTurnTimer(ctx, room);
    const duration = normalizeTurnDuration(room.turnDurationMs);
    if (duration === 0) {
        const clearPatch: Record<string, unknown> = {
            ...extraPatch,
            turnStartTime: undefined,
            turnEndTime: undefined,
        };
        if (room?.turnTimerJobId) clearPatch.turnTimerJobId = undefined;
        await ctx.db.patch(roomId, clearPatch);
        return;
    }
    const turnEndTime = now + duration;
    const jobId = await ctx.scheduler.runAt(turnEndTime, internal.games.expireTurn, {
        roomId,
        expectedTurnEndTime: turnEndTime,
    });
    const patchData: Record<string, unknown> = {
        ...extraPatch,
        turnStartTime: now,
        turnEndTime,
    };
    if (jobId !== undefined) patchData.turnTimerJobId = jobId;
    await ctx.db.patch(roomId, patchData);
}

/** Scheduled at turnEndTime. No-op if the turn already moved on (stale schedule). */
export async function expireTurnHandler(ctx: any, args: any): Promise<void> {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== 'playing' || room.turnEndTime !== args.expectedTurnEndTime) return;
    const players = (
        await ctx.db
            .query('players')
            .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
            .collect()
    ).sort((a: any, b: any) => a.playerIndex - b.playerIndex);
    const currentPlayer = players[room.currentPlayerIndex];
    if (players.length < 2 || !currentPlayer) {
        // A 'playing' room with no opponent or an invalid turn index can never
        // expire. Clear its deadline so isTurnExpired() goes false; leaving a
        // stale turnEndTime behind would strand the room in an expired state.
        await ctx.db.patch(args.roomId, {
            turnStartTime: undefined,
            turnEndTime: undefined,
            updatedAt: Date.now(),
        });
        return;
    }

    const drawnLines = await ctx.db
        .query('lines')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
    const drawnKeys = new Set<string>(drawnLines.map((l: any) => String(l.lineKey)));

    const allKeys = getAllLineKeys(room.gridSize);
    const chosenLine = pickRandomFreeLine(allKeys, drawnKeys);

    if (chosenLine) {
        await applyLineForPlayer(ctx, room, currentPlayer, players, chosenLine);
    } else {
        // Board has no free lines left — finish cleanly instead of re-arming infinitely.
        await cancelTurnTimer(ctx, room);
        await ctx.db.patch(args.roomId, {
            status: 'finished',
            turnStartTime: undefined,
            turnEndTime: undefined,
            turnTimerJobId: undefined,
            updatedAt: Date.now(),
        });
    }
}
