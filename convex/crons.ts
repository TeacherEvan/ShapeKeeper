import { cronJobs } from 'convex/server';

/**
 * Scheduled jobs.
 *
 * Turn expiry is NOT a cron: armTurnTimer() schedules a durable
 * `runAt(turnEndTime, internal.games.expireTurn)` on every move. A periodic
 * sweep used to re-enqueue the same mutation every 5s for any room whose
 * deadline had passed; when expiry failed, the transaction rolled back and
 * the sweep retried forever (2026-11-23 Free-tier burn).
 */
const crons = cronJobs();

// Abandoned-lobby reaper: rooms stuck at status 'lobby' with no activity
// for 2 hours are deleted with their players.
const sweepStaleLobbiesRef =
  'mutations/sweepStaleLobbies:sweepStaleLobbies' as any;

crons.interval(
  'sweep-stale-lobbies',
  { minutes: 15 },
  sweepStaleLobbiesRef,
  {}
);

export default crons;
