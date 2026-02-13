import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveLineEffects } from './lineResolver';

function makeCtx(overrides: any = {}) {
  const db = {
    patch: vi.fn(async () => true),
    query: vi.fn((table: string) => ({ withIndex: () => ({ collect: async () => overrides[table] || [] }) })),
  } as any;
  return { db, __newLineKey: overrides.__newLineKey } as any;
}

describe('lineResolver.resolveLineEffects', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('advances turn when no squares completed (triangles ignored for turn)', async () => {
    const room = { _id: 'r1', gridSize: 3, currentPlayerIndex: 0 };
    const ctx = makeCtx({ lines: [], squares: [], players: [{ playerIndex: 0 }, { playerIndex: 1 }] , __newLineKey: '0,1-1,1' });

    // Stub shape detectors to return triangle but no squares
    vi.spyOn(require('./squareDetection'), 'checkForCompletedSquares').mockResolvedValue([]);
    vi.spyOn(require('./triangleDetection'), 'checkForCompletedTriangles').mockResolvedValue(['tri-0,0-BR']);

    const currentPlayer = { _id: 'p1', playerIndex: 0, score: 0 };

    const res = await resolveLineEffects(ctx, room, 'r1', currentPlayer);

    expect(res.completedSquares).toBe(0);
    expect(res.completedTriangles).toBeGreaterThanOrEqual(1);
    expect(res.keepTurn).toBe(false);
    expect(ctx.db.patch).toHaveBeenCalledWith('r1', expect.objectContaining({ currentPlayerIndex: 1 }));
  });

  it('updates score and retains turn when square completed and ends game when all squares done', async () => {
    const room = { _id: 'r1', gridSize: 2, currentPlayerIndex: 0 }; // 1 total square
    const ctx = makeCtx({ squares: [], players: [{ playerIndex: 0 }, { playerIndex: 1 }], __newLineKey: '0,0-1,0' });

    vi.spyOn(require('./squareDetection'), 'checkForCompletedSquares').mockResolvedValue(['0,0']);
    vi.spyOn(require('./triangleDetection'), 'checkForCompletedTriangles').mockResolvedValue([]);

    const currentPlayer = { _id: 'p1', playerIndex: 0, score: 1 };

    const res = await resolveLineEffects(ctx, room, 'r1', currentPlayer);

    expect(res.completedSquares).toBe(1);
    expect(res.keepTurn).toBe(true);
    // Because gridSize=2 -> totalSquares = 1, game should be finished
    expect(res.gameOver).toBe(true);
    expect(ctx.db.patch).toHaveBeenCalledWith('p1', expect.objectContaining({ score: 2 }));
    expect(ctx.db.patch).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'finished' }));
  });
});
