import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { DEFAULT_COLORS, generateRoomCode, getHostTokenHash } from '../utils/roomUtils';
import { generateSillyPasscode } from '../rooms/shared';
import { DEFAULT_TURN_DURATION_MS } from '../games/turnTimer';
import { checkRateLimit } from '../rateLimit';

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    playerName: v.string(),
    gridSize: v.number(),
    // DEPRECATED: Party Mode removed; accepted and ignored for backward compatibility. Do not use.
    partyMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rl = await checkRateLimit(ctx, 'createRoom', args.sessionId);
    if (!rl.allowed) return { error: 'Rate limit exceeded', resetMs: rl.resetMs };

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingRoom = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q: any) => q.eq('roomCode', roomCode))
      .first();

    let collisionCount = 0;
    while (existingRoom) {
      collisionCount++;
      roomCode = generateRoomCode();
      existingRoom = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q: any) => q.eq('roomCode', roomCode))
        .first();
    }

    // Generate silly passcode [Adjective][Animal] with live by_passcode collision check
    let passcode = generateSillyPasscode();
    let existingPasscodeRoom = await ctx.db
      .query('rooms')
      .withIndex('by_passcode', (q: any) => q.eq('passcode', passcode))
      .first();

    let passcodeCollisions = 0;
    while (existingPasscodeRoom && passcodeCollisions < 10) {
      passcodeCollisions++;
      passcode = generateSillyPasscode();
      existingPasscodeRoom = await ctx.db
        .query('rooms')
        .withIndex('by_passcode', (q: any) => q.eq('passcode', passcode))
        .first();
    }

    // Generate host token for this room
    const hostToken = crypto.randomUUID();
    const hostTokenHash = await getHostTokenHash(hostToken);

    const now = Date.now();

    const roomId = await ctx.db.insert('rooms', {
      roomCode,
      passcode,
      hostPlayerId: args.sessionId,
      hostTokenHash,
      gridSize: args.gridSize,
      turnDurationSeconds: Math.round(DEFAULT_TURN_DURATION_MS / 1000),
      turnDurationMs: DEFAULT_TURN_DURATION_MS,
      status: 'lobby',
      currentPlayerIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert('players', {
      roomId,
      sessionId: args.sessionId,
      name: args.playerName,
      color: DEFAULT_COLORS[0],
      score: 0,
      isReady: false,
      isConnected: true,
      playerIndex: 0,
      joinedAt: now,
    });

    return { roomId, roomCode, hostToken, passcode };
  },
});
