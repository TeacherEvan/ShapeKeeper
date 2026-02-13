import { normalizeLineKey } from '../utils/lineKeyNormalizer';
import { generateMultiplier } from './multiplierGenerator';

/**
 * Find and persist completed squares caused by `newLineKey`.
 * Returns array of squareKeys that were created.
 */
export async function checkForCompletedSquares(
  ctx: any,
  roomId: any,
  newLineKey: string,
  playerId: any,
  playerIndex: number,
  gridSize: number
): Promise<string[]> {
  // Parse the line key to get coordinates
  const [start, end] = newLineKey.split('-');
  const [r1, c1] = start.split(',').map(Number);
  const [r2, c2] = end.split(',').map(Number);

  const completedSquares: string[] = [];
  const potentialSquares: Array<{ row: number; col: number }> = [];

  // Determine which squares this line could complete
  if (r1 === r2) {
    // Horizontal line - check squares above and below
    const col = Math.min(c1, c2);
    if (r1 > 0) potentialSquares.push({ row: r1 - 1, col }); // Square above
    if (r1 < gridSize - 1) potentialSquares.push({ row: r1, col }); // Square below
  } else {
    // Vertical line - check squares left and right
    const row = Math.min(r1, r2);
    if (c1 > 0) potentialSquares.push({ row, col: c1 - 1 }); // Square left
    if (c1 < gridSize - 1) potentialSquares.push({ row, col: c1 }); // Square right
  }

  // Get all lines in the room for checking
  const allLines = await ctx.db
    .query('lines')
    .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
    .collect();

  const lineSet = new Set(allLines.map((l: any) => l.lineKey));

  // Check each potential square
  for (const square of potentialSquares) {
    const { row, col } = square;

    // Generate the four line keys for this square
    const topLine = normalizeLineKey(row, col, row, col + 1);
    const bottomLine = normalizeLineKey(row + 1, col, row + 1, col + 1);
    const leftLine = normalizeLineKey(row, col, row + 1, col);
    const rightLine = normalizeLineKey(row, col + 1, row + 1, col + 1);

    const hasAllSides =
      lineSet.has(topLine) &&
      lineSet.has(bottomLine) &&
      lineSet.has(leftLine) &&
      lineSet.has(rightLine);

    if (!hasAllSides) continue;

    const squareKey = `${row},${col}`;

    // Check if square already recorded
    const existingSquare = await ctx.db
      .query('squares')
      .withIndex('by_room_and_key', (q: any) => q.eq('roomId', roomId).eq('squareKey', squareKey))
      .first();

    if (!existingSquare) {
      const multiplier = generateMultiplier();

      await ctx.db.insert('squares', {
        roomId,
        squareKey,
        playerId,
        playerIndex,
        multiplier,
        createdAt: Date.now(),
      });

      completedSquares.push(squareKey);
    }
  }

  return completedSquares;
}
