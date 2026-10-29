import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

/**
 * Paid orders, as told to us by Lemon Squeezy's webhook.
 *
 * The licence key is never stored — only its SHA-256 hash — so a refund can be
 * matched to a purchase without the key ever sitting in our database.
 */

export const recordPurchase = internalMutation({
    args: {
        orderId: v.string(),
        licenseKeyHash: v.string(),
        productId: v.string(),
        variantId: v.optional(v.string()),
        storeId: v.string(),
        status: v.optional(v.union(v.literal('paid'), v.literal('refunded'))),
        testMode: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const existing = await ctx.db
            .query('purchases')
            .withIndex('by_order', (q) => q.eq('orderId', args.orderId))
            .first();

        // Lemon Squeezy retries webhooks. Recording the same order twice must
        // patch the row, never insert a second one.
        if (existing) {
            await ctx.db.patch(existing._id, {
                licenseKeyHash: args.licenseKeyHash,
                productId: args.productId,
                variantId: args.variantId ?? existing.variantId,
                status: args.status ?? existing.status,
                // A test order must never be silently promoted to a real one:
                // once any copy of the order said "test", it stays a test.
                testMode: (existing.testMode ?? false) || (args.testMode ?? false),
            });
            return { id: existing._id, created: false };
        }

        const id = await ctx.db.insert('purchases', {
            orderId: args.orderId,
            licenseKeyHash: args.licenseKeyHash,
            productId: args.productId,
            variantId: args.variantId,
            storeId: args.storeId,
            status: args.status ?? 'paid',
            testMode: args.testMode ?? false,
            createdAt: now,
        });
        return { id, created: true };
    },
});

/**
 * A refund must not remain a free licence. Revoke every entitlement carrying
 * this licence hash and mark the purchase refunded.
 */
export const refundPurchase = internalMutation({
    args: { licenseKeyHash: v.string() },
    handler: async (ctx, args) => {
        const now = Date.now();

        const entitlements = await ctx.db
            .query('entitlements')
            .withIndex('by_license_hash', (q) => q.eq('licenseKeyHash', args.licenseKeyHash))
            .collect();
        let revoked = 0;
        for (const row of entitlements) {
            if (row.status !== 'revoked') {
                await ctx.db.patch(row._id, { status: 'revoked', revokedAt: now });
                revoked += 1;
            }
        }

        const purchases = await ctx.db
            .query('purchases')
            .withIndex('by_license_hash', (q) => q.eq('licenseKeyHash', args.licenseKeyHash))
            .collect();
        let refunded = 0;
        for (const row of purchases) {
            if (row.status !== 'refunded') {
                await ctx.db.patch(row._id, { status: 'refunded', refundedAt: now });
                refunded += 1;
            }
        }

        return { revoked, refunded, matchedEntitlements: entitlements.length };
    },
});
