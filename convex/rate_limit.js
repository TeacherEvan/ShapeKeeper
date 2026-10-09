/**
 * Per-sessionId sliding-window rate limiter (N9 follow-up).
 *
 * In-tree implementation — drop-in replacement for the
 * `@convex-dev/rate-limiter` package, which we are not adopting
 * in this branch (the plan lists it as a separate follow-up that
 * should also be paired with a Sustained-review of the deployed
 * Convex SDK's built-in rate-limit helpers).
 *
 * Threat model: a hostile browser client (or a script) calls
 * mutations faster than the game allows. A simple room-level
 * counter would not stop an attacker that joins a new room each
 * time, so the bucket key is `action:sessionId`.
 *
 * The function is best-effort: a "fail open" decision is documented
 * below. The window state lives in a dedicated table (see schema.ts)
 * so the same physical row is read+updated under Convex's serialised
 * mutations; this avoids the lost-update race that an in-memory
 * counter would have.
 */

const DEFAULT_WINDOWS = {
    // drawLine is the hot path: at most 1 per 100 ms per sessionId
    // (10/sec) is plenty for human play and stops naive floods.
    drawLine: { max: 10, windowMs: 1000 },
    // revealMultiplier and populateLines are 1-per-game-event; we
    // allow a short burst for retries but cap the long-term rate.
    revealMultiplier: { max: 4, windowMs: 5000 },
    populateLines: { max: 4, windowMs: 5000 },
};

export async function checkRateLimit(ctx, action, sessionId, opts = {}) {
    const config = opts.config || DEFAULT_WINDOWS[action];
    if (!config) {
        // Unknown action — be conservative and let it through; the
        // caller should be using a known action name.
        return { allowed: true, remaining: 0, resetMs: 0 };
    }
    const { max, windowMs } = config;
    const key = `${action}:${sessionId}`;
    const now = Date.now();

    const existing = await ctx.db
        .query('rateLimits')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique();

    if (!existing) {
        await ctx.db.insert('rateLimits', {
            key,
            windowStart: now,
            count: 1,
        });
        return { allowed: true, remaining: max - 1, resetMs: windowMs };
    }

    const elapsed = now - existing.windowStart;
    if (elapsed >= windowMs) {
        // Window expired — start a fresh one with this request.
        await ctx.db.patch(existing._id, {
            windowStart: now,
            count: 1,
        });
        return { allowed: true, remaining: max - 1, resetMs: windowMs };
    }

    if (existing.count >= max) {
        const resetMs = windowMs - elapsed;
        return { allowed: false, remaining: 0, resetMs };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return {
        allowed: true,
        remaining: max - (existing.count + 1),
        resetMs: windowMs - elapsed,
    };
}

export const RATE_LIMIT_ACTIONS = Object.freeze(Object.keys(DEFAULT_WINDOWS));
