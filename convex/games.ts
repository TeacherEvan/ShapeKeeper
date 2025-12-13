import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Constants for populate feature
// Must match frontend DotsAndBoxesGame.POPULATE_PLAYER_ID = 3
const POPULATE_PLAYER_ID = 3; // Display player ID for populate lines
const POPULATE_PLAYER_INDEX = 2; // Backend player index (0=Player1, 1=Player2, 2=Populate)

// Draw a line (make a move)
export const drawLine = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    lineKey: v.string(), // Normalized line key like "1,2-1,3"
  },
  handler: async (ctx, args) => {
    console.log('[drawLine] Line draw request', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      lineKey: args.lineKey,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[drawLine] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    if (room.status !== "playing") {
      console.log('[drawLine] Error: Game not in progress', {
        roomId: args.roomId,
        status: room.status,
      });
      return { error: "Game not in progress" };
    }

    // Get the current player
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    
    const sortedPlayers = players.sort((a, b) => a.playerIndex - b.playerIndex);
    const currentPlayer = sortedPlayers[room.currentPlayerIndex];

    console.log('[drawLine] Turn validation', {
      currentPlayerIndex: room.currentPlayerIndex,
      currentPlayerSession: currentPlayer?.sessionId,
      requestingSession: args.sessionId,
      isValidTurn: currentPlayer?.sessionId === args.sessionId,
    });

    if (!currentPlayer || currentPlayer.sessionId !== args.sessionId) {
      console.log('[drawLine] Error: Not player turn', {
        expectedSession: currentPlayer?.sessionId,
        receivedSession: args.sessionId,
      });
      return { error: "Not your turn" };
    }

    // Check if line already exists
    const existingLine = await ctx.db
      .query("lines")
      .withIndex("by_room_and_key", (q) =>
        q.eq("roomId", args.roomId).eq("lineKey", args.lineKey)
      )
      .first();

    if (existingLine) {
      console.log('[drawLine] Error: Line already drawn', {
        lineKey: args.lineKey,
        existingLineId: existingLine._id,
      });
      return { error: "Line already drawn" };
    }

    // Draw the line
    await ctx.db.insert("lines", {
      roomId: args.roomId,
      lineKey: args.lineKey,
      playerId: currentPlayer._id,
      playerIndex: currentPlayer.playerIndex,
      createdAt: Date.now(),
    });

    console.log('[drawLine] Line drawn successfully', {
      lineKey: args.lineKey,
      playerId: currentPlayer._id,
      playerIndex: currentPlayer.playerIndex,
    });

    // Check for completed squares
    const completedSquares = await checkForCompletedSquares(
      ctx,
      args.roomId,
      args.lineKey,
      currentPlayer._id,
      currentPlayer.playerIndex,
      room.gridSize
    );

    console.log('[drawLine] Square check complete', {
      lineKey: args.lineKey,
      completedSquares: completedSquares.length,
      squareKeys: completedSquares,
    });

    // Update scores if squares were completed
    if (completedSquares.length > 0) {
      const newScore = currentPlayer.score + completedSquares.length;
      await ctx.db.patch(currentPlayer._id, { score: newScore });
      console.log('[drawLine] Score updated', {
        playerId: currentPlayer._id,
        oldScore: currentPlayer.score,
        newScore,
      });
    }

    // Check if game is over
    const totalSquares = (room.gridSize - 1) * (room.gridSize - 1);
    const allSquares = await ctx.db
      .query("squares")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    console.log('[drawLine] Game progress', {
      completedSquares: allSquares.length,
      totalSquares,
      isGameOver: allSquares.length >= totalSquares,
    });

    if (allSquares.length >= totalSquares) {
      // Game over!
      await ctx.db.patch(args.roomId, {
        status: "finished",
        updatedAt: Date.now(),
      });
      console.log('[drawLine] Game over', {
        roomId: args.roomId,
        finalScores: sortedPlayers.map(p => ({ name: p.name, score: p.score })),
      });
      return { 
        success: true, 
        completedSquares: completedSquares.length,
        gameOver: true 
      };
    }

    // If no squares completed, advance to next player
    if (completedSquares.length === 0) {
      const nextPlayerIndex = (room.currentPlayerIndex + 1) % sortedPlayers.length;
      await ctx.db.patch(args.roomId, {
        currentPlayerIndex: nextPlayerIndex,
        updatedAt: Date.now(),
      });
      console.log('[drawLine] Turn advanced', {
        fromPlayerIndex: room.currentPlayerIndex,
        toPlayerIndex: nextPlayerIndex,
        nextPlayerName: sortedPlayers[nextPlayerIndex]?.name,
      });
    } else {
      // Player completed a square, keep their turn
      await ctx.db.patch(args.roomId, { updatedAt: Date.now() });
      console.log('[drawLine] Turn retained (squares completed)', {
        playerIndex: currentPlayer.playerIndex,
        playerName: currentPlayer.name,
      });
    }

    return { 
      success: true, 
      completedSquares: completedSquares.length,
      keepTurn: completedSquares.length > 0 
    };
  },
});

