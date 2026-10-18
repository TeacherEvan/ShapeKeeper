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
                    withIndex: (_idx: string, buildFilter?: any) => {
                        let statusVal: string | undefined;
                        if (buildFilter) {
                            buildFilter({
                                eq: (_field: string, val: any) => {
                                    statusVal = val;
                                },
                            });
                        }
                        const filtered = statusVal
                            ? rooms.filter((r) => r.status === statusVal)
                            : rooms;
                        return {
                            first: async () => room,
                            collect: async () => filtered,
                        };
                    },
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

    it('getRoomByCode returns room with players sorted and projected', async () => {
        const room = { _id: 'r1', roomCode: 'ABC123', status: 'lobby', hostPlayerId: 's_host' };
        const players = [
            { playerIndex: 1, name: 'B', sessionId: 's_guest' },
            { playerIndex: 0, name: 'A', sessionId: 's_host' },
        ];
        const ctx: any = { db: makeDb({ room, players }) };

        const res = await (getRoomByCode as any)._handler(ctx, { roomCode: 'ABC123', sessionId: 's_host' });
        expect(res.roomCode).toBe('ABC123');
        expect(res.isHost).toBe(true);
        expect(res.players[0].name).toBe('A');
        expect(res.players[0].isHost).toBe(true);
        expect(res.players[0].isYou).toBe(true);
        expect(res.players[1].name).toBe('B');
        expect(res.players[1].isHost).toBe(false);
        expect(res.players[1].isYou).toBe(false);
        expect((res.players[0] as any).sessionId).toBeUndefined();
    });

    it('getRoom returns null when room missing', async () => {
        const ctx: any = { db: makeDb({ room: null }) };
        const res = await (getRoom as any)._handler(ctx, { roomId: 'missing' });
        expect(res).toBeNull();
    });

    it('getRoom returns room with players sorted and projected for guest', async () => {
        const room = { _id: 'r1', roomCode: 'XYZ', status: 'lobby', hostPlayerId: 's_host' };
        const players = [
            { playerIndex: 2, name: 'C', sessionId: 's_other' },
            { playerIndex: 0, name: 'A', sessionId: 's_host' },
            { playerIndex: 1, name: 'B', sessionId: 's_guest' },
        ];
        const ctx: any = { db: makeDb({ room, players }) };

        const res = await (getRoom as any)._handler(ctx, { roomId: 'r1', sessionId: 's_guest' });
        expect(res._id).toBe('r1');
        expect(res.isHost).toBe(false);
        expect(res.players.map((p: any) => p.name)).toEqual(['A', 'B', 'C']);
        expect(res.players[0].isHost).toBe(true);
        expect(res.players[0].isYou).toBe(false);
        expect(res.players[1].isHost).toBe(false);
        expect(res.players[1].isYou).toBe(true);
        expect((res.players[1] as any).sessionId).toBeUndefined();
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
