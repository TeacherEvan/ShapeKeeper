import { describe, expect, it } from 'vitest';
import { sweepStaleLobbies } from './sweepStaleLobbies';

const HOUR = 60 * 60 * 1000;

function makeDb(rooms: any[], playersByRoom: Record<string, any[]> = {}) {
    const deleted = { rooms: [] as string[], players: [] as string[] };
    return {
        db: {
            query: (tableName: string) => {
                if (tableName === 'rooms') {
                    return { collect: async () => rooms } as any;
                }
                if (tableName === 'players') {
                    return {
                        withIndex: (_indexName: string, build: (q: any) => unknown) => {
                            let roomId: string | null = null;
                            build({ eq: (_field: string, value: string) => { roomId = value; } });
                            return { collect: async () => playersByRoom[roomId!] || [] };
                        },
                    } as any;
                }
                return { collect: async () => [] } as any;
            },
            delete: async (id: string) => {
                if (String(id).startsWith('room_')) deleted.rooms.push(id);
                else deleted.players.push(id);
                return undefined;
            },
        },
        deleted,
    };
}

describe('sweepStaleLobbies', () => {
    it('reaps an idle lobby beyond the TTL with its players', async () => {
        const rooms = [
            { _id: 'room_stale', roomCode: 'DEAD01', status: 'lobby', updatedAt: Date.now() - 3 * HOUR },
        ];
        const playersByRoom = { room_stale: [{ _id: 'player_1' }, { _id: 'player_2' }] };
        const { db, deleted } = makeDb(rooms, playersByRoom);

        const res = await (sweepStaleLobbies as any)._handler({ db }, {});

        expect(res.swept).toBe(1);
        expect(deleted.rooms).toEqual(['room_stale']);
        expect(deleted.players).toEqual(['player_1', 'player_2']);
    });

    it('keeps a lobby with recent activity', async () => {
        const rooms = [
            { _id: 'room_fresh', roomCode: 'LIVE01', status: 'lobby', updatedAt: Date.now() - 5 * 60 * 1000 },
        ];
        const { db, deleted } = makeDb(rooms);

        const res = await (sweepStaleLobbies as any)._handler({ db }, {});

        expect(res.swept).toBe(0);
        expect(deleted.rooms).toEqual([]);
    });

    it('never touches in-progress matches, however old', async () => {
        const rooms = [
            { _id: 'room_old_match', roomCode: 'PLAY01', status: 'playing', updatedAt: Date.now() - 10 * HOUR },
            { _id: 'room_finished', roomCode: 'DONE01', status: 'finished', updatedAt: Date.now() - 10 * HOUR },
        ];
        const { db, deleted } = makeDb(rooms);

        const res = await (sweepStaleLobbies as any)._handler({ db }, {});

        expect(res.swept).toBe(0);
        expect(deleted.rooms).toEqual([]);
    });

    it('returns a zero count when there is nothing to sweep', async () => {
        const { db } = makeDb([]);

        const res = await (sweepStaleLobbies as any)._handler({ db }, {});

        expect(res).toEqual({ swept: 0 });
    });
});