// Helper function to check for completed squares after drawing a line
async function checkForCompletedSquares(
  ctx: any,
  roomId: any,
  newLineKey: string,
  playerId: any,
  playerIndex: number,
  gridSize: number
): Promise<string[]> {
  console.log('[checkForCompletedSquares] Starting square check', {
    newLineKey,
    playerId,
    playerIndex,
    gridSize,
  });

  // Parse the line key to get coordinates
  const [start, end] = newLineKey.split("-");
  const [r1, c1] = start.split(",").map(Number);
  const [r2, c2] = end.split(",").map(Number);

  const completedSquares: string[] = [];
  const potentialSquares: Array<{ row: number; col: number }> = [];

  // Determine which squares this line could complete
  if (r1 === r2) {
    // Horizontal line - check squares above and below
    const col = Math.min(c1, c2);
    if (r1 > 0) potentialSquares.push({ row: r1 - 1, col }); // Square above
    if (r1 < gridSize - 1) potentialSquares.push({ row: r1, col }); // Square below
  } else {
    // Vertical line - check squares left and right
    const row = Math.min(r1, r2);
    if (c1 > 0) potentialSquares.push({ row, col: c1 - 1 }); // Square left
    if (c1 < gridSize - 1) potentialSquares.push({ row, col: c1 }); // Square right
  }

  console.log('[checkForCompletedSquares] Potential squares to check', {
    lineType: r1 === r2 ? 'horizontal' : 'vertical',
    potentialSquares,
  });

  // Get all lines in the room for checking
  const allLines = await ctx.db
    .query("lines")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();

  const lineSet = new Set(allLines.map((l: any) => l.lineKey));
  console.log('[checkForCompletedSquares] Total lines in room', { lineCount: lineSet.size });

  // Check each potential square
  for (const square of potentialSquares) {
    const { row, col } = square;
    
    // Generate the four line keys for this square
    const topLine = normalizeLineKey(row, col, row, col + 1);
    const bottomLine = normalizeLineKey(row + 1, col, row + 1, col + 1);
    const leftLine = normalizeLineKey(row, col, row + 1, col);
    const rightLine = normalizeLineKey(row, col + 1, row + 1, col + 1);

    const hasAllSides = lineSet.has(topLine) && lineSet.has(bottomLine) && lineSet.has(leftLine) && lineSet.has(rightLine);

    // Check if all four sides exist
    if (hasAllSides) {
      const squareKey = `${row},${col}`;
      
      // Check if square already recorded
      const existingSquare = await ctx.db
        .query("squares")
        .withIndex("by_room_and_key", (q: any) =>
          q.eq("roomId", roomId).eq("squareKey", squareKey)
        )
        .first();

      if (!existingSquare) {
        // Generate random multiplier
        const multiplier = generateMultiplier();
        
        await ctx.db.insert("squares", {
          roomId,
          squareKey,
          playerId,
          playerIndex,
          multiplier,
          createdAt: Date.now(),
        });
        
        console.log('[checkForCompletedSquares] Square completed!', {
          squareKey,
          playerId,
          playerIndex,
          multiplier,
        });

        completedSquares.push(squareKey);
      }
    }
  }

  console.log('[checkForCompletedSquares] Check complete', {
    completedSquares: completedSquares.length,
    squareKeys: completedSquares,
  });

  return completedSquares;
}

