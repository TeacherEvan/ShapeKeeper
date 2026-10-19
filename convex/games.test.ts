import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the exported Convex handlers (we'll call their `.handler` with a mocked ctx)
import * as games from './games';

interface MockCalls {
    inserts: Array<{ table: string; doc: any }>;
    patches: Array<{ id: any; patchObj: any }>;
    deletes: any[];
}

interface MockDbOverrides {
    get?: (id: any) => any;
    query?: Record<string, () => any>;
}

// Helper to build a minimal mocked ctx.db with programmable responses
function createMockDb(overrides: MockDbOverrides = {}) {
    const calls: MockCalls = { inserts: [], patches: [], deletes: [] };

    const mockCollectionQuery = (items: any[] = []) => ({
        withIndex: () => ({
            collect: vi.fn(async () => items.slice()),
            first: vi.fn(async () => (items.length ? items[0] : null)),
            unique: vi.fn(async () => (items.length ? items[0] : null)),
        }),
    });

    const db = {
        get: vi.fn(async (id: any) => overrides.get?.(id) ?? null),
        query: vi.fn((tableName: string) => {
            const factory = overrides.query?.[tableName];
            if (factory) return factory();
            return mockCollectionQuery([]);
        }),
        insert: vi.fn(async (table: string, doc: any) => {
            calls.inserts.push({ table, doc });
            return { _id: `${table}_mock_id_${calls.inserts.length}` };
        }),
        patch: vi.fn(async (id: any, patchObj: any) => {
            calls.patches.push({ id, patchObj });
            return true;
        }),
        delete: vi.fn(async (id: any) => {
            calls.deletes.push(id);
            return true;
        }),
        __calls: calls,
    };

    return db;
}

describe('convex/games handlers (unit)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('revealMultiplier: applies multiplier to the correct player score and returns multiplier', async () => {
        // Arrange: square exists with multiplier and player matches sessionId
        const squareDoc = {
            _id: 'square1',
            roomId: 'room1',
            squareKey: '0,0',
            playerId: 'playerA',
            multiplier: { type: 'multiplier', value: 3 },
        };

        const playerDoc = { _id: 'playerA', sessionId: 'sess-A', score: 2 };

        const roomDoc = { _id: 'room1', status: 'playing' };

        const mockDb = createMockDb({
            get: (id: any) => {
                if (id === 'playerA') return playerDoc;
                if (id === 'room1') return roomDoc;
                return null;
            },
            query: {
                squares: () => ({
                    withIndex: () => ({ first: vi.fn(async () => squareDoc) }),
                }),
                players: () => ({
                    withIndex: () => ({ first: vi.fn(async () => playerDoc) }),
                }),
                rateLimits: () => ({
                    withIndex: () => ({ unique: vi.fn(async () => null) }),
                }),
            },
        });

        const ctx: any = { db: mockDb };

        // Act
        const result = await (games.revealMultiplier as any)._handler(ctx, {
            roomId: 'room1',
            sessionId: 'sess-A',
            squareKey: '0,0',
        });

        // Assert: player score 2 + (multiplier value 3 - 1) = 4
        expect(result).toEqual({ success: true, multiplier: squareDoc.multiplier, taps: 0 });
        expect(mockDb.patch).toHaveBeenCalledWith('playerA', { score: 4 });
    });

    it('populateLines: inserts non-existent lines and returns count', async () => {
        const roomDoc = { _id: 'room1', status: 'playing', hostPlayerId: 'host-sess', gridSize: 3 };
        const hostPlayer = { _id: 'host-player-id', sessionId: 'host-sess', playerIndex: 2 };

        // Simulate no existing lines so all requested lines get inserted
        const mockDb = createMockDb({
            get: (id: any) => (id === 'room1' ? roomDoc : null),
            query: {
                players: () => ({
                    withIndex: () => ({ first: vi.fn(async () => hostPlayer) }),
                }),
                lines: () => ({
                    withIndex: () => ({
                        first: vi.fn(async () => null),
                        collect: vi.fn(async () => []),
                    }),
                }),
            },
        });

        const ctx: any = { db: mockDb };
        const lineKeys = ['0,0-0,1', '1,0-1,1'];

        const res = await (games.populateLines as any)._handler(ctx, {
            roomId: 'room1',
            sessionId: 'host-sess',
            lineKeys,
        });

        expect(res).toEqual({ success: true, linesPopulated: 2 });
        // Two line inserts expected
        const lineInserts = mockDb.__calls.inserts.filter((i) => i.table === 'lines');
        expect(lineInserts.length).toBe(2);
        expect(mockDb.patch).toHaveBeenCalledWith('room1', { updatedAt: expect.any(Number) });
    });

    it('drawLine: inserts a line and advances turn when no square completed', async () => {
        // Room with two players; currentPlayerIndex = 0
        const roomDoc = {
            _id: 'room1',
            status: 'playing',
            currentPlayerIndex: 0,
            gridSize: 3,
            hostPlayerId: 'host',
            turnDurationMs: 15000,
        };
        const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 0, name: 'A' };
        const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0, name: 'B' };

        // No existing line with same key; lines in room are insufficient to complete a square
        const existingLines = [
            { lineKey: '0,0-0,1' },
            // Deliberately missing other sides so no square will be completed
        ];

        const mockDb = createMockDb({
            get: (id: any) => (id === 'room1' ? roomDoc : null),
            query: {
                rateLimits: () => ({
                    withIndex: () => ({ unique: vi.fn(async () => null) }),
                }),
                players: () => ({
                    withIndex: () => ({ collect: vi.fn(async () => [playerA, playerB]) }),
                }),
                lines: () => ({
                    withIndex: () => ({
                        collect: vi.fn(async () => existingLines),
                        first: vi.fn(async () => null),
                    }),
                }),
                squares: () => ({
                    withIndex: () => ({ collect: vi.fn(async () => []) }),
                }),
            },
        });

        const ctx: any = { db: mockDb, scheduler: { runAt: vi.fn() } };

        const res = await (games.drawLine as any)._handler(ctx, {
            roomId: 'room1',
            sessionId: 'sess-A',
            lineKey: '1,0-1,1',
        });

        expect(res.success).toBe(true);
        expect(res.completedSquares).toBe(0);
        expect(res.keepTurn).toBe(false);
        // Should have inserted the line
        expect((mockDb.__calls.inserts as any[]).some((i: any) => i.table === 'lines')).toBeTruthy();
        // Should have advanced the turn to playerIndex 1 with new turnEndTime
        expect(mockDb.patch).toHaveBeenCalledWith(
            'room1',
            expect.objectContaining({ currentPlayerIndex: 1, turnEndTime: expect.any(Number) })
        );
    });

    it('drawLine: completes a square, inserts square, updates player score and retains turn', async () => {
        const roomDoc = {
            _id: 'room1',
            status: 'playing',
            currentPlayerIndex: 0,
            gridSize: 3,
            turnDurationMs: 15000,
        };
        const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 1, name: 'A' };
        const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0, name: 'B' };

        // The other 3 lines of the square at row=0, col=0
        const linesInDb = [
            { lineKey: '0,0-0,1' }, // top
            { lineKey: '0,1-1,1' }, // right
            { lineKey: '1,0-1,1' }, // bottom
        ];

        const mockDb = createMockDb({
            get: (id: any) => (id === 'room1' ? roomDoc : null),
            query: {
                rateLimits: () => ({
                    withIndex: () => ({ unique: vi.fn(async () => null) }),
                }),
                players: () => ({
                    withIndex: () => ({ collect: vi.fn(async () => [playerA, playerB]) }),
                }),
                lines: () => ({
                    withIndex: () => ({
                        first: vi.fn(async () => null),
                        collect: vi.fn(async () => linesInDb),
                    }),
                }),
                squares: () => ({
                    withIndex: () => ({
                        collect: vi.fn(async () => []),
                        first: vi.fn(async () => null),
                    }),
                }),
            },
        });

        const origInsert = mockDb.insert;
        mockDb.insert = vi.fn(async (table: string, doc: any) => {
            if (table === 'lines') linesInDb.push(doc);
            return origInsert(table, doc);
        });

        const ctx: any = { db: mockDb, scheduler: { runAt: vi.fn() } };

        const res = await (games.drawLine as any)._handler(ctx, {
            roomId: 'room1',
            sessionId: 'sess-A',
            lineKey: '0,0-1,0', // left side completes the square
        });

        expect(res.success).toBe(true);
        expect(res.completedSquares).toBe(1);
        expect(res.keepTurn).toBe(true);
        // Should have inserted a square
        expect((mockDb.__calls.inserts as any[]).some((i: any) => i.table === 'squares')).toBeTruthy();
        // Player score should be incremented by 1 (existing score 1 -> 2)
        expect(mockDb.patch).toHaveBeenCalledWith('pA', expect.objectContaining({ score: 2 }));
        // Retains turn (same currentPlayerIndex) with new turnEndTime
        expect(mockDb.patch).toHaveBeenCalledWith(
            'room1',
            expect.objectContaining({ currentPlayerIndex: 0, turnEndTime: expect.any(Number) })
        );
    });
});
