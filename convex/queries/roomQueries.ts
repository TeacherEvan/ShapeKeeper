import { v } from 'convex/values';
import { query } from '../_generated/server';

export const getRoomByCode = query({
  args: { roomCode: v.string() },
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

    return { ...room, players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex) };
  },
});

export const getRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
      .collect();

    return { ...room, players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex) };
  },
});

// List open lobbies for the lobby browser (JOIN LOBBY screen). Only rooms
// still waiting for players (status === 'lobby') are listed; in-progress and
// finished matches are excluded. Player counts and the host name are joined
// in-memory — the room count for a party game stays small, so a scan +
// filter avoids a schema migration. Newest lobbies first.
export const listOpenLobbies = query({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db.query('rooms').collect();
    const openRooms = (rooms as any[])
      .filter((room) => room.status === 'lobby')
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return Promise.all(
      openRooms.map(async (room) => {
        const players = await ctx.db
          .query('players')
          .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
          .collect();
        const host = players.find((player: any) => player.sessionId === room.hostPlayerId);
        return {
          roomId: room._id,
          roomCode: room.roomCode,
          hostName: host?.name ?? 'Host',
          playerCount: players.length,
          maxPlayers: 6,
          gridSize: room.gridSize,
          turnDurationSeconds: room.turnDurationSeconds ?? null,
          partyMode: room.partyMode ?? false,
          createdAt: room.createdAt,
        };
      })
    );
  },
});
