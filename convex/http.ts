import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { handleLemonSqueezyEvent } from './utils/relay';

/**
 * The Lemon Squeezy fulfilment relay.
 *
 * A paid order must produce an entitlement, and a refund must take it away.
 * Until this endpoint existed, `convex/entitlements.ts` was a table nothing
 * ever wrote to, and a refund only bit when the player happened to
 * re-validate their key. This is the piece that makes the paywall real.
 *
 * The decision logic lives in `convex/utils/relay.ts`, where it is unit
 * tested; this file is the adapter that wires it to a real request and a real
 * database. The rules it enforces are documented there and in
 * `COMPLIANCE.md`.
 */

const http = httpRouter();

/**
 * Resolve the licence key for an order.
 *
 * Primary path: Lemon Squeezy puts `license_key` in the order attributes for
 * products that generate licence keys. Fallback: the API key, when one is
 * configured. If neither yields a key, the purchase is still recorded so the
 * order is visible, but it cannot be linked to an entitlement — and refunds
 * for that order are reported as unlinked rather than silently ignored.
 */
async function resolveLicenseKeyForOrder(orderId: string, payloadKey: string): Promise<string> {
    if (payloadKey) return payloadKey;

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey || !orderId) return '';

    try {
        const response = await fetch(
            `https://api.lemonsqueezy.com/v1/license-keys?filter[order_id]=${encodeURIComponent(orderId)}`,
            {
                headers: {
                    Accept: 'application/vnd.api+json',
                    Authorization: `Bearer ${apiKey}`,
                },
            },
        );
        if (!response.ok) return '';
        const body: any = await response.json();
        const keys = Array.isArray(body?.data) ? body.data : [];
        return String(keys[0]?.attributes?.key ?? '');
    } catch {
        return '';
    }
}

http.route({
    path: '/lemonsqueezy/webhook',
    method: 'POST',
    handler: httpAction(async ({ runMutation }, request) => {
        const raw = await request.text();
        const result = await handleLemonSqueezyEvent({
            raw,
            signature: request.headers.get('X-Signature'),
            secret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
            storeId: process.env.LEMONSQUEEZY_STORE_ID,
            resolveLicenseKey: resolveLicenseKeyForOrder,
            recordPurchase: (args) =>
                runMutation(internal.purchases.recordPurchase, args),
            refundPurchase: (args) => runMutation(internal.purchases.refundPurchase, args),
        });
        return new Response(JSON.stringify(result.body), { status: result.status });
    }),
});

/**
 * A cheap liveness probe for the desk that has to confirm the endpoint is
 * alive before pointing a webhook at it. It reports whether the secret is
 * configured; it never reports the secret.
 */
http.route({
    path: '/lemonsqueezy/health',
    method: 'GET',
    handler: httpAction(async () => {
        return new Response(
            JSON.stringify({
                ok: true,
                secretConfigured: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET),
                apiKeyConfigured: Boolean(process.env.LEMONSQUEEZY_API_KEY),
                storeId: process.env.LEMONSQUEEZY_STORE_ID ?? null,
                products: process.env.LEMONSQUEEZY_PRODUCT_IDS ?? null,
            }),
            { status: 200 },
        );
    }),
});

export default http;
