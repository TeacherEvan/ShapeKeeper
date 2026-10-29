import { describe, expect, it, vi } from 'vitest';
import { handleLemonSqueezyEvent } from './relay';
import { hmacSha256Hex } from './crypto';

/**
 * The relay is the difference between "a paywall exists" and "a purchase
 * becomes an entitlement and a refund takes it away". These tests are the
 * proof of that, and they are the reason the endpoint fails closed.
 */

const SECRET = 'test-signing-secret';
const STORE = '474582';

function orderPayload(options: {
    event?: string;
    orderId?: string;
    storeId?: string;
    licenseKey?: string;
    productId?: string;
    variantId?: string;
    testMode?: boolean;
    status?: string;
} = {}) {
    const {
        event = 'order_created',
        orderId = 'order-1',
        storeId = STORE,
        licenseKey = 'ABCD-1234-EFGH-5678',
        productId = '1361446',
        variantId = '2126128',
        testMode = false,
        status = event === 'order_refunded' ? 'refunded' : 'paid',
    } = options;

    return {
        meta: { event_name: event },
        data: {
            id: orderId,
            type: 'orders',
            attributes: {
                store_id: storeId,
                status,
                license_key: licenseKey,
                test_mode: testMode,
                first_order_item: {
                    product_id: productId,
                    variant_id: variantId,
                    test_mode: testMode,
                },
            },
        },
    };
}

function call(
    payload: unknown,
    options: {
        secret?: string | undefined;
        signature?: string | null;
        storeId?: string;
        resolve?: (orderId: string, payloadKey: string) => Promise<string>;
    } = {},
) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const secret = 'secret' in options ? options.secret : SECRET;
    const signature =
        options.signature === undefined
            ? secret
                ? hmacSha256Hex(secret, raw)
                : null
            : options.signature;

    const recordPurchase = vi.fn(async (_args: any) => ({ created: true }));
    const refundPurchase = vi.fn(async (_args: any) => ({ revoked: 1, refunded: 1 }));
    const resolveLicenseKey =
        options.resolve ?? (async (_orderId: string, payloadKey: string) => payloadKey);

    return {
        recordPurchase,
        refundPurchase,
        promise: handleLemonSqueezyEvent({
            raw,
            signature,
            secret,
            storeId: options.storeId ?? STORE,
            resolveLicenseKey,
            recordPurchase,
            refundPurchase,
        }),
    };
}

describe('fail closed', () => {
    it('rejects everything when no secret is configured', async () => {
        const result = await call(orderPayload(), { secret: undefined }).promise;
        expect(result.status).toBe(503);
        expect(result.body.ok).toBe(false);
    });

    it('rejects a wrong signature', async () => {
        const result = await call(orderPayload(), { signature: 'deadbeef' }).promise;
        expect(result.status).toBe(401);
        expect(result.body.error).toBe('invalid_signature');
    });

    it('rejects a missing signature', async () => {
        const result = await call(orderPayload(), { signature: null }).promise;
        expect(result.status).toBe(401);
    });

    it('rejects a body that was altered after signing', async () => {
        const raw = JSON.stringify(orderPayload());
        const signature = hmacSha256Hex(SECRET, raw);
        const tampered = raw.replace('order-1', 'order-9');
        const result = await call(tampered, { signature }).promise;
        expect(result.status).toBe(401);
    });

    it('rejects invalid JSON that was correctly signed', async () => {
        const result = await call('{not json', { signature: hmacSha256Hex(SECRET, '{not json') }).promise;
        expect(result.status).toBe(400);
    });
});

