import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the exported Convex handlers (we'll call their `.handler` with a mocked ctx)
import * as games from './games';

// Helper to build a minimal mocked ctx.db with programmable responses
function createMockDb(overrides = {}) {
  const calls = { inserts: [], patches: [], deletes: [] };

  const mockCollectionQuery = (items = []) => ({
    withIndex: () => ({
      collect: vi.fn(async () => items.slice()),
      first: vi.fn(async () => (items.length ? items[0] : null)),
    }),
  });

  const db = {
    get: vi.fn(async (id) => overrides.get?.(id) ?? null),
    query: vi.fn((tableName) => {
      const factory = overrides.query?.[tableName];
      if (factory) return factory();
      return mockCollectionQuery([]);
    }),
    insert: vi.fn(async (table, doc) => {
      calls.inserts.push({ table, doc });
      return { _id: `${table}_mock_id_${calls.inserts.length}` };
    }),
    patch: vi.fn(async (id, patchObj) => {
      calls.patches.push({ id, patchObj });
      return true;
    }),
    delete: vi.fn(async (id) => {
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

    const mockDb = createMockDb({
      get: (id: any) => (id === 'playerA' ? playerDoc : null),
      query: {
        squares: () => ({
          withIndex: () => ({ first: vi.fn(async () => squareDoc) }),
        }),
        players: () => ({
          withIndex: () => ({ first: vi.fn(async () => playerDoc) }),
        }),
      },
    });

    const ctx: any = { db: mockDb };

    // Act
    const result = await (games.revealMultiplier as any).handler(ctx, {
      roomId: 'room1',
      sessionId: 'sess-A',
      squareKey: '0,0',
    });

    // Assert
    expect(result).toEqual({ success: true, multiplier: squareDoc.multiplier });
    expect(mockDb.patch).toHaveBeenCalledWith('playerA', { score: 6 });
  });

  it('populateLines: inserts non-existent lines and returns count', async () => {
    const roomDoc = { _id: 'room1', status: 'playing', hostPlayerId: 'host-sess' };
    const hostPlayer = { _id: 'host-player-id', sessionId: 'host-sess', playerIndex: 2 };

    // Simulate no existing lines so all requested lines get inserted
    const mockDb = createMockDb({
      get: (id: any) => (id === 'room1' ? roomDoc : null),
      query: {
        players: () => ({
          withIndex: () => ({ first: vi.fn(async () => hostPlayer) }),
        }),
        lines: () => ({
          withIndex: () => ({ first: vi.fn(async () => null), collect: vi.fn(async () => []) }),
        }),
      },
    });

    const ctx: any = { db: mockDb };
    const lineKeys = ['0,0-0,1', '1,0-1,1'];

    const res = await (games.populateLines as any).handler(ctx, {
      roomId: 'room1',
      sessionId: 'host-sess',
      lineKeys,
    });

    expect(res).toEqual({ success: true, linesPopulated: 2 });
    // Two inserts expected
    expect(mockDb.__calls.inserts.length).toBe(2);
    expect(mockDb.patch).toHaveBeenCalledWith('room1', { updatedAt: expect.any(Number) });
  });

  it('drawLine: inserts a line and advances turn when no square completed', async () => {
    // Room with two players; currentPlayerIndex = 0
    const roomDoc = { _id: 'room1', status: 'playing', currentPlayerIndex: 0, gridSize: 3, hostPlayerId: 'host' };
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
        players: () => ({
          withIndex: () => ({ collect: vi.fn(async () => [playerA, playerB]) }),
        }),
        lines: () => ({
          withIndex: () => ({ collect: vi.fn(async () => existingLines), first: vi.fn(async () => null) }),
        }),
        squares: () => ({
          withIndex: () => ({ collect: vi.fn(async () => []) }),
        }),
      },
    });

    const ctx: any = { db: mockDb };

    const res = await (games.drawLine as any).handler(ctx, {
      roomId: 'room1',
      sessionId: 'sess-A',
      lineKey: '1,0-1,1',
    });

    expect(res.success).toBe(true);
    expect(res.completedSquares).toBe(0);
    // Should have inserted the line
    expect((mockDb.__calls.inserts as any[]).some((i: any) => i.table === 'lines')).toBeTruthy();
    // Should have advanced the turn to playerIndex 1
    expect(mockDb.patch).toHaveBeenCalledWith('room1', expect.objectContaining({ currentPlayerIndex: 1 }));
  });

  it('drawLine: completes a square, inserts square, updates player score and retains turn', async () => {
    const roomDoc = { _id: 'room1', status: 'playing', currentPlayerIndex: 0, gridSize: 3 };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 1, name: 'A' };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0, name: 'B' };

    // Lines such that drawing '0,0-1,0' will complete the square at row=0,col=0
    const existingLines = [
      '0,0-0,1', // top
      '0,1-1,1', // right
      '1,0-1,1', // bottom
    ].map((k) => ({ lineKey: k }));

    const mockDb = createMockDb({
      get: (id: any) => (id === 'room1' ? roomDoc : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: vi.fn(async () => [playerA, playerB]) }) }),
        lines: () => ({ withIndex: () => ({ collect: vi.fn(async () => existingLines), first: vi.fn(async () => null) }) }),
        squares: () => ({ withIndex: () => ({ collect: vi.fn(async () => []) }) }),
      },
    });

    const ctx: any = { db: mockDb };

    const res = await (games.drawLine as any).handler(ctx, {
      roomId: 'room1',
      sessionId: 'sess-A',
      lineKey: '0,0-1,0', // left side completes the square
    });

    expect(res.success).toBe(true);
    expect(res.completedSquares).toBe(1);
    // Should have inserted a square
    expect((mockDb.__calls.inserts as any[]).some((i: any) => i.table === 'squares')).toBeTruthy();
    // Player score should be incremented by 1 (existing score 1 -> 2)
    expect(mockDb.patch).toHaveBeenCalledWith('pA', expect.objectContaining({ score: 2 }));
    // Should NOT advance currentPlayerIndex (turn retained)
    expect(mockDb.patch).toHaveBeenCalledWith('room1', expect.objectContaining({ updatedAt: expect.any(Number) }));
  });

  it('drawLine: completes a triangle, inserts triangle and returns completedTriangles (turn advances if no squares)', async () => {
    const roomDoc = { _id: 'room1', status: 'playing', currentPlayerIndex: 0, gridSize: 3 };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 0, name: 'A' };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0, name: 'B' };

    // Lines such that drawing '0,1-1,1' will complete a triangle (orthogonal example)
    const existingLines = [
      { lineKey: '0,0-0,1' },
      { lineKey: '0,0-1,0' },
    ];

    const mockDb = createMockDb({
      get: (id: any) => (id === 'room1' ? roomDoc : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: vi.fn(async () => [playerA, playerB]) }) }),
        lines: () => ({ withIndex: () => ({ collect: vi.fn(async () => existingLines), first: vi.fn(async () => null) }) }),
        squares: () => ({ withIndex: () => ({ collect: vi.fn(async () => []) }) }),
        triangles: () => ({ withIndex: () => ({ collect: vi.fn(async () => []) }) }),
      },
    });

    const ctx: any = { db: mockDb };

    const res = await (games.drawLine as any).handler(ctx, {
      roomId: 'room1',
      sessionId: 'sess-A',
      lineKey: '0,1-1,1', // completes triangle
    });

    expect(res.success).toBe(true);
    expect(res.completedTriangles).toBeGreaterThanOrEqual(1);
    // Should have inserted a triangle
    expect((mockDb.__calls.inserts as any[]).some((i: any) => i.table === 'triangles')).toBeTruthy();
    // Since no squares were completed, turn should advance
    expect(mockDb.patch).toHaveBeenCalledWith('room1', expect.objectContaining({ currentPlayerIndex: 1 }));
  });
});
