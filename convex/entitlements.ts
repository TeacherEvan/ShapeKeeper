import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { checkRateLimit } from './rateLimit';
import { sha256Hex } from './utils/crypto';

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
 * Server truth: the key is exchanged for an instance id HERE, on the server,
 * and the browser keeps only that instance id. The raw key never comes back
 * to the client, and it is never written to the database — only its SHA-256
 * hash is.
 *
 * The product allow-list is the guard against "any product on this account
 * grants the game": Lemon Squeezy may hold other products later.
 */
export const redeemEntitlement = mutation({
    args: {
        licenseKey: v.string(),
        instanceName: v.string(),
    },
    handler: async (ctx, args) => {
        const licenseKey = args.licenseKey.trim();
        if (licenseKey.length < 8) {
            return { active: false as const, reason: 'malformed_key' as const };
        }

        const allowedProducts = (process.env.LEMONSQUEEZY_PRODUCT_IDS ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        if (allowedProducts.length === 0) {
            // Fail closed: an unconfigured server grants nothing.
            return { active: false as const, reason: 'products_not_configured' as const };
        }

        const instanceName = (args.instanceName.trim() || 'unknown-device').slice(0, 120);

        // Every call below this line spends an outbound Lemon Squeezy request.
        // Two buckets: one per device (honest retries), one global (a script
        // rotating device names cannot outrun it). Best-effort, fail-open, like
        // the rest of the game's limiter.
        const deviceBudget = await checkRateLimit(ctx, 'redeemEntitlement', instanceName);
        if (!deviceBudget.allowed) {
            return { active: false as const, reason: 'rate_limited' as const };
        }
        const globalBudget = await checkRateLimit(ctx, 'redeemEntitlementGlobal', 'all');
        if (!globalBudget.allowed) {
            return { active: false as const, reason: 'rate_limited' as const };
        }

        let response: Response;
        try {
            response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    license_key: licenseKey,
                    instance_name: instanceName,
                }).toString(),
            });
        } catch {
            return { active: false as const, reason: 'license_service_unreachable' as const };
        }

        let payload: any = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!payload || payload.activated !== true) {
            return { active: false as const, reason: classifyActivationFailure(payload) };
        }

        const instanceId = String(payload?.instance?.id ?? '');
        const productId = String(payload?.license_key?.meta?.product_id ?? '');
        if (!instanceId) {
            return { active: false as const, reason: 'activation_failed' as const };
        }
        if (!allowedProducts.includes(productId)) {
            // A valid key for a DIFFERENT product is still not this game.
            return { active: false as const, reason: 'product_not_allowed' as const };
        }

        const licenseKeyHash = sha256Hex(licenseKey);
        const purchase = await ctx.db
            .query('purchases')
            .withIndex('by_license_hash', (q) => q.eq('licenseKeyHash', licenseKeyHash))
            .first();

        // A refund is authoritative even if Lemon Squeezy still lets the key
        // activate: our own record says the money came back, so the key must not
        // buy the game a second time.
        if (purchase && purchase.status === 'refunded') {
            return { active: false as const, reason: 'key_refunded' as const };
        }

        const now = Date.now();
        const existing = await ctx.db
            .query('entitlements')
            .withIndex('by_instance', (q) => q.eq('instanceId', instanceId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                status: 'active',
                revokedAt: undefined,
                lastValidatedAt: now,
            });
        } else {
            await ctx.db.insert('entitlements', {
                licenseKeyHash,
                instanceId,
                productId,
                storeId: String(payload?.license_key?.meta?.store_id ?? ''),
                orderId: purchase?.orderId,
                status: 'active',
                seats: Number(payload?.license_key?.activation_limit ?? 1) || 1,
                createdAt: now,
                lastValidatedAt: now,
            });
        }

        // The client receives the instance id and the product — never the key,
        // never the hash, never an email or an order id.
        return { active: true as const, instanceId, productId };
    },
});

/**
 * Turn Lemon Squeezy's error text into a stable reason code. The raw text is
 * not returned to the browser: it can echo order detail, and a stable code is
 * what the client can act on.
 */
function classifyActivationFailure(payload: any): 'key_not_found' | 'activation_limit_reached' | 'key_expired' | 'key_disabled' | 'activation_failed' {
    const text = String(payload?.error ?? '').toLowerCase();
    if (!text) return 'activation_failed';
    if (text.includes('activation limit') || text.includes('activation_limit')) return 'activation_limit_reached';
    if (text.includes('expired')) return 'key_expired';
    if (text.includes('disabled')) return 'key_disabled';
    if (text.includes('not valid') || text.includes('not found') || text.includes('does not exist')) return 'key_not_found';
    return 'activation_failed';
}

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
