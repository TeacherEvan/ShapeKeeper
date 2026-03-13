import { normalizeLineKey } from './shared';

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
        key: string;
        vertices: Array<{ row: number; col: number }>;
    }> = [];

    if (Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1) {
        const row = Math.min(r1, r2);
        const col = Math.min(c1, c2);

        if (row > 0 && col > 0) {
            potentialTriangles.push({
                key: `tri-${row - 1},${col - 1}-TL`,
                vertices: [
                    { row: row - 1, col: col - 1 },
                    { row: row - 1, col: col },
                    { row, col: col - 1 },
                ],
            });
        }
        if (row > 0 && col < gridSize - 1) {
            potentialTriangles.push({
                key: `tri-${row - 1},${col}-TR`,
                vertices: [
                    { row: row - 1, col },
                    { row: row - 1, col: col + 1 },
                    { row, col: col + 1 },
                ],
            });
        }
        if (row < gridSize - 1 && col > 0) {
            potentialTriangles.push({
                key: `tri-${row},${col - 1}-BL`,
                vertices: [
                    { row, col: col - 1 },
                    { row: row + 1, col: col - 1 },
                    { row: row + 1, col },
                ],
            });
        }
        if (row < gridSize - 1 && col < gridSize - 1) {
            potentialTriangles.push({
                key: `tri-${row},${col}-BR`,
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
                key: `tri-${row - 1},${col - 1}-TL`,
                vertices: [
                    { row: row - 1, col: col - 1 },
                    { row: row - 1, col },
                    { row, col: col - 1 },
                ],
            });
        }
        if (row > 0 && col < gridSize - 1) {
            potentialTriangles.push({
                key: `tri-${row - 1},${col}-TR`,
                vertices: [
                    { row: row - 1, col },
                    { row: row - 1, col: col + 1 },
                    { row, col: col + 1 },
                ],
            });
        }
        if (row < gridSize - 1 && col > 0) {
            potentialTriangles.push({
                key: `tri-${row},${col - 1}-BL`,
                vertices: [
                    { row, col: col - 1 },
                    { row: row + 1, col: col - 1 },
                    { row: row + 1, col },
                ],
            });
        }
        if (row < gridSize - 1 && col < gridSize - 1) {
            potentialTriangles.push({
                key: `tri-${row},${col}-BR`,
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
                key: `tri-${row - 1},${col - 1}-TL`,
                vertices: [
                    { row: row - 1, col: col - 1 },
                    { row: row - 1, col },
                    { row, col: col - 1 },
                ],
            });
        }
        if (col > 0 && row < gridSize - 1) {
            potentialTriangles.push({
                key: `tri-${row},${col - 1}-BL`,
                vertices: [
                    { row, col: col - 1 },
                    { row: row + 1, col: col - 1 },
                    { row: row + 1, col },
                ],
            });
        }
        if (col < gridSize - 1 && row > 0) {
            potentialTriangles.push({
                key: `tri-${row - 1},${col}-TR`,
                vertices: [
                    { row: row - 1, col },
                    { row: row - 1, col: col + 1 },
                    { row, col: col + 1 },
                ],
            });
        }
        if (col < gridSize - 1 && row < gridSize - 1) {
            potentialTriangles.push({
                key: `tri-${row},${col}-BR`,
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
        const edge1 = normalizeLineKey(first.row, first.col, second.row, second.col);
        const edge2 = normalizeLineKey(second.row, second.col, third.row, third.col);
        const edge3 = normalizeLineKey(third.row, third.col, first.row, first.col);

        if (!lineSet.has(edge1) || !lineSet.has(edge2) || !lineSet.has(edge3)) {
            continue;
        }

        const existingTriangle = await ctx.db
            .query('triangles')
            .withIndex('by_room_and_key', (q: any) =>
                q.eq('roomId', roomId).eq('triangleKey', triangle.key)
            )
            .first();

        if (existingTriangle) {
            continue;
        }

        await ctx.db.insert('triangles', {
            roomId,
            triangleKey: triangle.key,
            playerId,
            playerIndex,
            createdAt: Date.now(),
        });

        console.log('[checkForCompletedTriangles] Triangle completed!', {
            triangleKey: triangle.key,
            playerId,
            playerIndex,
        });

        completedTriangles.push(triangle.key);
    }

    console.log('[checkForCompletedTriangles] Check complete', {
        completedTriangles: completedTriangles.length,
        triangleKeys: completedTriangles,
    });

    return completedTriangles;
}
