import { cronJobs } from 'convex/server';

/**
 * Scheduled jobs.
 *
 * sweepAllTurnDeadlines runs every 5 seconds. It scans every 'playing'
 * room and, for any whose Allowed Time has expired, skips the timed-out
 * player via the per-room sweep. This closes the frozen-client gap: a
 * player whose tab is dead or hostile can no longer stall the match,
 * because the skip happens on a schedule regardless of client activity.
 *
 * 5s granularity is a deliberate trade-off: turns are configured in
 * seconds (min 1s), so the worst-case delay between true expiry and the
 * sweep is one interval; the UI's own countdown still shows 0 and the
 * next interaction (or the sweep) triggers the skip.
 */
const crons = cronJobs();

// The generated api types will catch this reference after the next
// deploy; the cast keeps it valid locally against anyApi's Record type.
const sweepRef = 'mutations/sweepAllTurnDeadlines:sweepAllTurnDeadlines' as any;

crons.interval(
  'sweep-turn-deadlines',
  { seconds: 5 },
  sweepRef,
  {}
);

// Abandoned-lobby reaper: rooms stuck at status 'lobby' with no activity
// for 2 hours are deleted with their players. Closes the zombie-lobby gap
// — a host who closed their tab (beforeunload leave dropped or never
// fired) otherwise leaves a dead lobby listed in everyone's JOIN LOBBY
// browser forever. 15-minute granularity against a 2-hour TTL.
const sweepStaleLobbiesRef =
  'mutations/sweepStaleLobbies:sweepStaleLobbies' as any;

crons.interval(
  'sweep-stale-lobbies',
  { minutes: 15 },
  sweepStaleLobbiesRef,
  {}
);

export default crons;
