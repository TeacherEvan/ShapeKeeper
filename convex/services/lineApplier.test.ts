import { describe, expect, it, vi } from 'vitest';
import { applyLine } from './lineApplier';

function makeDb() {
  const calls: any = { inserts: [] };
  return {
    insert: vi.fn(async (table: string, doc: any) => {
      calls.inserts.push({ table, doc });
      return { _id: 'line_mock' };
    }),
    __calls: calls,
  } as any;
}

describe('lineApplier.applyLine', () => {
  it('inserts a line document with expected fields', async () => {
    const db = makeDb();
    const ctx: any = { db };
    const currentPlayer = { _id: 'p1', playerIndex: 0 };

    const res = await applyLine(ctx, 'room1', '0,0-0,1', currentPlayer);

    expect(db.insert).toHaveBeenCalledWith('lines', expect.objectContaining({ roomId: 'room1', lineKey: '0,0-0,1', playerId: 'p1', playerIndex: 0 }));
    expect(res).toEqual({ _id: 'line_mock' });
  });
});
