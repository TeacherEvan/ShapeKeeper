import { isTurnExpired } from '../games/turn_deadline';
import { computeTurnEndTime, resolveTurnDurationMs } from '../games/turn_duration';
import { log, warn } from '../log';

export interface TurnExpiryResult {
  turnExpired: true;
  skippedPlayerIndex: number;
  skippedPlayerName: string | null;
  nextPlayerIndex: number;
}

/**
 * Enforce the Allowed Time deadline on the LIVE drawLine path.
 *
 * Called from validateDrawLine BEFORE the "not your turn" check: a player
 * whose turn already expired may have been skipped server-side, so the
 * caller's sessionId might legitimately no longer match currentPlayerIndex.
 * The skip must win.
 *
 * When the deadline has passed AND the room has a time limit configured:
 *   - advance currentPlayerIndex to the next player
 *   - re-arm turnStartTime / turnEndTime from the configured duration
 *   - clear the RTT samples (a fresh turn has no latency history)
 *   - return a structured result so the client can show "turn skipped"
 *
 * When there is no limit (duration 0) the clock was never armed, so
 * turnEndTime is undefined and isTurnExpired() is false — nothing happens.
 *
 * Returns null when the turn has NOT expired (normal path continues).
 */
export async function enforceTurnDeadline(
  ctx: any,
  room: any,
  roomId: any
): Promise<TurnExpiryResult | null> {
  if (!isTurnExpired(room)) return null;

  const turnDurationMs = resolveTurnDurationMs(room);
  if (turnDurationMs <= 0) {
    // No limit configured: nothing to enforce (turnEndTime shouldn't be
    // set, but a legacy/半-migrated room could still carry a stale value).
    log('[turnDeadline] Expired turnEndTime on a no-limit room; ignoring', { roomId });
    return null;
  }

  const players = await ctx.db
    .query('players')
    .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
    .collect();

  if (!players || players.length === 0) return null;

  const sortedPlayers = players.sort(
    (a: any, b: any) => a.playerIndex - b.playerIndex
  );
  const skippedIndex = room.currentPlayerIndex;
  const nextIndex = (skippedIndex + 1) % sortedPlayers.length;
  const skippedAt = Date.now();

  await ctx.db.patch(roomId, {
    currentPlayerIndex: nextIndex,
    turnStartTime: skippedAt,
    turnEndTime: computeTurnEndTime(room, skippedAt),
    lastTurnClientSentAt: undefined,
    lastTurnServerReceivedAt: undefined,
    updatedAt: skippedAt,
  });

  warn('[turnDeadline] Turn expired — player skipped', {
    roomId,
    skippedPlayerIndex: skippedIndex,
    skippedPlayerName: sortedPlayers[skippedIndex]?.name ?? null,
    nextPlayerIndex: nextIndex,
  });

  return {
    turnExpired: true,
    skippedPlayerIndex: skippedIndex,
    skippedPlayerName: sortedPlayers[skippedIndex]?.name ?? null,
    nextPlayerIndex: nextIndex,
  };
}
