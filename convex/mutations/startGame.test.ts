import { describe, expect, it, vi } from 'vitest';
import { startGame } from './startGame';

interface MockRoom {
    _id: string;
    hostPlayerId: string;
    status: string;
}

interface MockPlayer {
    isReady?: boolean;
    sessionId?: string;
}

interface MakeDbOptions {
    room?: MockRoom | null;
    players?: MockPlayer[];
}

function makeDb(options: MakeDbOptions = {}) {
    const { room = null, players = [] } = options;
    return {
        get: async (_id: string) => room,
        query: vi.fn((_tableName: string) => ({
            withIndex: () => ({ collect: async () => players }),
        })),
        patch: vi.fn(async () => true),
    } as any;
}

describe('mutations/startGame', () => {
    it('returns error when room not found', async () => {
        const db = makeDb({ room: null });
        const ctx: any = { db };
        const res = await (startGame as any).handler(ctx, { roomId: 'r1', sessionId: 's1' });
        expect(res).toEqual({ error: 'Room not found' });
    });

    it('returns error when not host', async () => {
        const room = { _id: 'r1', hostPlayerId: 'host', status: 'lobby' };
        const db = makeDb({ room, players: [{}, {}] });
        const ctx: any = { db };
        const res = await (startGame as any).handler(ctx, { roomId: 'r1', sessionId: 's1' });
        expect(res).toEqual({ error: 'Only the host can start the game' });
    });

    it('starts game when all ready and at least 2 players', async () => {
        const room = { _id: 'r1', hostPlayerId: 'host', status: 'lobby' };
        const players = [
            { isReady: true, sessionId: 'p1' },
            { isReady: true, sessionId: 'p2' },
        ];
        const db = makeDb({ room, players });
        const ctx: any = { db };

        const res = await (startGame as any).handler(ctx, {
            roomId: 'r1',
            sessionId: 'host',
        });
        expect(res).toEqual({ success: true });
        expect(db.patch).toHaveBeenCalledWith(
            'r1',
            expect.objectContaining({ status: 'playing' })
        );
    });
});
