import { describe, expect, it, vi } from 'vitest';
import { updatePlayer } from './updatePlayer';

interface MockPlayer {
    _id: string;
    name?: string;
    color?: string;
}

function makeDb(player: MockPlayer | null = null) {
    const store = new Map<string, any>();
    const patches: any[] = [];
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
            patches.push({ id, ...patch });
            const row = store.get(id);
            if (row) Object.assign(row, patch);
            return true;
        }),
        __patches: patches,
    } as any;
}

describe('mutations/updatePlayer', () => {
    it('returns error when player not found', async () => {
        const db = makeDb(null);
        const ctx: any = { db };
        const res = await (updatePlayer as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
            name: 'NewName',
        });
        expect(res).toEqual({ error: 'Player not found in room' });
    });

    it('updates player name and color', async () => {
        const player = { _id: 'p1', name: 'OldName', color: '#000000' };
        const db = makeDb(player);
        const ctx: any = { db };

        const res = await (updatePlayer as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
            name: 'NewName',
            color: '#ffffff',
        });
        expect(res).toEqual({ success: true });
        expect(db.patch).toHaveBeenCalledWith('p1', {
            name: 'NewName',
            color: '#ffffff',
        });
    });

    it('rate limits after 10 calls within 5s', async () => {
        const player = { _id: 'p1', name: 'OldName' };
        const db = makeDb(player);
        const ctx: any = { db };

        for (let i = 0; i < 10; i++) {
            const res = await (updatePlayer as any)._handler(ctx, {
                roomId: 'r1',
                sessionId: 'spammer',
                name: `Name${i}`,
            });
            expect(res.error).toBeUndefined();
        }

        const blocked = await (updatePlayer as any)._handler(ctx, {
            roomId: 'r1',
            sessionId: 'spammer',
            name: 'Name10',
        });
        expect(blocked).toEqual({
            error: 'Rate limit exceeded',
            resetMs: expect.any(Number),
        });
    });
});
