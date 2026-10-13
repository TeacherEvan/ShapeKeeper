import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestRematchHandler } from './rematch';

vi.mock('../_generated/api', () => ({
    internal: {
        games: {
            expireTurn: 'games.expireTurn',
        },
    },
}));

vi.mock('../rateLimit', () => ({
    checkRateLimit: vi.fn(async (_ctx: any, _action: string, sessionId: string) => {
        if (sessionId === 'rate-limited') {
            return { allowed: false, resetMs: 3000 };
        }
        return { allowed: true, remaining: 3, resetMs: 5000 };
    }),
}));

describe('convex/games/rematch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error when rate limit exceeded', async () => {
        const ctx: any = { db: {} };
        const res = await requestRematchHandler(ctx, {
            roomId: 'r1',
            sessionId: 'rate-limited',
        });
        expect(res).toEqual({ error: 'Rate limit exceeded', resetMs: 3000 });
    });

    it('returns error when room not found', async () => {
        const ctx: any = {
            db: {
                get: async () => null,
            },
        };
        const res = await requestRematchHandler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });
        expect(res).toEqual({ error: 'Room not found' });
    });

    it('returns error when game is not finished', async () => {
        const room = { _id: 'r1', status: 'playing' };
        const ctx: any = {
            db: {
                get: async () => room,
            },
        };
        const res = await requestRematchHandler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });
        expect(res).toEqual({ error: 'Game is not finished' });
    });

    it('returns error when requesting session is not in room', async () => {
        const room = { _id: 'r1', status: 'finished' };
        const players = [{ sessionId: 's1', isConnected: true }, { sessionId: 's2', isConnected: true }];
        const ctx: any = {
            db: {
                get: async () => room,
                query: vi.fn(() => ({
                    withIndex: () => ({
                        collect: async () => players,
                    }),
                })),
            },
        };
        const res = await requestRematchHandler(ctx, {
            roomId: 'r1',
            sessionId: 'stranger',
        });
        expect(res).toEqual({ error: 'Not a player in this room' });
    });

    it('records vote and returns started: false when 1 of 2 players votes', async () => {
        const room = { _id: 'r1', status: 'finished', rematchVotes: [] };
        const players = [
            { sessionId: 's1', isConnected: true },
            { sessionId: 's2', isConnected: true },
        ];
        const patch = vi.fn(async () => true);
        const ctx: any = {
            db: {
                get: async () => room,
                query: vi.fn(() => ({
                    withIndex: () => ({
                        collect: async () => players,
                    }),
                })),
                patch,
            },
        };

        const res = await requestRematchHandler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });

        expect(res).toEqual({ success: true, started: false, votes: 1, needed: 2 });
        expect(patch).toHaveBeenCalledWith('r1', {
            rematchVotes: ['s1'],
            updatedAt: expect.any(Number),
        });
    });

    it('starts rematch when second player votes: clears board, resets scores, and arms timer', async () => {
        const room = {
            _id: 'r1',
            status: 'finished',
            rematchVotes: ['s1'],
            turnDurationMs: 15000,
        };
        const players = [
            { _id: 'p1', sessionId: 's1', isConnected: true, score: 10 },
            { _id: 'p2', sessionId: 's2', isConnected: true, score: 8 },
        ];
        const lines = [{ _id: 'l1' }, { _id: 'l2' }];
        const squares = [{ _id: 'sq1' }];

        const deletedIds: string[] = [];
        const patches: Record<string, any>[] = [];

        const ctx: any = {
            db: {
                get: async () => room,
                query: vi.fn((tableName: string) => ({
                    withIndex: () => ({
                        collect: async () => {
                            if (tableName === 'lines') return lines;
                            if (tableName === 'squares') return squares;
                            if (tableName === 'players') return players;
                            return [];
                        },
                    }),
                })),
                delete: vi.fn(async (id: string) => {
                    deletedIds.push(id);
                }),
                patch: vi.fn(async (id: string, data: any) => {
                    patches.push({ id, ...data });
                }),
            },
            scheduler: {
                runAt: vi.fn(),
            },
        };

        const res = await requestRematchHandler(ctx, {
            roomId: 'r1',
            sessionId: 's2',
        });

        expect(res).toEqual({ success: true, started: true });

        // Both lines and square deleted
        expect(deletedIds).toEqual(['l1', 'l2', 'sq1']);

        // Players reset with score 0 (isReady not touched)
        expect(patches).toContainEqual({ id: 'p1', score: 0 });
        expect(patches).toContainEqual({ id: 'p2', score: 0 });

        // Room patched to playing, currentPlayerIndex: 0, rematchVotes cleared, turn timer armed
        const roomPatch = patches.find((p) => p.id === 'r1');
        expect(roomPatch).toBeDefined();
        expect(roomPatch!.status).toBe('playing');
        expect(roomPatch!.currentPlayerIndex).toBe(0);
        expect(roomPatch!.rematchVotes).toEqual([]);
        expect(roomPatch!.turnEndTime).toBeGreaterThan(Date.now() - 1000);
        expect(ctx.scheduler.runAt).toHaveBeenCalled();
    });
});
