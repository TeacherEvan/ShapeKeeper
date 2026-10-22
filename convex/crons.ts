import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

/**
 * Scheduled jobs.
 *
 * sweepAllTurnDeadlines runs every 5 seconds. It scans every 'playing'
 * room and, for any whose Allowed Time has expired, triggers expireTurn
 * via the internal mutation sweep.
 */
const crons = cronJobs();

crons.interval(
  'sweep-turn-deadlines',
  { seconds: 5 },
  internal.mutations.sweepAllTurnDeadlines.sweepAllTurnDeadlines,
  {}
);

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
