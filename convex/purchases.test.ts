import { describe, expect, it, vi } from 'vitest';
import * as purchases from './purchases';

/**
 * The same mocked-ctx harness style as `entitlements.test.ts`, so the
 * assertions exercise the real handlers rather than a reimplementation.
 */
function makeCtx(seed: any[] = []) {
    const rows: any[] = seed.map((r) => ({ ...r }));
    let seq = 0;

    const ctx: any = {
        db: {
            insert: vi.fn(async (_table: string, doc: any) => {
                const _id = `purch_${++seq}`;
                rows.push({ _id, ...doc });
                return _id;
            }),
            patch: vi.fn(async (id: any, patchObj: any) => {
                const row = rows.find((r) => r._id === id);
                if (row) Object.assign(row, patchObj);
            }),
            query: vi.fn(() => ({
                withIndex: (_name: string, fn: (q: any) => any) => {
                    const preds: Array<[string, any]> = [];
                    const q: any = {
                        eq: (field: string, value: any) => {
                            preds.push([field, value]);
                            return q;
                        },
                    };
                    fn(q);
                    const matched = () => rows.filter((r) => preds.every(([f, v]) => r[f] === v));
                    return {
                        first: async () => matched()[0] ?? null,
                        unique: async () => matched()[0] ?? null,
                        collect: async () => matched(),
                    };
                },
            })),
        },
    };

    return { ctx, rows };
}

const PURCHASE = {
    orderId: 'order-1',
    licenseKeyHash: 'hash-abc',
    productId: '1361446',
    variantId: '2126128',
    storeId: '474582',
    status: 'paid' as const,
    testMode: false,
};

describe('recordPurchase', () => {
    it('inserts a purchase', async () => {
        const { ctx, rows } = makeCtx();
        const result = await (purchases.recordPurchase as any)._handler(ctx, PURCHASE);
        expect(result.created).toBe(true);
        expect(rows).toHaveLength(1);
        expect(rows[0].orderId).toBe('order-1');
    });

    it('is idempotent — a retried webhook patches, never duplicates', async () => {
        const { ctx, rows } = makeCtx();
        await (purchases.recordPurchase as any)._handler(ctx, PURCHASE);
        const second = await (purchases.recordPurchase as any)._handler(ctx, PURCHASE);
        expect(second.created).toBe(false);
        expect(rows).toHaveLength(1);
    });

    it('keeps the test-mode flag across a retry', async () => {
        const { ctx, rows } = makeCtx();
        await (purchases.recordPurchase as any)._handler(ctx, { ...PURCHASE, testMode: true });
        await (purchases.recordPurchase as any)._handler(ctx, PURCHASE);
        expect(rows).toHaveLength(1);
        expect(rows[0].testMode).toBe(true);
    });
});

describe('refundPurchase', () => {
    it('revokes every entitlement carrying the licence hash', async () => {
        const { ctx } = makeCtx([
            { _id: 'e1', licenseKeyHash: 'hash-abc', status: 'active' },
            { _id: 'e2', licenseKeyHash: 'hash-abc', status: 'active' },
            { _id: 'e3', licenseKeyHash: 'other', status: 'active' },
        ]);
        const result = await (purchases.refundPurchase as any)._handler(ctx, {
            licenseKeyHash: 'hash-abc',
        });
        expect(result.revoked).toBe(2);
        expect(result.matchedEntitlements).toBe(2);
    });

    it('marks the purchase refunded', async () => {
        const { ctx, rows } = makeCtx([
            { _id: 'p1', licenseKeyHash: 'hash-abc', status: 'paid' },
        ]);
        const result = await (purchases.refundPurchase as any)._handler(ctx, {
            licenseKeyHash: 'hash-abc',
        });
        expect(result.refunded).toBe(1);
        expect(rows[0].status).toBe('refunded');
    });

    it('does not revoke an entitlement twice', async () => {
        const { ctx } = makeCtx([{ _id: 'e1', licenseKeyHash: 'hash-abc', status: 'revoked' }]);
        const result = await (purchases.refundPurchase as any)._handler(ctx, {
            licenseKeyHash: 'hash-abc',
        });
        expect(result.revoked).toBe(0);
    });
});
