import { v } from 'convex/values';
import { query } from '../_generated/server';
import { projectPlayersForClient, projectRoomForClient } from '../auth/token';

function formatRoomResponse(room: any, players: any[], sessionId?: string) {
  const { rematchVotes, ...roomRest } = room;
  const projectedRoom = projectRoomForClient(roomRest, sessionId);
  const sortedPlayers = players.slice().sort((a: any, b: any) => a.playerIndex - b.playerIndex);
  return {
    ...projectedRoom,
    rematchVoteCount: (rematchVotes ?? []).length,
    players: projectPlayersForClient(sortedPlayers, sessionId, room.hostPlayerId),
  };
}

export const getRoomByCode = query({
  args: {
    roomCode: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q: any) => q.eq('roomCode', args.roomCode.toUpperCase()))
      .first();

    if (!room) return null;

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
      .collect();

    return formatRoomResponse(room, players, args.sessionId);
  },
});

export const getRoom = query({
  args: {
    roomId: v.id('rooms'),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
      .collect();

    return formatRoomResponse(room, players, args.sessionId);
  },
});

// List open lobbies for the lobby browser (JOIN LOBBY screen). Only rooms
// still waiting for players (status === 'lobby') are listed; in-progress and
// finished matches are excluded. Indexed by status. Newest lobbies first.
export const listOpenLobbies = query({
  args: {},
  handler: async (ctx) => {
    const openRooms = await ctx.db
      .query('rooms')
      .withIndex('by_status', (q: any) => q.eq('status', 'lobby'))
      .collect();
    openRooms.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return Promise.all(
      openRooms.map(async (room: any) => {
        const players = await ctx.db
          .query('players')
          .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
          .collect();
        const host = players.find((player: any) => player.sessionId === room.hostPlayerId);
        const turnDurationSeconds =
          room.turnDurationSeconds ??
          (typeof room.turnDurationMs === 'number' ? Math.round(room.turnDurationMs / 1000) : null);
        return {
          roomId: room._id,
          roomCode: room.roomCode,
          hostName: host?.name ?? 'Host',
          playerCount: players.length,
          maxPlayers: 6,
          gridSize: room.gridSize,
          turnDurationSeconds,
          partyMode: room.partyMode ?? false,
          createdAt: room.createdAt,
        };
      })
    );
  },
});
