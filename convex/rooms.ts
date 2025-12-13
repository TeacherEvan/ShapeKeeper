import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a random 6-character room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluded confusing chars (I, O, 0, 1)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Default player colors (up to 6 players)
const DEFAULT_COLORS = [
  "#FF0000", // Red
  "#0000FF", // Blue
  "#00FF00", // Green
  "#FF8C00", // Orange
  "#8B00FF", // Purple
  "#00FFFF", // Cyan
];

// Create a new room
export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    playerName: v.string(),
    gridSize: v.number(),
    partyMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log('[createRoom] Starting room creation', {
      sessionId: args.sessionId,
      playerName: args.playerName,
      gridSize: args.gridSize,
      partyMode: args.partyMode,
    });

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingRoom = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", roomCode))
      .first();
    
    // Ensure uniqueness (rare collision)
    let collisionCount = 0;
    while (existingRoom) {
      collisionCount++;
      console.log('[createRoom] Room code collision detected', { roomCode, collisionCount });
      roomCode = generateRoomCode();
      existingRoom = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("roomCode", roomCode))
        .first();
    }

    const now = Date.now();

    // Create the room with party mode setting (default true)
    const roomId = await ctx.db.insert("rooms", {
      roomCode,
      hostPlayerId: args.sessionId,
      gridSize: args.gridSize,
      partyMode: args.partyMode !== false, // Default to true
      status: "lobby",
      currentPlayerIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    console.log('[createRoom] Room created successfully', { roomId, roomCode });

    // Add the host as first player
    await ctx.db.insert("players", {
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

    console.log('[createRoom] Host player added', { roomId, sessionId: args.sessionId });

    return { roomId, roomCode };
  },
});

// Join an existing room
export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    sessionId: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[joinRoom] Join request', {
      roomCode: args.roomCode,
      sessionId: args.sessionId,
      playerName: args.playerName,
    });

    // Find the room
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) {
      console.log('[joinRoom] Error: Room not found', { roomCode: args.roomCode });
      return { error: "Room not found" };
    }

    console.log('[joinRoom] Room found', { roomId: room._id, status: room.status });

    if (room.status !== "lobby") {
      console.log('[joinRoom] Error: Game already in progress', { roomId: room._id, status: room.status });
      return { error: "Game already in progress" };
    }

    // Check if player already in room (rejoin)
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", room._id).eq("sessionId", args.sessionId)
      )
      .first();

    if (existingPlayer) {
      console.log('[joinRoom] Player rejoining', { roomId: room._id, playerId: existingPlayer._id });
      // Rejoin - update connection status
      await ctx.db.patch(existingPlayer._id, {
        isConnected: true,
        name: args.playerName,
      });
      return { roomId: room._id, playerId: existingPlayer._id, rejoined: true };
    }

    // Get current player count
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    console.log('[joinRoom] Current players', { roomId: room._id, playerCount: players.length });

    if (players.length >= 6) {
      console.log('[joinRoom] Error: Room is full', { roomId: room._id, playerCount: players.length });
      return { error: "Room is full (max 6 players)" };
    }

    // Find an available color
    const usedColors = new Set(players.map((p) => p.color));
    const availableColor = DEFAULT_COLORS.find((c) => !usedColors.has(c)) || DEFAULT_COLORS[0];

    // Add the player
    const playerId = await ctx.db.insert("players", {
      roomId: room._id,
      sessionId: args.sessionId,
      name: args.playerName,
      color: availableColor,
      score: 0,
      isReady: false,
      isConnected: true,
      playerIndex: players.length,
      joinedAt: Date.now(),
    });

    console.log('[joinRoom] Player added successfully', {
      roomId: room._id,
      playerId,
      playerIndex: players.length,
      color: availableColor,
    });

    // Update room timestamp
    await ctx.db.patch(room._id, { updatedAt: Date.now() });

    return { roomId: room._id, playerId };
  },
});

