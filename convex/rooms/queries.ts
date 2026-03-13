export async function getRoomByCodeHandler(ctx: any, args: any) {
    console.log('[getRoomByCode] Query room by code', { roomCode: args.roomCode });

    const room = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q: any) => q.eq('roomCode', args.roomCode.toUpperCase()))
        .first();

    if (!room) {
        console.log('[getRoomByCode] Room not found', { roomCode: args.roomCode });
        return null;
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
        .collect();

    console.log('[getRoomByCode] Room found', {
        roomId: room._id,
        roomCode: room.roomCode,
        status: room.status,
        playerCount: players.length,
    });

    return {
        ...room,
        players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex),
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
        ...room,
        players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex),
    };
}
