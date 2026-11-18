import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

/**
 * Paystack unlock licences — internal-only ledger.
 *
 * The game validates a licence key by sending its SHA-256 hash to the public
 * HTTP endpoint in http.ts. That endpoint calls `getByHash` here. Nothing in
 * this module is a public `query`/`mutation`: Convex does not expose internal
 * functions over the public API, so key material and buyer email cannot be
 * pulled from a browser by guessing a function name.
 */

/** Idempotent issuance: one Paystack reference can never mint two licences. */
export const issue = internalMutation({
    args: {
        keyHash: v.string(),
        key: v.string(),
        reference: v.string(),
        email: v.optional(v.string()),
        amountKobo: v.number(),
    },
    handler: async (ctx, args) => {
        // Atomic: the refund marker is checked in the SAME mutation that inserts
        // the licence. A refund webhook landing between the caller's read and
        // this write cannot be overtaken by an active licence being minted.
        const refunded = await ctx.db
            .query('paystackRefunds')
            .withIndex('by_reference', (q) => q.eq('reference', args.reference))
            .first();
        if (refunded) {
            return { refunded: true as const, key: '', created: false, reference: args.reference };
        }

        const existing = await ctx.db
            .query('paystackLicences')
            .withIndex('by_reference', (q) => q.eq('reference', args.reference))
            .first();

        if (existing) {
            return { key: existing.key, created: false, reference: args.reference };
        }

        const id = await ctx.db.insert('paystackLicences', {
            keyHash: args.keyHash,
            key: args.key,
            reference: args.reference,
            email: args.email,
            amountKobo: args.amountKobo,
            status: 'active',
            createdAt: Date.now(),
        });
        return { key: args.key, created: true, reference: args.reference, id };
    },
});

/** Validation lookup used by POST /license/validate. */
export const getByHash = internalQuery({
    args: { keyHash: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('paystackLicences')
            .withIndex('by_key_hash', (q) => q.eq('keyHash', args.keyHash))
            .first();
        return row ? { valid: row.status === 'active' } : { valid: false };
    },
});

/** Re-display the key when a buyer returns to checkout with their reference. */
export const getByReference = internalQuery({
    args: { reference: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('paystackLicences')
            .withIndex('by_reference', (q) => q.eq('reference', args.reference))
            .first();
        if (!row) return null;
        return { key: row.key, status: row.status, amountKobo: row.amountKobo };
    },
});

/** Refund/dispute path: revoke by Paystack reference. */
export const revokeByReference = internalMutation({
    args: { reference: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('paystackLicences')
            .withIndex('by_reference', (q) => q.eq('reference', args.reference))
            .first();
        if (!row) return { revoked: false, matched: false };
        if (row.status !== 'revoked') {
            await ctx.db.patch(row._id, { status: 'revoked', revokedAt: Date.now() });
        }
        return { revoked: true, matched: true };
    },
});

/** Record a refund independently of whether a licence row exists yet. */
export const markRefunded = internalMutation({
    args: { reference: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('paystackRefunds')
            .withIndex('by_reference', (q) => q.eq('reference', args.reference))
            .first();
        if (existing) return { created: false };
        await ctx.db.insert('paystackRefunds', { reference: args.reference, createdAt: Date.now() });
        return { created: true };
    },
});

/** True when this Paystack reference has been refunded. */
export const isRefunded = internalQuery({
    args: { reference: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('paystackRefunds')
            .withIndex('by_reference', (q) => q.eq('reference', args.reference))
            .first();
        return row !== null;
    },
});
