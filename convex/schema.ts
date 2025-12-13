import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Game rooms/sessions
  rooms: defineTable({
    roomCode: v.string(),           // 6-character code for joining
    hostPlayerId: v.string(),       // Session ID of the host
    gridSize: v.number(),           // 5, 10, 20, or 30
    partyMode: v.optional(v.boolean()), // Party mode enabled (tile effects)
    status: v.union(
      v.literal("lobby"),
      v.literal("playing"),
      v.literal("finished")
    ),
    currentPlayerIndex: v.number(), // Index into players array for current turn
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["roomCode"])
    .index("by_status", ["status"]),

  // Players in rooms
  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),          // Browser session identifier
    name: v.string(),
    color: v.string(),              // Hex color code
    score: v.number(),
    isReady: v.boolean(),
    isConnected: v.boolean(),
    playerIndex: v.number(),        // Turn order (0-5)
    joinedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_session", ["sessionId"])
    .index("by_room_and_session", ["roomId", "sessionId"]),

  // Game state - lines drawn
  lines: defineTable({
    roomId: v.id("rooms"),
    lineKey: v.string(),            // Normalized line key like "1,2-1,3"
    playerId: v.id("players"),      // Who drew this line
    playerIndex: v.number(),        // For quick color lookup
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_key", ["roomId", "lineKey"]),

  // Completed squares
  squares: defineTable({
    roomId: v.id("rooms"),
    squareKey: v.string(),          // Key like "1,2" for row,col
    playerId: v.id("players"),      // Who completed this square
    playerIndex: v.number(),        // For quick color lookup
    multiplier: v.optional(v.object({
      type: v.union(v.literal("multiplier"), v.literal("truthOrDare")),
      value: v.optional(v.number()),
    })),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_key", ["roomId", "squareKey"]),

  // Completed triangles
  triangles: defineTable({
    roomId: v.id("rooms"),
    triangleKey: v.string(),        // Key like "tri-1,2-TR" for position and corner
    playerId: v.id("players"),      // Who completed this triangle
    playerIndex: v.number(),        // For quick color lookup
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_key", ["roomId", "triangleKey"]),
});
