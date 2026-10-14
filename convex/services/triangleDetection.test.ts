import { describe, expect, it } from 'vitest';
import { checkForCompletedTriangles } from './triangleDetection';

interface MockLine {
    lineKey: string;
}

interface MockTriangle {
    _id: string;
}

interface MakeMockDbOptions {
    lines?: MockLine[];
    existingTriangle?: MockTriangle | null;
}

function makeMockDb(options: MakeMockDbOptions = {}) {
    const { lines = [], existingTriangle = null } = options;
    const calls: any = { inserts: [] };
    return {
        query: (table: string) => {
            if (table === 'lines') {
                return { withIndex: () => ({ collect: async () => lines }) } as any;
            }
            if (table === 'triangles') {
                return { withIndex: () => ({ first: async () => existingTriangle }) } as any;
            }
            return { withIndex: () => ({ collect: async () => [] }) } as any;
        },
        insert: async (table: string, doc: any) => {
            calls.inserts.push({ table, doc });
            return { _id: 'tri_mock' };
        },
        __calls: calls,
    } as any;
}

describe('triangleDetection.checkForCompletedTriangles', () => {
    it('inserts triangle when 3 edges present (diagonal example)', async () => {
        // Draw diagonal line 0,0-1,1 which completes two triangles in the 2x2 cell
        // Triangle TL: vertices (0,0), (0,1), (1,0) - edges: 0,0-0,1 (H), 0,0-1,0 (V), 0,0-1,1 (D)
        // Triangle BR: vertices (1,1), (1,0), (0,1) - edges: 1,0-1,1 (H), 0,1-1,1 (V), 0,0-1,1 (D)
        const lines: MockLine[] = [
            { lineKey: '0,0-0,1' }, // top horizontal
            { lineKey: '0,0-1,0' }, // left vertical
            { lineKey: '1,0-1,1' }, // bottom horizontal
            { lineKey: '0,1-1,1' }, // right vertical
            { lineKey: '0,0-1,1' }, // the diagonal being drawn
        ];

        const mockDb = makeMockDb({ lines, existingTriangle: null });
        const ctx: any = { db: mockDb };

        const res = await checkForCompletedTriangles(ctx, 'room1', '0,0-1,1', 'playerX', 0, 3);

        // Diagonal line at (0,0)-(1,1) completes TL and BR triangles
        expect(res.length).toBeGreaterThanOrEqual(1);
    });

    it('does not insert if triangle already exists', async () => {
        const lines: MockLine[] = [
            { lineKey: '0,0-0,1' },
            { lineKey: '0,0-1,0' },
            { lineKey: '1,0-1,1' },
            { lineKey: '0,1-1,1' },
            { lineKey: '0,0-1,1' },
        ];

        const mockDb = makeMockDb({ lines, existingTriangle: { _id: 'exists' } });
        const ctx: any = { db: mockDb };

        const res = await checkForCompletedTriangles(ctx, 'room1', '0,0-1,1', 'playerX', 0, 3);

        expect(res).toEqual([]);
    });
});
