export async function validateDrawLine(
  ctx: any,
  roomId: any,
  sessionId: string,
  lineKey: string
) {
  const room = await ctx.db.get(roomId);
  if (!room) return { ok: false, error: 'Room not found' };
  if (room.status !== 'playing') return { ok: false, error: 'Game not in progress' };

  const players = await ctx.db
    .query('players')
    .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
    .collect();

  const sortedPlayers = players.sort((a: any, b: any) => a.playerIndex - b.playerIndex);
  const currentPlayer = sortedPlayers[room.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.sessionId !== sessionId) {
    return { ok: false, error: 'Not your turn' };
  }

  const existingLine = await ctx.db
    .query('lines')
    .withIndex('by_room_and_key', (q: any) => q.eq('roomId', roomId).eq('lineKey', lineKey))
    .first();

  if (existingLine) return { ok: false, error: 'Line already drawn' };

  return { ok: true, room, sortedPlayers, currentPlayer };
}
