export async function applyLine(ctx: any, roomId: any, lineKey: string, currentPlayer: any) {
  const inserted = await ctx.db.insert('lines', {
    roomId,
    lineKey,
    playerId: currentPlayer._id,
    playerIndex: currentPlayer.playerIndex,
    createdAt: Date.now(),
  });
  return inserted;
}