// Leave a room
export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[leaveRoom] Leave request', { roomId: args.roomId, sessionId: args.sessionId });

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) {
      console.log('[leaveRoom] Error: Player not found', { roomId: args.roomId, sessionId: args.sessionId });
      return { error: "Player not found" };
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[leaveRoom] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    console.log('[leaveRoom] Processing leave', {
      roomId: args.roomId,
      playerId: player._id,
      roomStatus: room.status,
      isHost: room.hostPlayerId === args.sessionId,
    });

    // If game is in progress, just mark as disconnected
    if (room.status === "playing") {
      await ctx.db.patch(player._id, { isConnected: false });
      console.log('[leaveRoom] Player marked as disconnected', { playerId: player._id });
      return { success: true, disconnected: true };
    }

    // In lobby, remove the player
    await ctx.db.delete(player._id);
    console.log('[leaveRoom] Player removed from lobby', { playerId: player._id });

    // Check remaining players
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    console.log('[leaveRoom] Remaining players', { count: remainingPlayers.length });

    // If no players left, delete the room
    if (remainingPlayers.length === 0) {
      await ctx.db.delete(args.roomId);
      console.log('[leaveRoom] Room deleted (no remaining players)', { roomId: args.roomId });
      return { success: true, roomDeleted: true };
    }

    // If host left, transfer to next player
    if (room.hostPlayerId === args.sessionId) {
      const newHost = remainingPlayers[0];
      await ctx.db.patch(args.roomId, {
        hostPlayerId: newHost.sessionId,
        updatedAt: Date.now(),
      });
      console.log('[leaveRoom] Host transferred', {
        oldHost: args.sessionId,
        newHost: newHost.sessionId,
      });
    }

    // Reindex remaining players
    for (let i = 0; i < remainingPlayers.length; i++) {
      await ctx.db.patch(remainingPlayers[i]._id, { playerIndex: i });
    }

    console.log('[leaveRoom] Players reindexed', { count: remainingPlayers.length });

    return { success: true };
  },
});

// Toggle ready status
export const toggleReady = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[toggleReady] Toggle ready request', { roomId: args.roomId, sessionId: args.sessionId });

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) {
      console.log('[toggleReady] Error: Player not found', { roomId: args.roomId, sessionId: args.sessionId });
      return { error: "Player not found" };
    }

    const newReadyState = !player.isReady;
    await ctx.db.patch(player._id, { isReady: newReadyState });
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    console.log('[toggleReady] Ready status toggled', {
      playerId: player._id,
      playerName: player.name,
      oldReady: player.isReady,
      newReady: newReadyState,
    });

    return { isReady: newReadyState };
  },
});

// Update player settings (name, color)
export const updatePlayer = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log('[updatePlayer] Update player request', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      updates: { name: args.name, color: args.color },
    });

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) {
      console.log('[updatePlayer] Error: Player not found', { roomId: args.roomId, sessionId: args.sessionId });
      return { error: "Player not found" };
    }

    const updates: { name?: string; color?: string } = {};
    if (args.name) updates.name = args.name;
    if (args.color) {
      // Check if color is available
      const players = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();
      
      const colorInUse = players.some(
        (p) => p._id !== player._id && p.color === args.color
      );
      
      if (colorInUse) {
        console.log('[updatePlayer] Error: Color already in use', {
          requestedColor: args.color,
          playerId: player._id,
        });
        return { error: "Color already in use" };
      }
      updates.color = args.color;
    }

    await ctx.db.patch(player._id, updates);
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    console.log('[updatePlayer] Player updated successfully', {
      playerId: player._id,
      updates,
    });

    return { success: true };
  },
});

