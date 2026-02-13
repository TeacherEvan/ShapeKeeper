import { describe, expect, it, vi } from 'vitest';
import { checkForCompletedSquares } from './squareDetection';

function createMockDb({ lines = [], existingSquare = null } = {}) {
  const calls: any = { inserts: [] };
  return {
    query: (table: string) => {
      if (table === 'lines') {
        return {
          withIndex: () => ({ collect: vi.fn(async () => lines) }),
        } as any;
      }
      if (table === 'squares') {
        return {
          withIndex: () => ({ first: vi.fn(async () => existingSquare) }),
        } as any;
      }
      return {
        withIndex: () => ({ collect: vi.fn(async () => []) }),
      } as any;
    },
    insert: vi.fn(async (table: string, doc: any) => {
      calls.inserts.push({ table, doc });
      return { _id: 'sq_mock' };
    }),
    __calls: calls,
  } as any;
}

describe('squareDetection.checkForCompletedSquares', () => {
  it('inserts and returns newly completed square', async () => {
    // lines such that square at 0,0 is complete
    const lines = [
      { lineKey: '0,0-0,1' },
      { lineKey: '1,0-1,1' },
      { lineKey: '0,1-1,1' },
      { lineKey: '0,0-1,0' },
    ];

    const mockDb = createMockDb({ lines, existingSquare: null });
    const ctx: any = { db: mockDb };

    // Freeze RNG so multiplier generation is deterministic
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const res = await checkForCompletedSquares(ctx, 'room1', '0,0-1,0', 'playerX', 0, 3);

    expect(res).toEqual(['0,0']);
    expect(mockDb.insert).toHaveBeenCalledWith('squares', expect.objectContaining({ squareKey: '0,0', playerId: 'playerX' }));
  });

  it('does not insert if square already exists', async () => {
    const lines = [
      { lineKey: '0,0-0,1' },
      { lineKey: '1,0-1,1' },
      { lineKey: '0,1-1,1' },
      { lineKey: '0,0-1,0' },
    ];

    const mockDb = createMockDb({ lines, existingSquare: { _id: 'exists' } });
    const ctx: any = { db: mockDb };

    const res = await checkForCompletedSquares(ctx, 'room1', '0,0-1,0', 'playerX', 0, 3);

    expect(res).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
