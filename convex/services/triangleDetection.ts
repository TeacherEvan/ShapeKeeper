import { normalizeLineKey } from '../utils/lineKeyNormalizer';

/**
 * Detect and persist completed triangles caused by `newLineKey`.
 * Returns an array of triangle keys that were created.
 */
export async function checkForCompletedTriangles(
  ctx: any,
  roomId: any,
  newLineKey: string,
  playerId: any,
  playerIndex: number,
  gridSize: number
): Promise<string[]> {
  const [start, end] = newLineKey.split('-');
  const [r1, c1] = start.split(',').map(Number);
  const [r2, c2] = end.split(',').map(Number);

  const completedTriangles: string[] = [];
  const potentialTriangles: Array<{ key: string; vertices: Array<{ row: number; col: number }> }> = [];

  // Get all lines in the room for checking
  const allLines = await ctx.db.query('lines').withIndex('by_room', (q: any) => q.eq('roomId', roomId)).collect();
  const lineSet = new Set(allLines.map((l: any) => l.lineKey));

  // Determine potential triangles based on line type
  if (Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1) {
    // Diagonal line - can complete triangles in adjacent cells
    const row = Math.min(r1, r2);
    const col = Math.min(c1, c2);

    // Top-left triangle
    if (row > 0 && col > 0) {
      potentialTriangles.push({
        key: `tri-${row - 1},${col - 1}-TL`,
        vertices: [
          { row: row - 1, col: col - 1 },
          { row: row - 1, col: col },
          { row: row, col: col - 1 },
        ],
      });
    }

    // Top-right triangle
    if (row > 0 && col < gridSize - 1) {
      potentialTriangles.push({
        key: `tri-${row - 1},${col}-TR`,
        vertices: [
          { row: row - 1, col: col },
          { row: row - 1, col: col + 1 },
          { row: row, col: col + 1 },
        ],
      });
    }

    // Bottom-left triangle
    if (row < gridSize - 1 && col > 0) {
      potentialTriangles.push({
        key: `tri-${row},${col - 1}-BL`,
        vertices: [
          { row: row, col: col - 1 },
          { row: row + 1, col: col - 1 },
          { row: row + 1, col: col },
        ],
      });
    }

    // Bottom-right triangle
    if (row < gridSize - 1 && col < gridSize - 1) {
      potentialTriangles.push({
        key: `tri-${row},${col}-BR`,
        vertices: [
          { row: row, col: col + 1 },
          { row: row + 1, col: col },
          { row: row + 1, col: col + 1 },
        ],
      });
    }
  } else if (r1 === r2) {
    // Horizontal line - check triangles above and below
    const row = r1;
    const col = Math.min(c1, c2);

    // Above
    if (row > 0) {
      // Top-left triangle
      if (col > 0) {
        potentialTriangles.push({
          key: `tri-${row - 1},${col - 1}-TL`,
          vertices: [
            { row: row - 1, col: col - 1 },
            { row: row - 1, col: col },
            { row: row, col: col - 1 },
          ],
        });
      }

      // Top-right triangle
      if (col < gridSize - 1) {
        potentialTriangles.push({
          key: `tri-${row - 1},${col}-TR`,
          vertices: [
            { row: row - 1, col: col },
            { row: row - 1, col: col + 1 },
            { row: row, col: col + 1 },
          ],
        });
      }
    }

    // Below
    if (row < gridSize - 1) {
      // Bottom-left triangle
      if (col > 0) {
        potentialTriangles.push({
          key: `tri-${row},${col - 1}-BL`,
          vertices: [
            { row: row, col: col - 1 },
            { row: row + 1, col: col - 1 },
            { row: row + 1, col: col },
          ],
        });
      }

      // Bottom-right triangle
      if (col < gridSize - 1) {
        potentialTriangles.push({
          key: `tri-${row},${col}-BR`,
          vertices: [
            { row: row, col: col + 1 },
            { row: row + 1, col: col },
            { row: row + 1, col: col + 1 },
          ],
        });
      }
    }
  } else {
    // Vertical line - check triangles left and right
    const row = Math.min(r1, r2);
    const col = c1;

    // Left
    if (col > 0) {
      // Top-left triangle
      if (row > 0) {
        potentialTriangles.push({
          key: `tri-${row - 1},${col - 1}-TL`,
          vertices: [
            { row: row - 1, col: col - 1 },
            { row: row - 1, col: col },
            { row: row, col: col - 1 },
          ],
        });
      }

      // Bottom-left triangle
      if (row < gridSize - 1) {
        potentialTriangles.push({
          key: `tri-${row},${col - 1}-BL`,
          vertices: [
            { row: row, col: col - 1 },
            { row: row + 1, col: col - 1 },
            { row: row + 1, col: col },
          ],
        });
      }
    }

    // Right
    if (col < gridSize - 1) {
      // Top-right triangle
      if (row > 0) {
        potentialTriangles.push({
          key: `tri-${row - 1},${col}-TR`,
          vertices: [
            { row: row - 1, col: col },
            { row: row - 1, col: col + 1 },
            { row: row, col: col + 1 },
          ],
        });
      }

      // Bottom-right triangle
      if (row < gridSize - 1) {
        potentialTriangles.push({
          key: `tri-${row},${col}-BR`,
          vertices: [
            { row: row, col: col + 1 },
            { row: row + 1, col: col },
            { row: row + 1, col: col + 1 },
          ],
        });
      }
    }
  }

  // Check each potential triangle
  for (const triangle of potentialTriangles) {
    const { key, vertices } = triangle;

    const edge1 = normalizeLineKey(vertices[0].row, vertices[0].col, vertices[1].row, vertices[1].col);
    const edge2 = normalizeLineKey(vertices[1].row, vertices[1].col, vertices[2].row, vertices[2].col);
    const edge3 = normalizeLineKey(vertices[2].row, vertices[2].col, vertices[0].row, vertices[0].col);

    if (lineSet.has(edge1) && lineSet.has(edge2) && lineSet.has(edge3)) {
      // Check if triangle already recorded
      const existingTriangle = await ctx.db
        .query('triangles')
        .withIndex('by_room_and_key', (q: any) => q.eq('roomId', roomId).eq('triangleKey', key))
        .first();

      if (!existingTriangle) {
        await ctx.db.insert('triangles', {
          roomId,
          triangleKey: key,
          playerId,
          playerIndex,
          createdAt: Date.now(),
        });

        completedTriangles.push(key);
      }
    }
  }

  return completedTriangles;
}
