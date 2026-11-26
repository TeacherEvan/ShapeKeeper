import { describe, expect, it, vi } from 'vitest';
import { createRoom } from '../rooms';

function makeDb() {
  const calls: any = { inserts: [], queries: [], patches: [] };
  const store = new Map<string, any>();
  return {
    query: vi.fn((tableName?: string) => {
      if (tableName === 'rateLimits') {
        return {
          withIndex: (_idx: string, buildFilter: any) => {
            const filterArgs: any = {};
            buildFilter({
              eq: (k: string, v: any) => {
                filterArgs[k] = v;
              },
            });
            return {
              unique: async () => {
                for (const row of store.values()) {
                  if (row.key === filterArgs.key) return row;
                }
                return null;
              },
            };
          },
        };
      }
      return { withIndex: () => ({ first: async () => null }) };
    }),
    insert: vi.fn(async (table: string, doc: any) => {
      const id = `${table}_id_${calls.inserts.length + 1}`;
      const row = { _id: id, ...doc };
      store.set(id, row);
      calls.inserts.push({ table, doc });
      return id;
    }),
    patch: vi.fn(async (id: string, patch: any) => {
      const row = store.get(id);
      if (row) Object.assign(row, patch);
      return true;
    }),
    __calls: calls,
  } as any;
}

describe('rooms.createRoom', () => {
  it('creates a room and adds the host player', async () => {
    const db = makeDb();
    const ctx: any = { db };

    const res = await (createRoom as any)._handler(ctx, {
      sessionId: 'sess-1',
      playerName: 'Evan',
      gridSize: 4,
      partyMode: true,
    });

    expect(res.roomId).toBeDefined();
    expect(res.roomCode).toHaveLength(6);
    // Room inserted and player inserted
    expect(db.__calls.inserts.some((i: any) => i.table === 'rooms')).toBeTruthy();
    const roomInsert = db.__calls.inserts.find((i: any) => i.table === 'rooms');
    expect(roomInsert.doc.partyMode).toBeUndefined();
    expect(db.__calls.inserts.some((i: any) => i.table === 'players')).toBeTruthy();
  });

  it('rate limits after 5 calls within 60s', async () => {
    const db = makeDb();
    const ctx: any = { db };

    for (let i = 0; i < 5; i++) {
      const res = await (createRoom as any)._handler(ctx, {
        sessionId: 'spammer',
        playerName: 'Evan',
        gridSize: 4,
      });
      expect(res.error).toBeUndefined();
    }

    const blocked = await (createRoom as any)._handler(ctx, {
      sessionId: 'spammer',
      playerName: 'Evan',
      gridSize: 4,
    });
    expect(blocked).toEqual({
      error: 'Rate limit exceeded',
      resetMs: expect.any(Number),
    });
  });

  it('rejects invalid gridSize and sets isOpen: true by default', async () => {
    const db = makeDb();
    const ctx: any = { db };

    const bad = await (createRoom as any)._handler(ctx, {
      sessionId: 'sess-bad',
      playerName: 'Evan',
      gridSize: 99,
    });
    expect(bad).toEqual({ error: 'Invalid grid size' });

    const ok = await (createRoom as any)._handler(ctx, {
      sessionId: 'sess-open',
      playerName: 'Evan',
      gridSize: 5,
    });
    expect(ok.error).toBeUndefined();
    const roomInsert = db.__calls.inserts.find((i: any) => i.table === 'rooms');
    expect(roomInsert.doc.isOpen).toBe(true);
  });
});
