import { describe, it, expect, vi } from 'vitest';
import { createRoom } from '../rooms';

function makeDb() {
  const calls: any = { inserts: [], queries: [], patches: [] };
  return {
    query: vi.fn(() => ({ withIndex: () => ({ first: async () => null }) })),
    insert: vi.fn(async (table: string, doc: any) => {
      calls.inserts.push({ table, doc });
      return `${table}_id_${calls.inserts.length}`;
    }),
    patch: vi.fn(async () => true),
    __calls: calls,
  } as any;
}

describe('rooms.createRoom', () => {
  it('creates a room and adds the host player', async () => {
    const db = makeDb();
    const ctx: any = { db };

    const res = await (createRoom as any).handler(ctx, {
      sessionId: 'sess-1',
      playerName: 'Evan',
      gridSize: 4,
      partyMode: true,
    });

    expect(res.roomId).toBeDefined();
    expect(res.roomCode).toHaveLength(6);
    // Room inserted and player inserted
    expect(db.__calls.inserts.some((i: any) => i.table === 'rooms')).toBeTruthy();
    expect(db.__calls.inserts.some((i: any) => i.table === 'players')).toBeTruthy();
  });
});
