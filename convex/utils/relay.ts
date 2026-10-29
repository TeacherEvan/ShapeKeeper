import { hmacSha256Hex, sha256Hex, timingSafeEqualHex } from './crypto';

/**
 * The Lemon Squeezy relay's decision logic, kept free of Convex plumbing so
 * it can be tested directly. `convex/http.ts` is the adapter that wires this
 * to a real request and a real database.
 */

export interface RelayPurchaseArgs {
    orderId: string;
    licenseKeyHash: string;
    productId: string;
    variantId?: string;
    storeId: string;
    status: 'paid' | 'refunded';
    testMode: boolean;
}

export interface RelayRefundArgs {
    licenseKeyHash: string;
}

export interface RelayResult {
    status: number;
    body: Record<string, unknown>;
}

export interface RelayOptions {
    /** Raw request body — the signature is computed over THESE bytes. */
    raw: string;
    /** The `X-Signature` header, or null. */
    signature: string | null;
    /** The shared signing secret. Missing means fail closed. */
    secret: string | undefined;
    /** Our store id. Orders from another store are ignored. */
    storeId: string | undefined;
    resolveLicenseKey: (orderId: string, payloadKey: string) => Promise<string>;
    recordPurchase: (args: RelayPurchaseArgs) => Promise<{ created: boolean }>;
    refundPurchase: (args: RelayRefundArgs) => Promise<{ revoked: number; refunded: number }>;
}

export async function handleLemonSqueezyEvent(options: RelayOptions): Promise<RelayResult> {
    const { raw, signature, secret, storeId } = options;

    if (!secret) {
        // Fail closed: an unconfigured relay accepts nothing.
        return { status: 503, body: { ok: false, error: 'webhook_secret_not_configured' } };
    }

    if (!signature || !timingSafeEqualHex(signature, hmacSha256Hex(secret, raw))) {
        return { status: 401, body: { ok: false, error: 'invalid_signature' } };
    }

    let payload: any;
    try {
        payload = JSON.parse(raw);
    } catch {
        return { status: 400, body: { ok: false, error: 'invalid_json' } };
    }

    const eventName = String(payload?.meta?.event_name ?? '');
    const attributes = payload?.data?.attributes ?? {};
    const orderId = String(payload?.data?.id ?? '');
    const orderStoreId = String(attributes?.store_id ?? '');

    const expectedStore = (storeId ?? '').trim();
    if (expectedStore && orderStoreId && orderStoreId !== expectedStore) {
        return { status: 202, body: { ok: true, ignored: 'other_store' } };
    }

    if (eventName === 'order_created') {
        if (!orderId) return { status: 202, body: { ok: true, ignored: 'no_order_id' } };

        const item = attributes?.first_order_item ?? {};
        const licenseKey = await options.resolveLicenseKey(
            orderId,
            String(attributes?.license_key ?? ''),
        );
        const testMode = attributes?.test_mode === true || item?.test_mode === true;

        const result = await options.recordPurchase({
            orderId,
            licenseKeyHash: licenseKey ? sha256Hex(licenseKey) : '',
            productId: String(item?.product_id ?? ''),
            variantId: item?.variant_id != null ? String(item.variant_id) : undefined,
            storeId: orderStoreId,
            status: 'paid',
            testMode,
        });

        return {
            status: 200,
            body: {
                ok: true,
                event: eventName,
                orderId,
                created: result.created,
                linked: Boolean(licenseKey),
                testMode,
            },
        };
    }

    if (eventName === 'order_refunded') {
        if (!orderId) return { status: 202, body: { ok: true, ignored: 'no_order_id' } };

        const licenseKey = await options.resolveLicenseKey(
            orderId,
            String(attributes?.license_key ?? ''),
        );

        if (!licenseKey) {
            // Report it honestly rather than pretend it was handled.
            return {
                status: 202,
                body: { ok: false, event: eventName, orderId, revoked: 0, linked: false },
            };
        }

        const result = await options.refundPurchase({ licenseKeyHash: sha256Hex(licenseKey) });

        return {
            status: 200,
            body: {
                ok: true,
                event: eventName,
                orderId,
                revoked: result.revoked,
                refunded: result.refunded,
                linked: true,
            },
        };
    }

    // Any other event is acknowledged and ignored. Lemon Squeezy retries on
    // non-2xx, and a retry storm on an event we do not handle is noise.
    return { status: 200, body: { ok: true, ignored: eventName || 'unknown' } };
}
