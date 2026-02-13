import { describe, expect, it, vi } from 'vitest';
import { drawLine } from './drawLine';

// Minimal mock DB factory used by several tests
function createMockDb(overrides = {}) {
  const calls = { inserts: [], patches: [] };
  return {
    get: vi.fn(async (id: any) => overrides.get?.(id) ?? null),
    query: vi.fn((tableName: string) => {
      const factory = overrides.query?.[tableName];
      if (factory) return factory();
      return { withIndex: () => ({ collect: async () => [], first: async () => null }) } as any;
    }),
    insert: vi.fn(async (table: string, doc: any) => {
      calls.inserts.push({ table, doc });
      return { _id: `${table}_mock_${calls.inserts.length}` };
    }),
    patch: vi.fn(async (id: any, patchObj: any) => {
      calls.patches.push({ id, patchObj });
      return true;
    }),
    __calls: calls,
  } as any;
}

describe('mutations/drawLine (integration-style unit tests)', () => {
  it('returns error when not player turn', async () => {
    const room = { _id: 'r1', status: 'playing', currentPlayerIndex: 0, gridSize: 3 };
    const players = [{ _id: 'p1', sessionId: 'other', playerIndex: 0 }];
    const mockDb = createMockDb({ get: (id: any) => (id === 'r1' ? room : null), query: { players: () => ({ withIndex: () => ({ collect: async () => players }) }) } });

    const ctx: any = { db: mockDb };
    const res = await (drawLine as any).handler(ctx, { roomId: 'r1', sessionId: 'sess', lineKey: '0,0-0,1' });

    expect(res).toEqual({ error: 'Not your turn' });
  });

  it('inserts a line and advances turn when no square or triangle completed', async () => {
    const room = { _id: 'r1', status: 'playing', currentPlayerIndex: 0, gridSize: 3 };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 0 };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0 };

    const existingLines = [ { lineKey: '0,0-0,1' } ];

    const mockDb = createMockDb({
      get: (id: any) => (id === 'r1' ? room : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: async () => [playerA, playerB] }) }),
        lines: () => ({ withIndex: () => ({ collect: async () => existingLines, first: async () => null }) }),
        squares: () => ({ withIndex: () => ({ collect: async () => [] }) }),
        triangles: () => ({ withIndex: () => ({ collect: async () => [] }) }),
      },
    });

    const ctx: any = { db: mockDb };

    const res = await (drawLine as any).handler(ctx, { roomId: 'r1', sessionId: 'sess-A', lineKey: '1,0-1,1' });

    expect(res.success).toBe(true);
    expect(res.completedSquares).toBe(0);
    expect(res.completedTriangles).toBe(0);
    // Turn advanced
    expect(mockDb.patch).toHaveBeenCalledWith('r1', expect.objectContaining({ currentPlayerIndex: 1 }));
  });

  it('inserts a square, updates score and retains turn when square completed', async () => {
    const room = { _id: 'r1', status: 'playing', currentPlayerIndex: 0, gridSize: 3 };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 1 };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0 };

    const existingLines = [
      { lineKey: '0,0-0,1' },
      { lineKey: '0,1-1,1' },
      { lineKey: '1,0-1,1' },
    ];

    const mockDb = createMockDb({
      get: (id: any) => (id === 'r1' ? room : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: async () => [playerA, playerB] }) }),
        lines: () => ({ withIndex: () => ({ collect: async () => existingLines, first: async () => null }) }),
        squares: () => ({ withIndex: () => ({ collect: async () => [] }) }),
        triangles: () => ({ withIndex: () => ({ collect: async () => [] }) }),
      },
    });

    const ctx: any = { db: mockDb };

    const res = await (drawLine as any).handler(ctx, { roomId: 'r1', sessionId: 'sess-A', lineKey: '0,0-1,0' });

    expect(res.success).toBe(true);
    expect(res.completedSquares).toBe(1);
    expect(res.keepTurn).toBe(true);
    // Player score patched
    expect(mockDb.patch).toHaveBeenCalledWith('pA', expect.objectContaining({ score: 2 }));
  });
});
