import { describe, expect, it, vi } from 'vitest';
import { drawLineHandler } from './draw';

/**
 * The authoritative duration field is `turnDurationMs` (schema.ts:30).
 * `resolveTurnDurationMs()` from the legacy turn_duration.js reads the old
 * `turnDurationSeconds` field and silently falls back to 10s, so a room with
 * the timer Off could still be treated as timed on a late draw.
 */

function makeCtx(roomDoc: any) {
    const inserts: Array<{ table: string; doc: any }> = [];
    const players = [
        { _id: 'p1', sessionId: 's1', playerIndex: 0, name: 'A', score: 0 },
        { _id: 'p2', sessionId: 's2', playerIndex: 1, name: 'B', score: 0 },
    ];
    const ctx: any = {
        db: {
            get: vi.fn(async (id: any) => (id === roomDoc._id ? roomDoc : null)),
            insert: vi.fn(async (table: string, doc: any) => {
                inserts.push({ table, doc });
                return `${table}-1`;
            }),
            patch: vi.fn(async () => true),
            query: (table: string) => ({
                withIndex: () => ({
                    collect: vi.fn(async () => (table === 'players' ? players : [])),
                    first: vi.fn(async () => null),
                    unique: vi.fn(async () => null),
                }),
            }),
        },
        scheduler: { runAt: vi.fn(), runAfter: vi.fn() },
    };
    return { ctx, inserts };
}

const expiredRoom = (turnDurationMs: number) => ({
    _id: 'r1',
    status: 'playing',
    currentPlayerIndex: 0,
    gridSize: 5,
    turnEndTime: 1000,
    turnDurationMs,
});

describe('drawLine late-move expiry uses turnDurationMs', () => {
    it('does not auto-draw a line when the timer is Off', async () => {
        const { ctx, inserts } = makeCtx(expiredRoom(0));

        const result = await drawLineHandler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
            lineKey: 'ignored',
        });

        expect(inserts.filter((i) => i.table === 'lines')).toHaveLength(0);
        expect(result).toEqual({ error: 'Turn deadline expired' });
    });

    it('auto-draws a line when a duration is configured', async () => {
        const { ctx, inserts } = makeCtx(expiredRoom(15000));

        const result = await drawLineHandler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
            lineKey: 'ignored',
        });

        expect(inserts.filter((i) => i.table === 'lines')).toHaveLength(1);
        expect(result).toMatchObject({ turnExpired: true });
    });
});