describe('order_created', () => {
    it('records the purchase with the key hashed, never in the clear', async () => {
        const { promise, recordPurchase } = call(orderPayload());
        const result = await promise;

        expect(result.status).toBe(200);
        expect(recordPurchase).toHaveBeenCalledTimes(1);
        const args = recordPurchase.mock.calls[0][0] as any;
        expect(args.orderId).toBe('order-1');
        expect(args.productId).toBe('1361446');
        expect(args.variantId).toBe('2126128');
        expect(args.status).toBe('paid');
        expect(args.licenseKeyHash).not.toBe('ABCD-1234-EFGH-5678');
        expect(args.licenseKeyHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('flags a test order as a test order', async () => {
        const { promise, recordPurchase } = call(orderPayload({ testMode: true }));
        const result = await promise;
        expect(result.body.testMode).toBe(true);
        expect((recordPurchase.mock.calls[0][0] as any).testMode).toBe(true);
    });

    it('records an order whose key cannot be resolved, and says so', async () => {
        const { promise, recordPurchase } = call(orderPayload(), {
            resolve: async () => '',
        });
        const result = await promise;
        expect(result.status).toBe(200);
        expect(result.body.linked).toBe(false);
        expect((recordPurchase.mock.calls[0][0] as any).licenseKeyHash).toBe('');
    });

    it('ignores an order belonging to another store', async () => {
        const { promise, recordPurchase } = call(orderPayload({ storeId: '999999' }));
        const result = await promise;
        expect(result.status).toBe(202);
        expect(result.body.ignored).toBe('other_store');
        expect(recordPurchase).not.toHaveBeenCalled();
    });
});

describe('order_refunded', () => {
    it('revokes the entitlement carrying that key', async () => {
        const { promise, refundPurchase } = call(orderPayload({ event: 'order_refunded' }));
        const result = await promise;

        expect(result.status).toBe(200);
        expect(refundPurchase).toHaveBeenCalledTimes(1);
        const args = refundPurchase.mock.calls[0][0] as any;
        expect(args.licenseKeyHash).toMatch(/^[0-9a-f]{64}$/);
        expect(args.licenseKeyHash).not.toBe('ABCD-1234-EFGH-5678');
        expect(result.body.revoked).toBe(1);
    });

    it('reports an unlinked refund instead of pretending it was handled', async () => {
        const { promise, refundPurchase } = call(orderPayload({ event: 'order_refunded' }), {
            resolve: async () => '',
        });
        const result = await promise;
        expect(result.status).toBe(202);
        expect(result.body.linked).toBe(false);
        expect(refundPurchase).not.toHaveBeenCalled();
    });
});

describe('other events', () => {
    it('acknowledges and ignores an event it does not handle', async () => {
        const { promise, recordPurchase, refundPurchase } = call(
            orderPayload({ event: 'subscription_created' }),
        );
        const result = await promise;
        expect(result.status).toBe(200);
        expect(result.body.ignored).toBe('subscription_created');
        expect(recordPurchase).not.toHaveBeenCalled();
        expect(refundPurchase).not.toHaveBeenCalled();
    });
});

/**
 * The event name lies; the STATUS is the truth. Lemon Squeezy mints the licence
 * key at order creation, so an unpaid or fraudulent order arrives with a key
 * that activates. Only `paid` may record a purchase.
 */
describe('order status gating', () => {
    const statuses = ['pending', 'failed'];

    for (const status of statuses) {
        it(`ignores an order whose status is "${status}"`, async () => {
            const { promise, recordPurchase, refundPurchase } = call(orderPayload({ status }));
            const result = await promise;

            expect(result.status).toBe(202);
            expect(result.body.ignored).toBe(`order_status:${status}`);
            expect(recordPurchase).not.toHaveBeenCalled();
            expect(refundPurchase).not.toHaveBeenCalled();
        });
    }

    it('treats a fraudulent order as a revocation, not a purchase', async () => {
        const { promise, recordPurchase, refundPurchase } = call(
            orderPayload({ status: 'fraudulent' }),
        );
        const result = await promise;

        expect(recordPurchase).not.toHaveBeenCalled();
        expect(refundPurchase).toHaveBeenCalledTimes(1);
        expect(result.body.revoked).toBe(1);
    });

    it('treats a partial refund as a revocation of the whole unlock', async () => {
        const { promise, recordPurchase, refundPurchase } = call(
            orderPayload({ status: 'partial_refund' }),
        );
        const result = await promise;

        expect(recordPurchase).not.toHaveBeenCalled();
        expect(refundPurchase).toHaveBeenCalledTimes(1);
        expect(result.status).toBe(200);
    });

    it('ignores an order that carries no status at all rather than assume it was paid', async () => {
        const { promise, recordPurchase } = call(orderPayload({ status: '' }));
        const result = await promise;

        expect(result.status).toBe(202);
        expect(result.body.ignored).toBe('order_status:unknown');
        expect(recordPurchase).not.toHaveBeenCalled();
    });

    it('records a paid order', async () => {
        const { promise, recordPurchase } = call(orderPayload({ status: 'paid' }));
        const result = await promise;

        expect(result.status).toBe(200);
        expect(recordPurchase).toHaveBeenCalledTimes(1);
    });
});