// Helper to normalize line keys (sorted coordinates)
function normalizeLineKey(r1: number, c1: number, r2: number, c2: number): string {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) {
    return `${r1},${c1}-${r2},${c2}`;
  }
  return `${r2},${c2}-${r1},${c1}`;
}

// Generate random multiplier based on distribution
function generateMultiplier(): { type: "multiplier" | "truthOrDare"; value?: number } | undefined {
  const rand = Math.random() * 100;
  
  if (rand < 60) return { type: "multiplier", value: 2 };
  if (rand < 80) return { type: "multiplier", value: 3 };
  if (rand < 90) return { type: "multiplier", value: 4 };
  if (rand < 95) return { type: "multiplier", value: 5 };
  if (rand < 96) return { type: "multiplier", value: 10 };
  if (rand < 100) return { type: "truthOrDare" };
  
  return undefined;
}

// Get game state (lines and squares)
export const getGameState = query({
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

    const lines = await ctx.db
      .query("lines")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const squares = await ctx.db
      .query("squares")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return {
      room,
      players: players.sort((a, b) => a.playerIndex - b.playerIndex),
      lines,
      squares,
    };
  },
});

// Reveal a multiplier (apply score bonus)
export const revealMultiplier = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    squareKey: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[revealMultiplier] Reveal request', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      squareKey: args.squareKey,
    });

    const square = await ctx.db
      .query("squares")
      .withIndex("by_room_and_key", (q) =>
        q.eq("roomId", args.roomId).eq("squareKey", args.squareKey)
      )
      .first();

    if (!square) {
      console.log('[revealMultiplier] Error: Square not found', {
        roomId: args.roomId,
        squareKey: args.squareKey,
      });
      return { error: "Square not found" };
    }

    const player = await ctx.db.get(square.playerId);
    if (!player || player.sessionId !== args.sessionId) {
      console.log('[revealMultiplier] Error: Not player square', {
        squarePlayerId: square.playerId,
        squarePlayerSession: player?.sessionId,
        requestingSession: args.sessionId,
      });
      return { error: "Not your square" };
    }

    if (!square.multiplier) {
      console.log('[revealMultiplier] Error: No multiplier', { squareKey: args.squareKey });
      return { error: "No multiplier on this square" };
    }

    console.log('[revealMultiplier] Multiplier found', {
      squareKey: args.squareKey,
      multiplier: square.multiplier,
      currentScore: player.score,
    });

    // Apply multiplier to score
    if (square.multiplier.type === "multiplier" && square.multiplier.value) {
      const bonus = square.multiplier.value;
      const newScore = player.score * bonus;
      await ctx.db.patch(player._id, { score: newScore });
      console.log('[revealMultiplier] Score multiplied', {
        playerId: player._id,
        oldScore: player.score,
        newScore,
        multiplier: bonus,
      });
    }

    return { 
      success: true, 
      multiplier: square.multiplier 
    };
  },
});

// End game early (host only, or by vote)
export const endGame = mutation({
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
      return { error: "Only the host can end the game" };
    }

    await ctx.db.patch(args.roomId, {
      status: "finished",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Reset game (go back to lobby)
export const resetGame = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[resetGame] Reset request', { roomId: args.roomId, sessionId: args.sessionId });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[resetGame] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    if (room.hostPlayerId !== args.sessionId) {
      console.log('[resetGame] Error: Not host', {
        requestingSession: args.sessionId,
        hostSession: room.hostPlayerId,
      });
      return { error: "Only the host can reset the game" };
    }

    // Delete all lines
    const lines = await ctx.db
      .query("lines")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const line of lines) {
      await ctx.db.delete(line._id);
    }
    console.log('[resetGame] Lines deleted', { count: lines.length });

    // Delete all squares
    const squares = await ctx.db
      .query("squares")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const square of squares) {
      await ctx.db.delete(square._id);
    }
    console.log('[resetGame] Squares deleted', { count: squares.length });

    // Reset player scores and ready status
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const player of players) {
      await ctx.db.patch(player._id, { score: 0, isReady: false });
    }
    console.log('[resetGame] Player scores reset', { playerCount: players.length });

    // Reset room status
    await ctx.db.patch(args.roomId, {
      status: "lobby",
      currentPlayerIndex: 0,
      updatedAt: Date.now(),
    });

    console.log('[resetGame] Game reset complete', {
      roomId: args.roomId,
      linesDeleted: lines.length,
      squaresDeleted: squares.length,
      playersReset: players.length,
    });

    return { success: true };
  },
});

