import { checkForCompletedSquares } from './squareDetection';
import { checkForCompletedTriangles } from './triangleDetection';

/**
 * Resolve shapes after a line is drawn: persist squares/triangles, update scores,
 * advance or retain turn, check game over. Returns an object describing outcomes.
 */
export async function resolveLineEffects(
  ctx: any,
  room: any,
  roomId: any,
  currentPlayer: any
) {
  const completedSquares = await checkForCompletedSquares(
    ctx,
    roomId,
    /* newLineKey will be read by caller from context if needed */ ctx.__newLineKey,
    currentPlayer._id,
    currentPlayer.playerIndex,
    room.gridSize
  );

  const completedTriangles = await checkForCompletedTriangles(
    ctx,
    roomId,
    ctx.__newLineKey,
    currentPlayer._id,
    currentPlayer.playerIndex,
    room.gridSize
  );

  // Update player score for squares only (server authoritative)
  if (completedSquares.length > 0) {
    const newScore = (currentPlayer.score || 0) + completedSquares.length;
    await ctx.db.patch(currentPlayer._id, { score: newScore });
  }

  // Check for game over (based on squares)
  const totalSquares = (room.gridSize - 1) * (room.gridSize - 1);
  const allSquares = await ctx.db.query('squares').withIndex('by_room', (q: any) => q.eq('roomId', roomId)).collect();

  if (allSquares.length >= totalSquares) {
    await ctx.db.patch(roomId, { status: 'finished', updatedAt: Date.now() });
    return {
      completedSquares: completedSquares.length,
      completedTriangles: completedTriangles.length,
      gameOver: true,
      keepTurn: completedSquares.length > 0,
    };
  }

  // Advance or retain turn (squares retain, triangles do not)
  if (completedSquares.length === 0) {
    const players = await ctx.db.query('players').withIndex('by_room', (q: any) => q.eq('roomId', roomId)).collect();
    const sortedPlayers = players.sort((a: any, b: any) => a.playerIndex - b.playerIndex);
    const nextPlayerIndex = (room.currentPlayerIndex + 1) % sortedPlayers.length;
    await ctx.db.patch(roomId, { currentPlayerIndex: nextPlayerIndex, updatedAt: Date.now() });
    return {
      completedSquares: 0,
      completedTriangles: completedTriangles.length,
      gameOver: false,
      keepTurn: false,
    };
  }

  // Player completed at least one square -> retain turn
  await ctx.db.patch(roomId, { updatedAt: Date.now() });
  return {
    completedSquares: completedSquares.length,
    completedTriangles: completedTriangles.length,
    gameOver: false,
    keepTurn: true,
  };
}
