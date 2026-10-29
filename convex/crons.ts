import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

/**
 * Scheduled jobs.
 *
 * sweepAllTurnDeadlines scans every 'playing' room and, for any whose
 * Allowed Time has expired, triggers expireTurn via the internal mutation
 * sweep.
 *
 * INTERVAL — CHANGED 2026-10-29, and it matters:
 * This job used to run every 5 seconds. On Convex's free plan that is
 * 17,280 executions a day (≈518,000 a month) before the multiplayer traffic is
 * counted at all — and the free plan's function-call allowance was exceeded,
 * which **disabled the deployment outright** ("You have exceeded the free plan
 * limits, so your deployments have been disabled"). Every function on the
 * deployment, including the payment relay, began returning server errors.
 *
 * Thirty seconds keeps the turn timer honest to within half a minute and cuts
 * the cron cost by six. The correct fix is to schedule each room's expiry once
 * instead of polling for it; until that is built, 30 seconds is the ceiling
 * that keeps the account inside its allowance.
 */
const crons = cronJobs();

crons.interval(
  'sweep-turn-deadlines',
  { seconds: 30 },
  internal.mutations.sweepAllTurnDeadlines.sweepAllTurnDeadlines,
  {}
);

/**
 * Licence-status sweep, once a day.
 *
 * The refund webhook is the fast path; this catches what an event never told us
 * — a chargeback, an expired or disabled key. It checks a BATCH (20 by default),
 * oldest-checked first, because the free plan's function-call allowance disabled
 * this deployment outright once and a full sweep would do it again.
 */
crons.cron(
  'sweep-licence-status',
  '17 3 * * *',
  internal.entitlements.sweepExpiredLicenses,
  { batchSize: 20 }
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
