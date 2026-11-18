import { describe, expect, it, vi } from 'vitest';
import { joinRoom } from './joinRoom';

interface MockRoom {
    _id: string;
    roomCode: string;
    status: string;
    passcode?: string;
}

interface MockPlayer {
    _id: string;
}

interface MakeDbOptions {
    room?: MockRoom | null;
    players?: MockPlayer[];
}

function makeDb(options: MakeDbOptions = {}) {
    const { room = null, players = [] } = options;
    const calls: any = { inserts: [], patches: [] };
    const store = new Map<string, any>();
    return {
        query: vi.fn((tableName: string) => {
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
            if (tableName === 'rooms') {
                return { withIndex: () => ({ first: async () => room }) } as any;
            }
            if (tableName === 'players') {
                return {
                    withIndex: () => ({ first: async () => null, collect: async () => players }),
                } as any;
            }
            return { withIndex: () => ({ first: async () => null, collect: async () => [] }) } as any;
        }),
        insert: vi.fn(async (table: string, doc: any) => {
            const id = `${table}_id_${calls.inserts.length + 1}`;
            const row = { _id: id, ...doc };
            store.set(id, row);
            calls.inserts.push({ table, doc });
            return id;
        }),
        patch: vi.fn(async (id: string, patch: any) => {
            const row = store.get(id);
            if (row) Object.assign(row, patch);
            return true;
        }),
        __calls: calls,
    } as any;
}

describe('mutations/joinRoom', () => {
    it('returns error when room not found', async () => {
        const db = makeDb({ room: null });
        const ctx: any = { db };

        const res = await (joinRoom as any)._handler(ctx, {
            roomCode: 'NOPE',
            sessionId: 's1',
            playerName: 'A',
        });
        expect(res).toEqual({ error: 'Room not found' });
    });

    it('adds a new player when space available', async () => {
        const room: MockRoom = { _id: 'room-1', roomCode: 'ABC123', status: 'lobby' };
        const db = makeDb({ room, players: [] });
        const ctx: any = { db };

        const res = await (joinRoom as any)._handler(ctx, {
            roomCode: 'ABC123',
            sessionId: 's2',
            playerName: 'B',
        });

        expect(res.roomId).toBe('room-1');
        expect(res.playerId).toBeDefined();
        expect(db.__calls.inserts.some((i: any) => i.table === 'players')).toBeTruthy();
    });

    it('returns error when room full', async () => {
        const room: MockRoom = { _id: 'room-1', roomCode: 'ABC123', status: 'lobby' };
        const players: MockPlayer[] = new Array(6).fill(0).map((_, i) => ({ _id: `p${i}` }));
        const db = makeDb({ room, players });
        const ctx: any = { db };

        const res = await (joinRoom as any)._handler(ctx, {
            roomCode: 'ABC123',
            sessionId: 'sX',
            playerName: 'TooMany',
        });
        expect(res).toEqual({ error: 'Room is full (max 6 players)' });
    });

    it('rate limits after 10 calls within 10s', async () => {
        const room: MockRoom = { _id: 'room-1', roomCode: 'ABC123', status: 'lobby' };
        const db = makeDb({ room, players: [] });
        const ctx: any = { db };

        for (let i = 0; i < 10; i++) {
            const res = await (joinRoom as any)._handler(ctx, {
                roomCode: 'ABC123',
                sessionId: 'spammer',
                playerName: `Player${i}`,
            });
            expect(res.error).toBeUndefined();
        }

        const blocked = await (joinRoom as any)._handler(ctx, {
            roomCode: 'ABC123',
            sessionId: 'spammer',
            playerName: 'Player10',
        });
        expect(blocked).toEqual({
            error: 'Rate limit exceeded',
            resetMs: expect.any(Number),
        });
    });

    it('requires passcode when room has one', async () => {
        const room: MockRoom = { _id: 'room-1', roomCode: 'ABC123', status: 'lobby', passcode: 'EasterPig' };
        const db = makeDb({ room, players: [] });
        const ctx: any = { db };

        const missing = await (joinRoom as any)._handler(ctx, {
            roomCode: 'ABC123',
            sessionId: 's3',
            playerName: 'Guest',
        });
        expect(missing.error).toBe('This lobby requires a passcode. Ask the host to share it.');

        const wrong = await (joinRoom as any)._handler(ctx, {
            roomCode: 'ABC123',
            sessionId: 's3',
            playerName: 'Guest',
            passcode: 'WrongPasscode',
        });
        expect(wrong.error).toBe('Incorrect passcode. Check the link or ask the host.');

        const correct = await (joinRoom as any)._handler(ctx, {
            roomCode: 'ABC123',
            sessionId: 's3',
            playerName: 'Guest',
            passcode: 'EasterPig',
        });
        expect(correct.roomId).toBe('room-1');
        expect(correct.playerId).toBeDefined();
    });
});
