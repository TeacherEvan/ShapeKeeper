import { describe, it, expect, vi, beforeEach } from 'vitest';
import { armTurnTimer, expireTurnHandler } from './turnTimer';

vi.mock('../_generated/api', () => ({
    internal: {
        games: {
            expireTurn: 'games.expireTurn',
        },
    },
}));

describe('convex/games/turnTimer', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('armTurnTimer', () => {
        it('patches turnEndTime = now + 15000 and schedules once when duration is 15000', async () => {
            const patch = vi.fn();
            const runAt = vi.fn();
            const ctx: any = { db: { patch }, scheduler: { runAt } };

            const room = { turnDurationMs: 15000 };
            const now = 1000;

            await armTurnTimer(ctx, 'room1', room, now);

            expect(patch).toHaveBeenCalledWith('room1', {
                turnStartTime: 1000,
                turnEndTime: 16000,
            });
            expect(runAt).toHaveBeenCalledWith(16000, 'games.expireTurn', {
                roomId: 'room1',
                expectedTurnEndTime: 16000,
            });
        });

        it('clears turnStartTime and turnEndTime and schedules nothing when duration is 0 or undefined', async () => {
            const patch = vi.fn();
            const runAt = vi.fn();
            const ctx: any = { db: { patch }, scheduler: { runAt } };

            for (const turnDurationMs of [0, undefined, null, 12345]) {
                patch.mockClear();
                runAt.mockClear();

                await armTurnTimer(ctx, 'room1', { turnDurationMs }, 1000, { foo: 'bar' });

                expect(patch).toHaveBeenCalledWith('room1', {
                    foo: 'bar',
                    turnStartTime: undefined,
                    turnEndTime: undefined,
                });
                expect(runAt).not.toHaveBeenCalled();
            }
        });
    });

    describe('expireTurnHandler', () => {
        it('is a no-op when room not found', async () => {
            const ctx: any = {
                db: {
                    get: vi.fn(async () => null),
                },
            };
            await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 15000 });
            expect(ctx.db.get).toHaveBeenCalledWith('r1');
        });

        it('is a no-op when room status is not playing', async () => {
            const room = { status: 'lobby', turnEndTime: 15000 };
            const patch = vi.fn();
            const ctx: any = {
                db: {
                    get: vi.fn(async () => room),
                    patch,
                },
            };

            await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 15000 });
            expect(patch).not.toHaveBeenCalled();
        });

        it('is a no-op when turnEndTime does not match expectedTurnEndTime (stale)', async () => {
            const room = { status: 'playing', turnEndTime: 20000 };
            const patch = vi.fn();
            const ctx: any = {
                db: {
                    get: vi.fn(async () => room),
                    patch,
                },
            };

            await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 15000 });
            expect(patch).not.toHaveBeenCalled();
        });

        it('is a no-op when fewer than 2 players in room', async () => {
            const room = { status: 'playing', turnEndTime: 15000 };
            const patch = vi.fn();
            const ctx: any = {
                db: {
                    get: vi.fn(async () => room),
                    query: () => ({
                        withIndex: () => ({
                            collect: vi.fn(async () => [{ playerIndex: 0 }]),
                        }),
                    }),
                    patch,
                },
            };

            await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 15000 });
            expect(patch).not.toHaveBeenCalled();
        });

        it('draws a random line on behalf of current player and re-arms when valid', async () => {
            const room = {
                _id: 'r1',
                status: 'playing',
                turnEndTime: 15000,
                turnDurationMs: 15000,
                currentPlayerIndex: 0,
                gridSize: 3,
            };
            const players = [
                { _id: 'p2', playerIndex: 1, name: 'B', score: 0 },
                { _id: 'p1', playerIndex: 0, name: 'A', score: 0 },
            ];
            const patch = vi.fn();
            const insert = vi.fn();
            const runAt = vi.fn();
            const ctx: any = {
                db: {
                    get: vi.fn(async () => room),
                    query: (table: string) => ({
                        withIndex: () => ({
                            collect: vi.fn(async () => {
                                if (table === 'players') return players;
                                if (table === 'lines') return [];
                                if (table === 'squares') return [];
                                return [];
                            }),
                            first: vi.fn(async () => null),
                        }),
                    }),
                    patch,
                    insert,
                },
                scheduler: { runAt },
            };

            await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 15000 });

            expect(insert).toHaveBeenCalledWith(
                'lines',
                expect.objectContaining({
                    roomId: 'r1',
                    playerIndex: 0,
                })
            );
            expect(patch).toHaveBeenCalledWith(
                'r1',
                expect.objectContaining({
                    currentPlayerIndex: 1,
                    turnEndTime: expect.any(Number),
                })
            );
            expect(runAt).toHaveBeenCalled();
        });

        it('wraps around from the last player to player 0', async () => {
            const room = {
                _id: 'r1',
                status: 'playing',
                turnEndTime: 15000,
                turnDurationMs: 15000,
                currentPlayerIndex: 1,
                gridSize: 3,
            };
            const players = [
                { _id: 'p1', playerIndex: 0, name: 'A', score: 0 },
                { _id: 'p2', playerIndex: 1, name: 'B', score: 0 },
            ];
            const patch = vi.fn();
            const insert = vi.fn();
            const runAt = vi.fn();
            const ctx: any = {
                db: {
                    get: vi.fn(async () => room),
                    query: (table: string) => ({
                        withIndex: () => ({
                            collect: vi.fn(async () => {
                                if (table === 'players') return players;
                                if (table === 'lines') return [];
                                if (table === 'squares') return [];
                                return [];
                            }),
                            first: vi.fn(async () => null),
                        }),
                    }),
                    patch,
                    insert,
                },
                scheduler: { runAt },
            };

            await expireTurnHandler(ctx, { roomId: 'r1', expectedTurnEndTime: 15000 });

            expect(patch).toHaveBeenCalledWith(
                'r1',
                expect.objectContaining({
                    currentPlayerIndex: 0,
                })
            );
        });
    });
});
