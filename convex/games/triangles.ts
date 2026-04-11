import { normalizeLineKey } from './shared';

function buildTriangleKey(vertices: Array<{ row: number; col: number }>): string {
    const sorted = [...vertices].sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
    return `tri-${sorted[0].row},${sorted[0].col}-${sorted[1].row},${sorted[1].col}-${sorted[2].row},${sorted[2].col}`;
}

export async function checkForCompletedTriangles(
    ctx: any,
    roomId: any,
    newLineKey: string,
    playerId: any,
    playerIndex: number,
    gridSize: number
): Promise<string[]> {
    console.log('[checkForCompletedTriangles] Starting triangle check', {
        newLineKey,
        playerId,
        playerIndex,
        gridSize,
    });

    const [start, end] = newLineKey.split('-');
    const [r1, c1] = start.split(',').map(Number);
    const [r2, c2] = end.split(',').map(Number);
    const completedTriangles: string[] = [];

    const allLines = await ctx.db
        .query('lines')
        .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
        .collect();

    const lineSet = new Set(allLines.map((line: any) => line.lineKey));
    const potentialTriangles: Array<{
        vertices: Array<{ row: number; col: number }>;
    }> = [];

    if (Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1) {
        const row = Math.min(r1, r2);
        const col = Math.min(c1, c2);
        const isTLtoBR = (r1 < r2 && c1 < c2) || (r2 < r1 && c2 < c1);

        if (isTLtoBR) {
            potentialTriangles.push({
                vertices: [
                    { row, col },
                    { row, col: col + 1 },
                    { row: row + 1, col: col + 1 },
                ],
            });
            potentialTriangles.push({
                vertices: [
                    { row, col },
                    { row: row + 1, col },
                    { row: row + 1, col: col + 1 },
                ],
            });
        } else {
            potentialTriangles.push({
                vertices: [
                    { row, col },
                    { row, col: col + 1 },
                    { row: row + 1, col },
                ],
            });
            potentialTriangles.push({
                vertices: [
                    { row, col: col + 1 },
                    { row: row + 1, col },
                    { row: row + 1, col: col + 1 },
                ],
            });
        }
    } else if (r1 === r2) {
        const row = r1;
        const col = Math.min(c1, c2);

        if (row > 0 && col > 0) {
            potentialTriangles.push({
                vertices: [
                    { row: row - 1, col: col - 1 },
                    { row: row - 1, col },
                    { row, col: col - 1 },
                ],
            });
        }
        if (row > 0 && col < gridSize - 1) {
            potentialTriangles.push({
                vertices: [
                    { row: row - 1, col },
                    { row: row - 1, col: col + 1 },
                    { row, col: col + 1 },
                ],
            });
        }
        if (row < gridSize - 1 && col > 0) {
            potentialTriangles.push({
                vertices: [
                    { row, col: col - 1 },
                    { row: row + 1, col: col - 1 },
                    { row: row + 1, col },
                ],
            });
        }
        if (row < gridSize - 1 && col < gridSize - 1) {
            potentialTriangles.push({
                vertices: [
                    { row, col: col + 1 },
                    { row: row + 1, col },
                    { row: row + 1, col: col + 1 },
                ],
            });
        }
    } else {
        const row = Math.min(r1, r2);
        const col = c1;

        if (col > 0 && row > 0) {
            potentialTriangles.push({
                vertices: [
                    { row: row - 1, col: col - 1 },
                    { row: row - 1, col },
                    { row, col: col - 1 },
                ],
            });
        }
        if (col > 0 && row < gridSize - 1) {
            potentialTriangles.push({
                vertices: [
                    { row, col: col - 1 },
                    { row: row + 1, col: col - 1 },
                    { row: row + 1, col },
                ],
            });
        }
        if (col < gridSize - 1 && row > 0) {
            potentialTriangles.push({
                vertices: [
                    { row: row - 1, col },
                    { row: row - 1, col: col + 1 },
                    { row, col: col + 1 },
                ],
            });
        }
        if (col < gridSize - 1 && row < gridSize - 1) {
            potentialTriangles.push({
                vertices: [
                    { row, col: col + 1 },
                    { row: row + 1, col },
                    { row: row + 1, col: col + 1 },
                ],
            });
        }
    }

    for (const triangle of potentialTriangles) {
        const [first, second, third] = triangle.vertices;
        const triangleKey = buildTriangleKey(triangle.vertices);
        const edge1 = normalizeLineKey(first.row, first.col, second.row, second.col);
        const edge2 = normalizeLineKey(second.row, second.col, third.row, third.col);
        const edge3 = normalizeLineKey(third.row, third.col, first.row, first.col);

        if (!lineSet.has(edge1) || !lineSet.has(edge2) || !lineSet.has(edge3)) {
            continue;
        }

        const existingTriangle = await ctx.db
            .query('triangles')
            .withIndex('by_room_and_key', (q: any) =>
                q.eq('roomId', roomId).eq('triangleKey', triangleKey)
            )
            .first();

        if (existingTriangle) {
            continue;
        }

        await ctx.db.insert('triangles', {
            roomId,
            triangleKey,
            playerId,
            playerIndex,
            createdAt: Date.now(),
        });

        console.log('[checkForCompletedTriangles] Triangle completed!', {
            triangleKey,
            playerId,
            playerIndex,
        });

        completedTriangles.push(triangleKey);
    }

    console.log('[checkForCompletedTriangles] Check complete', {
        completedTriangles: completedTriangles.length,
        triangleKeys: completedTriangles,
    });

    return completedTriangles;
}
