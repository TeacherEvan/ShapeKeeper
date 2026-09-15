import { describe, expect, it } from 'vitest';
import { getRoom, getRoomByCode } from './roomQueries';

interface MockRoom {
    _id: string;
    roomCode: string;
    status: string;
}

interface MockPlayer {
    playerIndex: number;
    name: string;
}

interface MakeDbOptions {
    room?: MockRoom | null;
    players?: MockPlayer[];
}

function makeDb(options: MakeDbOptions = {}) {
    const { room = null, players = [] } = options;
    return {
        query: (tableName: string) => {
            if (tableName === 'rooms')
                return { withIndex: () => ({ first: async () => room }) } as any;
            if (tableName === 'players')
                return { withIndex: () => ({ collect: async () => players }) } as any;
            return {
                withIndex: () => ({ first: async () => null, collect: async () => [] }),
            } as any;
        },
        get: async (id: string) => (room && room._id === id ? room : null),
    } as any;
}

describe('queries/roomQueries', () => {
    it('getRoomByCode returns null when room not found', async () => {
        const ctx: any = { db: makeDb({ room: null }) };
        const res = await (getRoomByCode as any).handler(ctx, { roomCode: 'NOPE' });
        expect(res).toBeNull();
    });

    it('getRoomByCode returns room with players sorted', async () => {
        const room = { _id: 'r1', roomCode: 'ABC123', status: 'lobby' };
        const players = [
            { playerIndex: 1, name: 'B' },
            { playerIndex: 0, name: 'A' },
        ];
        const ctx: any = { db: makeDb({ room, players }) };

        const res = await (getRoomByCode as any).handler(ctx, { roomCode: 'ABC123' });
        expect(res.roomCode).toBe('ABC123');
        expect(res.players[0].name).toBe('A');
    });

    it('getRoom returns null when room missing', async () => {
        const ctx: any = { db: makeDb({ room: null }) };
        const res = await (getRoom as any).handler(ctx, { roomId: 'missing' });
        expect(res).toBeNull();
    });

    it('getRoom returns room with players sorted', async () => {
        const room = { _id: 'r1', roomCode: 'XYZ', status: 'lobby' };
        const players = [
            { playerIndex: 2, name: 'C' },
            { playerIndex: 0, name: 'A' },
            { playerIndex: 1, name: 'B' },
        ];
        const ctx: any = { db: makeDb({ room, players }) };

        const res = await (getRoom as any).handler(ctx, { roomId: 'r1' });
        expect(res._id).toBe('r1');
        expect(res.players.map((p: any) => p.name)).toEqual(['A', 'B', 'C']);
    });
});
