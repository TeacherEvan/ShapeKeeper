import { describe, expect, it } from 'vitest';
import { getRoom, getRoomByCode, listOpenLobbies } from './roomQueries';

interface MockRoom {
    _id: string;
    roomCode: string;
    status: string;
    hostPlayerId?: string;
    gridSize?: number;
    createdAt?: number;
}

interface MockPlayer {
    playerIndex: number;
    name: string;
    sessionId?: string;
}

interface MakeDbOptions {
    room?: MockRoom | null;
    players?: MockPlayer[];
    rooms?: MockRoom[];
}

function makeDb(options: MakeDbOptions = {}) {
    const { room = null, players = [], rooms = [] } = options;
    return {
        query: (tableName: string) => {
            if (tableName === 'rooms')
                return {
                    withIndex: () => ({ first: async () => room }),
                    collect: async () => rooms,
                } as any;
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
        const res = await (getRoomByCode as any)._handler(ctx, { roomCode: 'NOPE' });
        expect(res).toBeNull();
    });

    it('getRoomByCode returns room with players sorted', async () => {
        const room = { _id: 'r1', roomCode: 'ABC123', status: 'lobby' };
        const players = [
            { playerIndex: 1, name: 'B' },
            { playerIndex: 0, name: 'A' },
        ];
        const ctx: any = { db: makeDb({ room, players }) };

        const res = await (getRoomByCode as any)._handler(ctx, { roomCode: 'ABC123' });
        expect(res.roomCode).toBe('ABC123');
        expect(res.players[0].name).toBe('A');
    });

    it('getRoom returns null when room missing', async () => {
        const ctx: any = { db: makeDb({ room: null }) };
        const res = await (getRoom as any)._handler(ctx, { roomId: 'missing' });
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

        const res = await (getRoom as any)._handler(ctx, { roomId: 'r1' });
        expect(res._id).toBe('r1');
        expect(res.players.map((p: any) => p.name)).toEqual(['A', 'B', 'C']);
    });
    it('projects turn timing and duration metadata to client', async () => {
        const room = {
            _id: 'r1',
            roomCode: 'XYZ',
            status: 'playing',
            turnStartTime: 1000,
            turnEndTime: 16000,
            turnDurationMs: 15000,
            lastTurnClientSentAt: 950,
            lastTurnServerReceivedAt: 1000,
        };
        const ctx: any = { db: makeDb({ room, players: [] }) };

        const res = await (getRoom as any)._handler(ctx, { roomId: 'r1' });
        expect(res.turnStartTime).toBe(1000);
        expect(res.turnEndTime).toBe(16000);
        expect(res.turnDurationMs).toBe(15000);
        expect(res.lastTurnClientSentAt).toBe(950);
        expect(res.lastTurnServerReceivedAt).toBe(1000);
    });

    it('strips rematchVotes array and exposes rematchVoteCount', async () => {
        const room = {
            _id: 'r1',
            roomCode: 'XYZ',
            status: 'finished',
            rematchVotes: ['sess-1', 'sess-2'],
        };
        const ctx: any = { db: makeDb({ room, players: [] }) };

        const res = await (getRoom as any)._handler(ctx, { roomId: 'r1' });
        expect(res.rematchVoteCount).toBe(2);
        expect((res as any).rematchVotes).toBeUndefined();
    });

    it('listOpenLobbies returns only lobby rooms with host name and player count', async () => {
        const rooms = [
            { _id: 'r1', roomCode: 'OPEN01', status: 'lobby', hostPlayerId: 's1', gridSize: 5, createdAt: 100 },
            { _id: 'r2', roomCode: 'PLAY01', status: 'playing', hostPlayerId: 's2', gridSize: 5, createdAt: 200 },
        ];
        const players = [{ playerIndex: 0, name: 'Hosty', sessionId: 's1' }];
        const ctx: any = { db: makeDb({ rooms, players }) };

        const res = await (listOpenLobbies as any)._handler(ctx, {});
        expect(res).toHaveLength(1);
        expect(res[0].roomCode).toBe('OPEN01');
        expect(res[0].hostName).toBe('Hosty');
        expect(res[0].playerCount).toBe(1);
        expect(res[0].maxPlayers).toBe(6);
    });

    it('listOpenLobbies returns an empty array when no lobby rooms exist', async () => {
        const ctx: any = { db: makeDb({ rooms: [] }) };

        const res = await (listOpenLobbies as any)._handler(ctx, {});
        expect(res).toEqual([]);
    });
});
