import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

/**
 * Purchased entitlements (Lemon Squeezy).
 *
 * The licence key is NEVER stored here. The webhook relay computes its SHA-256
 * hash and passes only the hash, together with the instance id that Lemon
 * Squeezy issues when the key is activated on a device. That keeps
 * `checkEntitlement` safe to expose: it answers "is this device entitled?" and
 * never becomes an oracle for keys, emails or orders.
 */

/**
 * Record a paid licence. Idempotent: Lemon Squeezy retries webhooks, so
 * recording the same instance twice must patch, not duplicate.
 */
export const recordEntitlement = internalMutation({
    args: {
        licenseKeyHash: v.string(),
        instanceId: v.string(),
        productId: v.string(),
        storeId: v.string(),
        orderId: v.optional(v.string()),
        seats: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const existing = await ctx.db
            .query('entitlements')
            .withIndex('by_instance', (q) => q.eq('instanceId', args.instanceId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                status: 'active',
                revokedAt: undefined,
                lastValidatedAt: now,
            });
            return { id: existing._id, created: false };
        }

        const id = await ctx.db.insert('entitlements', {
            licenseKeyHash: args.licenseKeyHash,
            instanceId: args.instanceId,
            productId: args.productId,
            storeId: args.storeId,
            orderId: args.orderId,
            status: 'active',
            seats: args.seats ?? 1,
            createdAt: now,
            lastValidatedAt: now,
        });
        return { id, created: true };
    },
});

/**
 * Revoke every entitlement carrying this licence hash. Called from the
 * `order_refunded` webhook: a refund must not remain a free licence.
 */
export const revokeEntitlement = internalMutation({
    args: { licenseKeyHash: v.string() },
    handler: async (ctx, args) => {
        const rows = await ctx.db
            .query('entitlements')
            .withIndex('by_license_hash', (q) => q.eq('licenseKeyHash', args.licenseKeyHash))
            .collect();

        const now = Date.now();
        let revoked = 0;
        for (const row of rows) {
            if (row.status !== 'revoked') {
                await ctx.db.patch(row._id, { status: 'revoked', revokedAt: now });
                revoked += 1;
            }
        }
        return { revoked, matched: rows.length };
    },
});

/**
 * Public. The game asks whether this device holds a live entitlement.
 * Returns no email, no key, no hash — only the product the device owns.
 */
export const checkEntitlement = query({
    args: { instanceId: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('entitlements')
            .withIndex('by_instance', (q) => q.eq('instanceId', args.instanceId))
            .first();

        if (!row || row.status !== 'active') {
            return { active: false, productId: null as string | null };
        }
        return { active: true, productId: row.productId };
    },
});

/**
 * Stamp a re-validation. The cron sweep calls this after asking Lemon Squeezy
 * whether the key is still valid, so a dead licence stops opening levels even
 * when its refund webhook never arrived.
 */
export const markValidated = internalMutation({
    args: { instanceId: v.string(), valid: v.boolean() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('entitlements')
            .withIndex('by_instance', (q) => q.eq('instanceId', args.instanceId))
            .first();

        if (!row) return { updated: false };

        const now = Date.now();
        if (args.valid) {
            await ctx.db.patch(row._id, { lastValidatedAt: now });
        } else {
            await ctx.db.patch(row._id, { status: 'revoked', revokedAt: now });
        }
        return { updated: true };
    },
});
