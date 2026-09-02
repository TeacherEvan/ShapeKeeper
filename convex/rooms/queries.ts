import { projectPlayersForClient, projectRoomForClient } from '../auth/token';

export async function getRoomByCodeHandler(ctx: any, args: any) {
    const room = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q: any) => q.eq('roomCode', args.roomCode.toUpperCase()))
        .first();

    if (!room) {
        return null;
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
        .collect();

    // Public projection: strips hostTokenHash, hostPlayerId, and every
    // player's sessionId. Adds server-computed isHost and isYou when the
    // caller supplies their sessionId, so the browser can identify its own
    // row and know whether it is the host — without ever learning anyone
    // else's sessionId.
    return {
        ...projectRoomForClient(room, args.sessionId),
        players: projectPlayersForClient(
            players.sort((a: any, b: any) => a.playerIndex - b.playerIndex),
            args.sessionId
        ),
    };
}

export async function getRoomHandler(ctx: any, args: any) {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
        return null;
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    return {
        ...projectRoomForClient(room, args.sessionId),
        players: projectPlayersForClient(
            players.sort((a: any, b: any) => a.playerIndex - b.playerIndex),
            args.sessionId
        ),
    };
}
