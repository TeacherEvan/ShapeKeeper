import { describe, expect, it, vi } from 'vitest';
import { leaveRoom } from './leaveRoom';

function makeDb({ player = null, room = null, remaining = [] } = {}) {
  const calls: any = { deletes: [], patches: [] };
  return {
    query: vi.fn((tableName: string) => {
      if (tableName === 'players') return { withIndex: () => ({ first: async () => player, collect: async () => remaining }) } as any;
      return { withIndex: () => ({ first: async () => room, collect: async () => [] }) } as any;
    }),
    get: vi.fn(async (id: any) => (id === room?._id ? room : null)),
    delete: vi.fn(async (id: any) => { calls.deletes.push(id); return true; }),
    patch: vi.fn(async (id: any, p: any) => { calls.patches.push({ id, p }); return true; }),
    __calls: calls,
  } as any;
}

describe('mutations/leaveRoom', () => {
  it('marks player disconnected if game in progress', async () => {
    const player = { _id: 'p1' };
    const room = { _id: 'r1', status: 'playing' };
    const db = makeDb({ player, room });
    const ctx: any = { db };

    const res = await (leaveRoom as any).handler(ctx, { roomId: 'r1', sessionId: 's1' });
    expect(res).toEqual({ success: true, disconnected: true });
    expect(db.patch).toHaveBeenCalledWith('p1', { isConnected: false });
  });

  it('removes player and deletes room when no remaining players', async () => {
    const player = { _id: 'p1' };
    const room = { _id: 'r1', status: 'lobby', hostPlayerId: 's1' };
    const db = makeDb({ player, room, remaining: [] });
    const ctx: any = { db };

    const res = await (leaveRoom as any).handler(ctx, { roomId: 'r1', sessionId: 's1' });
    expect(res).toEqual({ success: true, roomDeleted: true });
    expect(db.delete).toHaveBeenCalledWith('p1');
    expect(db.delete).toHaveBeenCalledWith('r1');
  });

  it('transfers host and reindexes remaining players', async () => {
    const player = { _id: 'p1' };
    const room = { _id: 'r1', status: 'lobby', hostPlayerId: 's1' };
    const remaining = [{ _id: 'p2', sessionId: 's2' }, { _id: 'p3', sessionId: 's3' }];
    const db = makeDb({ player, room, remaining });
    const ctx: any = { db };

    const res = await (leaveRoom as any).handler(ctx, { roomId: 'r1', sessionId: 's1' });
    expect(res).toEqual({ success: true });
    expect(db.patch).toHaveBeenCalledWith('r1', expect.objectContaining({ hostPlayerId: 's2' }));
    expect(db.patch).toHaveBeenCalledWith('p2', { playerIndex: 0 });
    expect(db.patch).toHaveBeenCalledWith('p3', { playerIndex: 1 });
  });
});