import { v } from 'convex/values';
import { mutation } from '../_generated/server';

// Delegates to smaller services (validator / applier / resolver)
export const drawLine = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionId: v.string(),
    lineKey: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[drawLine] Line draw request (mutations/drawLine)', {
      roomId: args.roomId,
      sessionId: args.sessionId,
      lineKey: args.lineKey,
    });

    // Validation
    const { validateDrawLine } = await import('../services/lineValidator');
    const validation = await validateDrawLine(ctx, args.roomId, args.sessionId, args.lineKey);
    if (!validation.ok) {
      console.log('[drawLine] Validation failed', { error: validation.error });
      return { error: validation.error };
    }

    const { room, sortedPlayers, currentPlayer } = validation;

    // Apply the line
    const { applyLine } = await import('../services/lineApplier');
    await applyLine(ctx, args.roomId, args.lineKey, currentPlayer);

    // Provide newLineKey for resolvers via ctx adapter
    ctx.__newLineKey = args.lineKey;

    // Resolve effects
    const { resolveLineEffects } = await import('../services/lineResolver');
    const result = await resolveLineEffects(ctx, room, args.roomId, currentPlayer);

    return {
      success: true,
      completedSquares: result.completedSquares,
      completedTriangles: result.completedTriangles,
      keepTurn: result.keepTurn,
      gameOver: result.gameOver || false,
    };
  },
});
