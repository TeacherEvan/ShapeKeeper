import { describe, it, expect, vi } from 'vitest';
import { joinRoom } from '../rooms';

function makeDb({ room = null, players = [] } = {}) {
  const calls: any = { inserts: [], patches: [] };
  return {
    query: vi.fn((tableName: string) => {
      if (tableName === 'rooms') {
        return { withIndex: () => ({ first: async () => room }) } as any;
      }
      if (tableName === 'players') {
        return { withIndex: () => ({ first: async () => null, collect: async () => players }) } as any;
      }
      return { withIndex: () => ({ first: async () => null, collect: async () => [] }) } as any;
    }),
    insert: vi.fn(async (table: string, doc: any) => {
      calls.inserts.push({ table, doc });
      return `${table}_id_${calls.inserts.length}`;
    }),
    patch: vi.fn(async () => true),
    __calls: calls,
  } as any;
}

describe('rooms.joinRoom', () => {
  it('returns error when room not found', async () => {
    const db = makeDb({ room: null });
    const ctx: any = { db };

    const res = await (joinRoom as any).handler(ctx, { roomCode: 'NOPE', sessionId: 's1', playerName: 'A' });
    expect(res).toEqual({ error: 'Room not found' });
  });

  it('adds a new player when space available', async () => {
    const room = { _id: 'room-1', roomCode: 'ABC123', status: 'lobby' };
    const db = makeDb({ room, players: [] });
    const ctx: any = { db };

    const res = await (joinRoom as any).handler(ctx, { roomCode: 'ABC123', sessionId: 's2', playerName: 'B' });

    expect(res.roomId).toBe('room-1');
    expect(res.playerId).toBeDefined();
    expect(db.__calls.inserts.some((i: any) => i.table === 'players')).toBeTruthy();
  });

  it('returns error when room full', async () => {
    const room = { _id: 'room-1', roomCode: 'ABC123', status: 'lobby' };
    const players = new Array(6).fill(0).map((_, i) => ({ _id: `p${i}` }));
    const db = makeDb({ room, players });
    const ctx: any = { db };

    const res = await (joinRoom as any).handler(ctx, { roomCode: 'ABC123', sessionId: 'sX', playerName: 'TooMany' });
    expect(res).toEqual({ error: 'Room is full (max 6 players)' });
  });
});
