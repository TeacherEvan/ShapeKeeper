import { describe, expect, it, vi } from 'vitest';
import { toggleReady } from './toggleReady';

interface MockPlayer {
    _id: string;
    isReady: boolean;
}

function makeDb(player: MockPlayer | null = null) {
    return {
        query: vi.fn(() => ({
            withIndex: () => ({ first: async () => player }),
        })),
        patch: vi.fn(async () => true),
    } as any;
}

describe('mutations/toggleReady', () => {
    it('returns error when player not found', async () => {
        const db = makeDb(null);
        const ctx: any = { db };
        const res = await (toggleReady as any).handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });
        expect(res).toEqual({ error: 'Player not found' });
    });

    it('toggles ready state and updates room timestamp', async () => {
        const player = { _id: 'p1', isReady: false };
        const db = makeDb(player);
        const ctx: any = { db };

        const res = await (toggleReady as any).handler(ctx, {
            roomId: 'r1',
            sessionId: 's1',
        });
        expect(res).toEqual({ isReady: true });
        expect(db.patch).toHaveBeenCalledWith('p1', { isReady: true });
        expect(db.patch).toHaveBeenCalledWith(
            'r1',
            expect.objectContaining({ updatedAt: expect.any(Number) })
        );
    });
});
