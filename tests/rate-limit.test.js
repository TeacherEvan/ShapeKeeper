/**
 * Tests for the in-tree sliding-window rate limiter.
 *
 * These tests use a mock ctx with a Map-backed 'rateLimits' table so
 * the limiter's read/patch logic can be exercised without a live
 * Convex deployment. The same logic runs against the real Convex
 * `ctx.db` in production.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, RATE_LIMIT_ACTIONS } from '../convex/rate-limit.js';

function makeMockCtx() {
    const store = new Map();
    let nextId = 0;
    return {
        db: {
            query: (table) => ({
                withIndex: (_name, buildFilter) => {
                    const filterArgs = {};
                    const builder = {
                        eq: (field, value) => {
                            filterArgs[field] = value;
                            return builder;
                        },
                    };
                    buildFilter(builder);
                    return {
                        unique: async () => {
                            for (const row of store.values()) {
                                if (row.key === filterArgs.key) {
                                    return row;
                                }
                            }
                            return null;
                        },
                        first: async () => {
                            for (const row of store.values()) {
                                if (row.key === filterArgs.key) {
                                    return row;
                                }
                            }
                            return null;
                        },
                    };
                },
            }),
            insert: async (table, doc) => {
                const id = `${table}:${++nextId}`;
                const row = { _id: id, _creationTime: Date.now(), ...doc };
                store.set(id, row);
                return id;
            },
            patch: async (id, changes) => {
                const row = store.get(id);
                if (!row) throw new Error(`patch: ${id} not found`);
                Object.assign(row, changes);
            },
        },
        _store: store,
    };
}

describe('checkRateLimit (N9 follow-up)', () => {
    let ctx;
    beforeEach(() => {
        ctx = makeMockCtx();
    });

    it('exposes the canonical action list', () => {
        expect(RATE_LIMIT_ACTIONS).toEqual(
            expect.arrayContaining(['drawLine', 'revealMultiplier', 'populateLines'])
        );
    });

    it('allows the first request in a window', async () => {
        const r = await checkRateLimit(ctx, 'drawLine', 'session_a');
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(9);
    });

    it('allows up to the cap, then rejects', async () => {
        const session = 'session_b';
        for (let i = 0; i < 10; i++) {
            const r = await checkRateLimit(ctx, 'drawLine', session);
            expect(r.allowed).toBe(true);
        }
        const blocked = await checkRateLimit(ctx, 'drawLine', session);
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
        expect(blocked.resetMs).toBeGreaterThan(0);
    });

    it('counts independently per session (no cross-session leak)', async () => {
        for (let i = 0; i < 10; i++) {
            await checkRateLimit(ctx, 'drawLine', 'session_c');
        }
        const r = await checkRateLimit(ctx, 'drawLine', 'session_d');
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(9);
    });

    it('counts independently per action (no cross-action leak)', async () => {
        for (let i = 0; i < 4; i++) {
            await checkRateLimit(ctx, 'revealMultiplier', 'session_e');
        }
        const blocked = await checkRateLimit(ctx, 'revealMultiplier', 'session_e');
        expect(blocked.allowed).toBe(false);
        const draw = await checkRateLimit(ctx, 'drawLine', 'session_e');
        expect(draw.allowed).toBe(true);
    });

    it('resets after the window elapses', async () => {
        const session = 'session_f';
        // Burn the budget.
        for (let i = 0; i < 10; i++) {
            await checkRateLimit(ctx, 'drawLine', session);
        }
        expect((await checkRateLimit(ctx, 'drawLine', session)).allowed).toBe(false);

        // Roll the window forward by 1.1s.
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);
        const r = await checkRateLimit(ctx, 'drawLine', session);
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(9);
        nowSpy.mockRestore();
    });

    it('returns a positive resetMs when blocked', async () => {
        const session = 'session_g';
        for (let i = 0; i < 10; i++) {
            await checkRateLimit(ctx, 'drawLine', session);
        }
        const blocked = await checkRateLimit(ctx, 'drawLine', session);
        expect(blocked.resetMs).toBeGreaterThan(0);
        expect(blocked.resetMs).toBeLessThanOrEqual(1000);
    });

    it('break-it: skipping the patch lets the 11th request slip through', async () => {
        // If a future refactor forgets to call ctx.db.patch after the
        // existing-row branch, the count never advances and a hostile
        // client could blast 1000 requests through. This test proves
        // the patch is load-bearing.
        const session = 'session_h';
        for (let i = 0; i < 9; i++) {
            await checkRateLimit(ctx, 'drawLine', session);
        }
        // Simulate the lost-update bug: clear the patch in the next
        // call by stubbing ctx.db.patch to a no-op.
        const realPatch = ctx.db.patch;
        ctx.db.patch = async () => {};
        // The 10th call sees the previous count of 9 and would be
        // allowed but the count never advances to 10, so the 11th
        // call would also be allowed. This proves the patch is
        // load-bearing for the limit to actually be enforced.
        const tenth = await checkRateLimit(ctx, 'drawLine', session);
        expect(tenth.allowed).toBe(true);
        const eleventh = await checkRateLimit(ctx, 'drawLine', session);
        expect(eleventh.allowed).toBe(true); // bug: would be false with the patch
        ctx.db.patch = realPatch;
        // With the patch restored, the 10th call already advanced the
        // count to 10 and the 11th should be blocked. (This branch
        // proves the inverse: the patch IS the enforcement.)
        const allowedAgain = await checkRateLimit(ctx, 'drawLine', session);
        expect(allowedAgain.allowed).toBe(true);
        const blocked = await checkRateLimit(ctx, 'drawLine', session);
        expect(blocked.allowed).toBe(false);
    });
});
