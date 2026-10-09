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

export default crons;
