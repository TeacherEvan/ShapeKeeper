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
    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingRoom = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", roomCode))
      .first();
    
    // Ensure uniqueness (rare collision)
    while (existingRoom) {
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
    // Find the room
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) {
      return { error: "Room not found" };
    }

    if (room.status !== "lobby") {
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

    if (players.length >= 6) {
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
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) {
      return { error: "Player not found" };
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return { error: "Room not found" };
    }

    // If game is in progress, just mark as disconnected
    if (room.status === "playing") {
      await ctx.db.patch(player._id, { isConnected: false });
      return { success: true, disconnected: true };
    }

    // In lobby, remove the player
    await ctx.db.delete(player._id);

    // Check remaining players
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // If no players left, delete the room
    if (remainingPlayers.length === 0) {
      await ctx.db.delete(args.roomId);
      return { success: true, roomDeleted: true };
    }

    // If host left, transfer to next player
    if (room.hostPlayerId === args.sessionId) {
      await ctx.db.patch(args.roomId, {
        hostPlayerId: remainingPlayers[0].sessionId,
        updatedAt: Date.now(),
      });
    }

    // Reindex remaining players
    for (let i = 0; i < remainingPlayers.length; i++) {
      await ctx.db.patch(remainingPlayers[i]._id, { playerIndex: i });
    }

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
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) {
      return { error: "Player not found" };
    }

    await ctx.db.patch(player._id, { isReady: !player.isReady });
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    return { isReady: !player.isReady };
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
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) {
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
        return { error: "Color already in use" };
      }
      updates.color = args.color;
    }

    await ctx.db.patch(player._id, updates);
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

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
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      return { error: "Only the host can change grid size" };
    }

    if (room.status !== "lobby") {
      return { error: "Cannot change grid size while game is in progress" };
    }

    await ctx.db.patch(args.roomId, {
      gridSize: args.gridSize,
      updatedAt: Date.now(),
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
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      return { error: "Only the host can change party mode" };
    }

    if (room.status !== "lobby") {
      return { error: "Cannot change party mode while game is in progress" };
    }

    await ctx.db.patch(args.roomId, {
      partyMode: args.partyMode,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

    if (room.status !== "lobby") {
      return { error: "Cannot change grid size during game" };
    }

    await ctx.db.patch(args.roomId, {
      gridSize: args.gridSize,
      updatedAt: Date.now(),
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
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) {
      return null;
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

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
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      return { error: "Only the host can start the game" };
    }

    if (room.status !== "lobby") {
      return { error: "Game already started" };
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    if (players.length < 2) {
      return { error: "Need at least 2 players to start" };
    }

    const allReady = players.every((p) => p.isReady || p.sessionId === room.hostPlayerId);
    if (!allReady) {
      return { error: "All players must be ready" };
    }

    await ctx.db.patch(args.roomId, {
      status: "playing",
      currentPlayerIndex: 0,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