/**
 * Populate lines (host only) - adds safe lines that don't complete squares
 * This feature allows the host to add random "safe" lines to prevent stalemates
 * Safe lines are those that won't immediately complete any square
 * 
 * @mutation populateLines
 * @permission host-only (validated server-side)
 * @returns {success: boolean, linesPopulated: number} | {error: string}
 * 
 * TODO: [FEATURE] Consider allowing host to configure populate percentage
 * TODO: [FEATURE] Add undo functionality for populate action
 * TODO: [OPTIMIZATION] Batch line insertions for better performance on large populate counts
 */
export const populateLines = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    lineKeys: v.array(v.string()), // Array of normalized line keys (e.g., ["1,2-1,3", "2,3-3,3"])
  },
  handler: async (ctx, args) => {
    console.log('[populateLines] Populate request', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      lineCount: args.lineKeys.length,
    });

    // Validate room exists and is in playing state
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      console.log('[populateLines] Error: Room not found', { roomId: args.roomId });
      return { error: "Room not found" };
    }

    if (room.status !== "playing") {
      console.log('[populateLines] Error: Game not in progress', {
        roomId: args.roomId,
        status: room.status,
      });
      return { error: "Game not in progress" };
    }

    // Server-side authorization: Only host can populate lines
    // This prevents non-hosts from using the populate feature via API manipulation
    if (room.hostPlayerId !== args.sessionId) {
      console.log('[populateLines] Error: Not host', {
        requestingSession: args.sessionId,
        hostSession: room.hostPlayerId,
      });
      return { error: "Only the host can populate lines" };
    }

    // Get the host player document to use their _id for the lines
    const hostPlayer = await ctx.db
      .query("players")
      .withIndex("by_room_and_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!hostPlayer) {
      console.log('[populateLines] Error: Host player not found', {
        roomId: args.roomId,
        sessionId: args.sessionId,
      });
      return { error: "Host player not found" };
    }

    console.log('[populateLines] Starting line insertion', {
      hostPlayerId: hostPlayer._id,
      linesToInsert: args.lineKeys.length,
    });

    let insertedCount = 0;
    let skippedCount = 0;

    // Insert all the requested lines into the database
    // Each line is associated with a special "populate" player ID for visual distinction
    for (const lineKey of args.lineKeys) {
      // Check if line already exists to prevent duplicates
      const existingLine = await ctx.db
        .query("lines")
        .withIndex("by_room_and_key", (q) =>
          q.eq("roomId", args.roomId).eq("lineKey", lineKey)
        )
        .first();

      if (!existingLine) {
        // Insert the line with special populate player ID
        // playerId: hostPlayer._id for database reference
        // playerIndex: 2 for backend identification (0=Player1, 1=Player2, 2=Populate)
        await ctx.db.insert("lines", {
          roomId: args.roomId,
          lineKey,
          playerId: hostPlayer._id,
          playerIndex: POPULATE_PLAYER_INDEX,
          createdAt: Date.now(),
        });
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('[populateLines] Line insertion complete', {
      requestedLines: args.lineKeys.length,
      inserted: insertedCount,
      skipped: skippedCount,
    });

    // Update room timestamp to trigger subscription updates
    // This ensures all players receive the new lines via real-time sync
    // Note: We don't change currentPlayerIndex, keeping the turn with the same player
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    console.log('[populateLines] Populate complete', { linesPopulated: insertedCount });

    return { 
      success: true, 
      linesPopulated: insertedCount 
    };
  },
});
