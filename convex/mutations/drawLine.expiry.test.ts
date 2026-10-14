import { describe, expect, it, vi } from 'vitest';
import { drawLine } from './drawLine';

interface MockCalls {
  inserts: Array<{ table: string; doc: any }>;
  patches: Array<{ id: any; patchObj: any }>;
}

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  __calls: MockCalls;
}

function createMockDb(overrides: { get?: (id: any) => any; query?: Record<string, () => any> } = {}): MockDb {
  const calls: MockCalls = { inserts: [], patches: [] };
  return {
    get: vi.fn(async (id: any) => overrides.get?.(id) ?? null),
    query: vi.fn((tableName: string) => {
      const factory = overrides.query?.[tableName];
      if (factory) return factory();
      return {
        withIndex: () => ({ collect: async () => [], first: async () => null }),
      } as any;
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
  } as MockDb;
}

describe('drawLine — Allowed Time expiry skip', () => {
  it('skips the timed-out player and re-arms the turn when the deadline has passed', async () => {
    const now = Date.now();
    const room = {
      _id: 'r1',
      status: 'playing',
      currentPlayerIndex: 0,
      gridSize: 3,
      turnDurationSeconds: 30,
      turnStartTime: now - 60_000,
      turnEndTime: now - 30_000, // expired 30s ago
    };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 0 };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0 };

    const mockDb = createMockDb({
      get: (id: any) => (id === 'r1' ? room : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: async () => [playerA, playerB] }) }),
      },
    });

    const ctx: any = { db: mockDb };
    // Player A (whose turn expired) tries to move — must be rejected as a skip.
    const res = await (drawLine as any)._handler(ctx, {
      roomId: 'r1',
      sessionId: 'sess-A',
      lineKey: '0,0-0,1',
    });

    expect(res.turnExpired).toBe(true);
    expect(res.skippedPlayerIndex).toBe(0);
    expect(res.nextPlayerIndex).toBe(1);
    // The room was patched: turn advanced + re-armed.
    const roomPatch = mockDb.patch.mock.calls.find((c: any[]) => c[0] === 'r1');
    expect(roomPatch).toBeDefined();
    expect(roomPatch![1].currentPlayerIndex).toBe(1);
    expect(typeof roomPatch![1].turnEndTime).toBe('number');
    // No line was inserted — the move did not go through.
    expect(mockDb.__calls.inserts).toHaveLength(0);
  });

  it('does NOT skip when the turn has not expired (normal path continues)', async () => {
    const now = Date.now();
    const room = {
      _id: 'r1',
      status: 'playing',
      currentPlayerIndex: 0,
      gridSize: 3,
      turnDurationSeconds: 30,
      turnStartTime: now - 1_000,
      turnEndTime: now + 29_000, // still valid
    };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 0 };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0 };

    const mockDb = createMockDb({
      get: (id: any) => (id === 'r1' ? room : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: async () => [playerA, playerB] }) }),
        lines: () => ({ withIndex: () => ({ collect: async () => [], first: async () => null }) }),
        squares: () => ({ withIndex: () => ({ collect: async () => [], first: async () => null }) }),
        triangles: () => ({ withIndex: () => ({ collect: async () => [] }) }),
      },
    });

    const ctx: any = { db: mockDb };
    const res = await (drawLine as any)._handler(ctx, {
      roomId: 'r1',
      sessionId: 'sess-A',
      lineKey: '1,0-1,1',
    });

    expect(res.success).toBe(true);
    expect(res.turnExpired).toBeUndefined();
  });

  it('never skips on a no-limit room (turnDurationSeconds = 0)', async () => {
    const now = Date.now();
    const room = {
      _id: 'r1',
      status: 'playing',
      currentPlayerIndex: 0,
      gridSize: 3,
      turnDurationSeconds: 0, // no limit
      // A stale turnEndTime could linger on a migrated room; it must be ignored.
      turnEndTime: now - 60_000,
    };
    const playerA = { _id: 'pA', sessionId: 'sess-A', playerIndex: 0, score: 0 };
    const playerB = { _id: 'pB', sessionId: 'sess-B', playerIndex: 1, score: 0 };

    const mockDb = createMockDb({
      get: (id: any) => (id === 'r1' ? room : null),
      query: {
        players: () => ({ withIndex: () => ({ collect: async () => [playerA, playerB] }) }),
        lines: () => ({ withIndex: () => ({ collect: async () => [], first: async () => null }) }),
        squares: () => ({ withIndex: () => ({ collect: async () => [], first: async () => null }) }),
        triangles: () => ({ withIndex: () => ({ collect: async () => [] }) }),
      },
    });

    const ctx: any = { db: mockDb };
    const res = await (drawLine as any)._handler(ctx, {
      roomId: 'r1',
      sessionId: 'sess-A',
      lineKey: '1,0-1,1',
    });

    // Normal move succeeds — no skip on an unlimited room.
    expect(res.success).toBe(true);
    expect(res.turnExpired).toBeUndefined();
  });
});
