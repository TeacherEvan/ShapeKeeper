import { describe, expect, it, vi } from 'vitest';
import { toggleReady } from './toggleReady';

interface MockPlayer {
    _id: string;
    isReady: boolean;
}

function makeDb(player: MockPlayer | null = null) {
    const store = new Map<string, any>();
    return {
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
                withIndex: () => ({ first: async () => player }),
            };
        }),
        insert: vi.fn(async (table: string, doc: any) => {
            const id = `${table}_id_${store.size + 1}`;
            store.set(id, { _id: id, ...doc });
            return id;
        }),
        patch: vi.fn(async (id: string, patch: any) => {
            const row = store.get(id);
            if (row) Object.assign(row, patch);
            return true;
        }),
    } as any;
}

describe('mutations/toggleReady', () => {
    it('returns error when player not found', async () => {
        const db = makeDb(null);
        const ctx: any = { db };
        const res = await (toggleReady as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });
        expect(res).toEqual({ error: 'Player not found' });
    });

    it('toggles ready state and updates room timestamp', async () => {
        const player = { _id: 'p1', isReady: false };
        const db = makeDb(player);
        const ctx: any = { db };

        const res = await (toggleReady as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });
        expect(res).toEqual({ isReady: true });
        expect(db.patch).toHaveBeenCalledWith('p1', { isReady: true });
        expect(db.patch).toHaveBeenCalledWith(
            'r1',
            expect.objectContaining({ updatedAt: expect.any(Number) })
        );
    });

    it('rate limits after 10 calls within 5s', async () => {
        const player = { _id: 'p1', isReady: false };
        const db = makeDb(player);
        const ctx: any = { db };

        for (let i = 0; i < 10; i++) {
            const res = await (toggleReady as any)._handler(ctx, {
                roomId: 'r1',
                sessionId: 'spammer',
            });
            expect(res.error).toBeUndefined();
        }

        const blocked = await (toggleReady as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'spammer',
        });
        expect(blocked).toEqual({
            error: 'Rate limit exceeded',
            resetMs: expect.any(Number),
        });
    });
});
