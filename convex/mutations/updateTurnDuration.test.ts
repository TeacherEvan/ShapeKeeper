import { describe, expect, it, vi } from 'vitest';
import { updateTurnDuration } from './updateTurnDuration';

interface MockRoom {
    _id: string;
    hostPlayerId: string;
    hostTokenHash?: string;
    status: string;
    turnDurationMs?: number;
}

function makeDb(room: MockRoom | null = null) {
    const store = new Map<string, any>();
    const patches: any[] = [];
    return {
        get: async () => room,
        query: vi.fn((tableName?: string) => {
            if (tableName === 'rateLimits') {
                return {
                    withIndex: (_idx: string, buildFilter: any) => {
                        const filterArgs: any = {};
                        buildFilter({
                            eq: (k: string, v: any) => {
                                filterArgs[k] = v;
                            },
                        });
                        return {
                            unique: async () => {
                                for (const row of store.values()) {
                                    if (row.key === filterArgs.key) return row;
                                }
                                return null;
                            },
                        };
                    },
                };
            }
            return {
                withIndex: () => ({ first: async () => room }),
            };
        }),
        insert: vi.fn(async (table: string, doc: any) => {
            const id = `${table}_id_${store.size + 1}`;
            store.set(id, { _id: id, ...doc });
            return id;
        }),
        patch: vi.fn(async (id: string, patch: any) => {
            patches.push({ id, ...patch });
            const row = store.get(id);
            if (row) Object.assign(row, patch);
            return true;
        }),
        __patches: patches,
    } as any;
}

describe('mutations/updateTurnDuration', () => {
    it('returns error when room not found', async () => {
        const db = makeDb(null);
        const ctx: any = { db };
        const res = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
            turnDurationMs: 15000,
        });
        expect(res).toEqual({ error: 'Room not found' });
    });

    it('returns error when caller is not the host', async () => {
        const room: MockRoom = {
            _id: 'r1',
            hostPlayerId: 'host-1',
            status: 'lobby',
        };
        const db = makeDb(room);
        const ctx: any = { db };
        const res = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'guest',
            turnDurationMs: 15000,
        });
        expect(res).toEqual({ error: 'Only host can update turn duration' });
    });

    it('returns error when duration is invalid', async () => {
        const room: MockRoom = {
            _id: 'r1',
            hostPlayerId: 'host-1',
            status: 'lobby',
        };
        const db = makeDb(room);
        const ctx: any = { db };
        const res = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'host-1',
            turnDurationMs: 99999,
        });
        expect(res).toEqual({ error: 'Invalid turn duration' });
    });

    it('updates turn duration successfully', async () => {
        const room: MockRoom = {
            _id: 'r1',
            hostPlayerId: 'host-1',
            status: 'lobby',
        };
        const db = makeDb(room);
        const ctx: any = { db };
        const res = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'host-1',
            turnDurationMs: 30000,
        });
        expect(res).toEqual({ success: true });
        expect(db.patch).toHaveBeenCalledWith('r1', {
            turnDurationSeconds: 30,
            turnDurationMs: 30000,
            updatedAt: expect.any(Number),
        });
    });

    it('rejects unsupported seconds duration (e.g. 20s)', async () => {
        const room: MockRoom = {
            _id: 'r1',
            hostPlayerId: 'host-1',
            status: 'lobby',
        };
        const db = makeDb(room);
        const ctx: any = { db };
        const res = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'host-1',
            turnDurationSeconds: 20,
        });
        expect(res).toEqual({ error: 'Invalid turn duration' });
    });

    it('accepts valid seconds duration (e.g. 15s) and stores both seconds and ms', async () => {
        const room: MockRoom = {
            _id: 'r1',
            hostPlayerId: 'host-1',
            status: 'lobby',
        };
        const db = makeDb(room);
        const ctx: any = { db };
        const res = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'host-1',
            turnDurationSeconds: 15,
        });
        expect(res).toEqual({ success: true });
        expect(db.patch).toHaveBeenCalledWith('r1', {
            turnDurationSeconds: 15,
            turnDurationMs: 15000,
            updatedAt: expect.any(Number),
        });
    });

    it('rate limits after 6 calls within 5s', async () => {
        const room: MockRoom = {
            _id: 'r1',
            hostPlayerId: 'spammer',
            status: 'lobby',
        };
        const db = makeDb(room);
        const ctx: any = { db };

        for (let i = 0; i < 6; i++) {
            const res = await (updateTurnDuration as any)._handler(ctx, {
                roomId: 'r1',
                sessionId: 'spammer',
                turnDurationMs: 15000,
            });
            expect(res.error).toBeUndefined();
        }

        const blocked = await (updateTurnDuration as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'spammer',
            turnDurationMs: 15000,
        });
        expect(blocked).toEqual({
            error: 'Rate limit exceeded',
            resetMs: expect.any(Number),
        });
    });
});