// Update grid size (host only)
export const updateGridSize = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    gridSize: v.number(),
  },
  handler: async (ctx, args) => {
    console.log('[updateGridSize] Update grid size request', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      newGridSize: args.gridSize,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[updateGridSize] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      console.log('[updateGridSize] Error: Not host', {
        requestingSession: args.sessionId,
        hostSession: room.hostPlayerId,
      });
      return { error: "Only the host can change grid size" };
    }

    if (room.status !== "lobby") {
      console.log('[updateGridSize] Error: Game in progress', {
        roomId: args.roomId,
        status: room.status,
      });
      return { error: "Cannot change grid size while game is in progress" };
    }

    await ctx.db.patch(args.roomId, {
      gridSize: args.gridSize,
      updatedAt: Date.now(),
    });

    console.log('[updateGridSize] Grid size updated', {
      roomId: args.roomId,
      oldGridSize: room.gridSize,
      newGridSize: args.gridSize,
    });

    return { success: true };
  },
});

// Update party mode (host only)
export const updatePartyMode = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    partyMode: v.boolean(),
  },
  handler: async (ctx, args) => {
    console.log('[updatePartyMode] Update party mode request', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      newPartyMode: args.partyMode,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[updatePartyMode] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      console.log('[updatePartyMode] Error: Not host', {
        requestingSession: args.sessionId,
        hostSession: room.hostPlayerId,
      });
      return { error: "Only the host can change party mode" };
    }

    if (room.status !== "lobby") {
      console.log('[updatePartyMode] Error: Game in progress', {
        roomId: args.roomId,
        status: room.status,
      });
      return { error: "Cannot change party mode while game is in progress" };
    }

    await ctx.db.patch(args.roomId, {
      partyMode: args.partyMode,
      updatedAt: Date.now(),
    });

    console.log('[updatePartyMode] Party mode updated', {
      roomId: args.roomId,
      oldPartyMode: room.partyMode,
      newPartyMode: args.partyMode,
    });

    return { success: true };
  },
});

// Get room by code (for joining)
export const getRoomByCode = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[getRoomByCode] Query room by code', { roomCode: args.roomCode });

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) {
      console.log('[getRoomByCode] Room not found', { roomCode: args.roomCode });
      return null;
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    console.log('[getRoomByCode] Room found', {
      roomId: room._id,
      roomCode: room.roomCode,
      status: room.status,
      playerCount: players.length,
    });

    return {
      ...room,
      players: players.sort((a, b) => a.playerIndex - b.playerIndex),
    };
  },
});

// Get room state (for subscriptions)
export const getRoom = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return null;
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return {
      ...room,
      players: players.sort((a, b) => a.playerIndex - b.playerIndex),
    };
  },
});

// Start the game (host only)
export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[startGame] Start game request', { roomId: args.roomId, sessionId: args.sessionId });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[startGame] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      console.log('[startGame] Error: Not host', {
        requestingSession: args.sessionId,
        hostSession: room.hostPlayerId,
      });
      return { error: "Only the host can start the game" };
    }

    if (room.status !== "lobby") {
      console.log('[startGame] Error: Game already started', { roomId: args.roomId, status: room.status });
      return { error: "Game already started" };
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    console.log('[startGame] Validating players', {
      roomId: args.roomId,
      playerCount: players.length,
      players: players.map(p => ({ name: p.name, isReady: p.isReady, sessionId: p.sessionId })),
    });

    if (players.length < 2) {
      console.log('[startGame] Error: Not enough players', { playerCount: players.length });
      return { error: "Need at least 2 players to start" };
    }

    const allReady = players.every((p) => p.isReady || p.sessionId === room.hostPlayerId);
    if (!allReady) {
      console.log('[startGame] Error: Not all players ready', {
        notReady: players.filter(p => !p.isReady && p.sessionId !== room.hostPlayerId).map(p => p.name),
      });
      return { error: "All players must be ready" };
    }

    await ctx.db.patch(args.roomId, {
      status: "playing",
      currentPlayerIndex: 0,
      updatedAt: Date.now(),
    });

    console.log('[startGame] Game started successfully', {
      roomId: args.roomId,
      playerCount: players.length,
      gridSize: room.gridSize,
      partyMode: room.partyMode,
    });

    return { success: true };
  },
});
