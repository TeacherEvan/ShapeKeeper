import { generateMultiplier, normalizeLineKey } from './shared';

export async function checkForCompletedSquares(
    ctx: any,
    roomId: any,
    newLineKey: string,
    playerId: any,
    playerIndex: number,
    gridSize: number
): Promise<string[]> {
    console.log('[checkForCompletedSquares] Starting square check', {
        newLineKey,
        playerId,
        playerIndex,
        gridSize,
    });

    const [start, end] = newLineKey.split('-');
    const [r1, c1] = start.split(',').map(Number);
    const [r2, c2] = end.split(',').map(Number);

    const completedSquares: string[] = [];
    const potentialSquares: Array<{ row: number; col: number }> = [];

    if (r1 === r2) {
        const col = Math.min(c1, c2);
        if (r1 > 0) potentialSquares.push({ row: r1 - 1, col });
        if (r1 < gridSize - 1) potentialSquares.push({ row: r1, col });
    } else {
        const row = Math.min(r1, r2);
        if (c1 > 0) potentialSquares.push({ row, col: c1 - 1 });
        if (c1 < gridSize - 1) potentialSquares.push({ row, col: c1 });
    }

    console.log('[checkForCompletedSquares] Potential squares to check', {
        lineType: r1 === r2 ? 'horizontal' : 'vertical',
        potentialSquares,
    });

    const allLines = await ctx.db
        .query('lines')
        .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
        .collect();

    const lineSet = new Set(allLines.map((line: any) => line.lineKey));
    console.log('[checkForCompletedSquares] Total lines in room', { lineCount: lineSet.size });

    for (const square of potentialSquares) {
        const { row, col } = square;
        const topLine = normalizeLineKey(row, col, row, col + 1);
        const bottomLine = normalizeLineKey(row + 1, col, row + 1, col + 1);
        const leftLine = normalizeLineKey(row, col, row + 1, col);
        const rightLine = normalizeLineKey(row, col + 1, row + 1, col + 1);

        const hasAllSides =
            lineSet.has(topLine) &&
            lineSet.has(bottomLine) &&
            lineSet.has(leftLine) &&
            lineSet.has(rightLine);

        if (!hasAllSides) {
            continue;
        }

        const squareKey = `${row},${col}`;
        const existingSquare = await ctx.db
            .query('squares')
            .withIndex('by_room_and_key', (q: any) =>
                q.eq('roomId', roomId).eq('squareKey', squareKey)
            )
            .first();

        if (existingSquare) {
            continue;
        }

        const multiplier = generateMultiplier();
        await ctx.db.insert('squares', {
            roomId,
            squareKey,
            playerId,
            playerIndex,
            multiplier,
            createdAt: Date.now(),
        });

        console.log('[checkForCompletedSquares] Square completed!', {
            squareKey,
            playerId,
            playerIndex,
            multiplier,
        });

        completedSquares.push(squareKey);
    }

    console.log('[checkForCompletedSquares] Check complete', {
        completedSquares: completedSquares.length,
        squareKeys: completedSquares,
    });

    return completedSquares;
}
