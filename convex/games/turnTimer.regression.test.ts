import { describe, expect, it, vi } from 'vitest';
import { applyLineForPlayer } from './draw';
import { expireTurnHandler } from './turnTimer';

/**
 * Regression gate for the 2026-11-23 Free-tier burn.
 *
 * `rooms.lastTurnClientSentAt` is `v.optional(v.number())`: Convex accepts an
 * absent field but REJECTS `null`. The expiry path calls applyLineForPlayer
 * without a clientSentAt, so writing `clientSentAt ?? null` made every
 * expireTurn transaction roll back and left the deadline stuck in the past.
 */

function makeCtx() {
    const patches: Array<Record<string, unknown>> = [];
    const ctx: any = {
        db: {
            get: vi.fn(async () => null),
            insert: vi.fn(async () => 'line-1'),
            patch: vi.fn(async (_id: any, patch: Record<string, unknown>) => {
                patches.push(patch);
            }),
            query: () => ({
                withIndex: () => ({
                    collect: vi.fn(async () => []),
                    first: vi.fn(async () => null),
                }),
            }),
        },
        scheduler: { runAt: vi.fn(), runAfter: vi.fn() },
    };
    return { ctx, patches };
}

const room = {
    _id: 'r1',
    status: 'playing',
    turnEndTime: 1000,
    turnDurationMs: 15000,
    currentPlayerIndex: 0,
    gridSize: 5,
};

const players = [
    { _id: 'p1', playerIndex: 0, name: 'A', score: 0 },
    { _id: 'p2', playerIndex: 1, name: 'B', score: 0 },
];

function roomPatchOf(patches: Array<Record<string, unknown>>) {
    const patch = patches.find((p) => 'turnEndTime' in p);
    if (!patch) throw new Error('no room timing patch written');
    return patch;
}

describe('expireTurn writes only schema-valid room timing fields', () => {
    it('omits lastTurnClientSentAt when a scheduled expiry has no client timestamp', async () => {
        const { ctx, patches } = makeCtx();

        // No 5th argument — exactly how expireTurnHandler calls it.
        await applyLineForPlayer(ctx, room, players[0], players, '0,0-0,1');

        const patch = roomPatchOf(patches);
        expect(Object.values(patch)).not.toContain(null);
        expect('lastTurnClientSentAt' in patch).toBe(false);
        expect(typeof patch.turnEndTime).toBe('number');
    });

    it('keeps the client timestamp when drawLine supplies one', async () => {
        const { ctx, patches } = makeCtx();

        await applyLineForPlayer(ctx, room, players[0], players, '0,0-0,1', 1234);

        expect(roomPatchOf(patches).lastTurnClientSentAt).toBe(1234);
    });

    it('calls applyLineForPlayer through expireTurnHandler without a client timestamp', async () => {
        const { ctx, patches } = makeCtx();
        (ctx.db.get as any).mockImplementation(async () => room);
        (ctx.db.query as any) = (table: string) => ({
            withIndex: () => ({
                collect: vi.fn(async () => (table === 'players' ? players : [])),
                first: vi.fn(async () => null),
            }),
        });

        await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 1000 });

        const patch = roomPatchOf(patches);
        expect(Object.values(patch)).not.toContain(null);
        expect('lastTurnClientSentAt' in patch).toBe(false);
    });
});

function ctxWithPlayers(roomDoc: any, roomPlayers: any[]) {
    const { ctx, patches } = makeCtx();
    (ctx.db.get as any).mockImplementation(async () => roomDoc);
    (ctx.db.query as any) = (table: string) => ({
        withIndex: () => ({
            collect: vi.fn(async () => (table === 'players' ? roomPlayers : [])),
            first: vi.fn(async () => null),
        }),
    });
    return { ctx, patches };
}

describe('expireTurn leaves no stale deadline when it cannot act', () => {
    it('clears the deadline when the room has fewer than 2 players', async () => {
        const { ctx, patches } = ctxWithPlayers(room, [players[0]]);

        await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 1000 });

        expect(patches).toHaveLength(1);
        expect(patches[0].turnEndTime).toBeUndefined();
        expect(patches[0].turnStartTime).toBeUndefined();
    });

    it('clears the deadline when currentPlayerIndex points past the player list', async () => {
        const { ctx, patches } = ctxWithPlayers({ ...room, currentPlayerIndex: 9 }, players);

        await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 1000 });

        expect(patches).toHaveLength(1);
        expect(patches[0].turnEndTime).toBeUndefined();
    });

    it('does not touch a newer deadline when the scheduled expiry is stale', async () => {
        const { ctx, patches } = ctxWithPlayers({ ...room, turnEndTime: 2000 }, players);

        await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 1000 });

        expect(patches).toHaveLength(0);
    });
});
