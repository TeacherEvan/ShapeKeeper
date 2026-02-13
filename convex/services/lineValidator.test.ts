import { describe, it, expect } from 'vitest';
import { validateDrawLine } from './lineValidator';

function makeDb({ room = null, players = [], existingLine = null } = {}) {
  return {
    get: async (id: any) => room,
    query: (table: string) => {
      if (table === 'players') return { withIndex: () => ({ collect: async () => players }) } as any;
      if (table === 'lines') return { withIndex: () => ({ first: async () => existingLine }) } as any;
      return { withIndex: () => ({ collect: async () => [] }) } as any;
    },
  } as any;
}

describe('lineValidator.validateDrawLine', () => {
  it('returns error when room missing', async () => {
    const ctx: any = { db: makeDb({ room: null }) };
    const res = await validateDrawLine(ctx, 'roomX', 'sess', '0,0-0,1');
    expect(res.ok).toBeFalsy();
    expect(res.error).toBe('Room not found');
  });

  it('returns error when not player turn', async () => {
    const room = { _id: 'r1', status: 'playing', currentPlayerIndex: 0 };
    const players = [{ _id: 'p1', sessionId: 'other', playerIndex: 0 }];
    const ctx: any = { db: makeDb({ room, players }) };
    const res = await validateDrawLine(ctx, 'r1', 'sess', '0,0-0,1');
    expect(res.ok).toBeFalsy();
    expect(res.error).toBe('Not your turn');
  });

  it('returns error when line already exists', async () => {
    const room = { _id: 'r1', status: 'playing', currentPlayerIndex: 0 };
    const players = [{ _id: 'p1', sessionId: 'sess', playerIndex: 0 }];
    const ctx: any = { db: makeDb({ room, players, existingLine: { lineKey: '0,0-0,1' } }) };
    const res = await validateDrawLine(ctx, 'r1', 'sess', '0,0-0,1');
    expect(res.ok).toBeFalsy();
    expect(res.error).toBe('Line already drawn');
  });

  it('returns ok with room, sortedPlayers and currentPlayer when valid', async () => {
    const room = { _id: 'r1', status: 'playing', currentPlayerIndex: 0 };
    const players = [
      { _id: 'p1', sessionId: 'sess', playerIndex: 0 },
      { _id: 'p2', sessionId: 'sess2', playerIndex: 1 },
    ];
    const ctx: any = { db: makeDb({ room, players, existingLine: null }) };
    const res = await validateDrawLine(ctx, 'r1', 'sess', '0,0-0,1');
    expect(res.ok).toBeTruthy();
    expect(res.room).toBe(room);
    expect(res.sortedPlayers.length).toBe(2);
    expect(res.currentPlayer._id).toBe('p1');
  });
});
