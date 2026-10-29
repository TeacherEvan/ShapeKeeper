import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ent from './entitlements';
import { sha256Hex } from './utils/crypto';

/**
 * Vitest harness matching the repo's existing style (`games.test.ts`): call the
 * registered function's `_handler` with a mocked ctx. The mock interprets the
 * `withIndex(name, q => q.eq(field, value))` form the module uses, so the
 * assertions exercise the real handler logic rather than a reimplementation.
 */
function makeCtx(seed: any[] = []) {
    const rows: any[] = seed.map((r) => ({ ...r }));
    let seq = 0;

    const ctx: any = {
        db: {
            insert: vi.fn(async (_table: string, doc: any) => {
                const _id = `ent_${++seq}`;
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

const HASH = 'a'.repeat(64);
const BASE = {
    licenseKeyHash: HASH,
    instanceId: 'inst-1',
    productId: '1361446',
    storeId: '474582',
    orderId: 'ord_1',
};

describe('entitlements', () => {
    it('records a new entitlement as active with the default seat count', async () => {
        const { ctx, rows } = makeCtx();
        const res = await (ent.recordEntitlement as any)._handler(ctx, BASE);
        expect(res.created).toBe(true);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('active');
        expect(rows[0].seats).toBe(1);
        expect(rows[0].productId).toBe('1361446');
    });

    it('is idempotent when Lemon Squeezy retries the webhook', async () => {
        const { ctx, rows } = makeCtx();
        await (ent.recordEntitlement as any)._handler(ctx, BASE);
        const second = await (ent.recordEntitlement as any)._handler(ctx, BASE);
        expect(second.created).toBe(false);
        expect(rows).toHaveLength(1);
    });

    it('reactivates a revoked instance when the licence is recorded again', async () => {
        const { ctx, rows } = makeCtx([
            { _id: 'ent_0', ...BASE, status: 'revoked', seats: 1, createdAt: 1, revokedAt: 5 },
        ]);
        await (ent.recordEntitlement as any)._handler(ctx, BASE);
        expect(rows[0].status).toBe('active');
        expect(rows[0].revokedAt).toBeUndefined();
    });

    it('revokes every activation sharing the licence hash, and only those', async () => {
        const { ctx, rows } = makeCtx([
            { _id: 'ent_1', ...BASE, instanceId: 'i1', status: 'active', seats: 1, createdAt: 1 },
            { _id: 'ent_2', ...BASE, instanceId: 'i2', status: 'active', seats: 1, createdAt: 1 },
            {
                _id: 'ent_3',
                ...BASE,
                licenseKeyHash: 'b'.repeat(64),
                instanceId: 'i3',
                status: 'active',
                seats: 1,
                createdAt: 1,
            },
        ]);
        const res = await (ent.revokeEntitlement as any)._handler(ctx, { licenseKeyHash: HASH });
        expect(res.matched).toBe(2);
        expect(res.revoked).toBe(2);
        expect(rows[0].status).toBe('revoked');
        expect(rows[2].status).toBe('active');
    });

    it('reports active for a live entitlement', async () => {
        const { ctx } = makeCtx([{ _id: 'ent_1', ...BASE, status: 'active', seats: 1, createdAt: 1 }]);
        const res = await (ent.checkEntitlement as any)._handler(ctx, { instanceId: 'inst-1' });
        expect(res).toEqual({ active: true, productId: '1361446' });
    });

    it('reports inactive for a revoked entitlement and for an unknown device', async () => {
        const { ctx } = makeCtx([{ _id: 'ent_1', ...BASE, status: 'revoked', seats: 1, createdAt: 1 }]);
        expect(await (ent.checkEntitlement as any)._handler(ctx, { instanceId: 'inst-1' })).toEqual({
            active: false,
            productId: null,
        });
        expect(await (ent.checkEntitlement as any)._handler(ctx, { instanceId: 'nope' })).toEqual({
            active: false,
            productId: null,
        });
    });

    it('leaks neither key material nor PII from the public query', async () => {
        const { ctx } = makeCtx([
            { _id: 'ent_1', ...BASE, email: 'buyer@example.com', status: 'active', seats: 1, createdAt: 1 },
        ]);
        const res = await (ent.checkEntitlement as any)._handler(ctx, { instanceId: 'inst-1' });
        expect(Object.keys(res).sort()).toEqual(['active', 'productId']);
        expect(JSON.stringify(res)).not.toContain('@');
        expect(JSON.stringify(res)).not.toContain(HASH);
    });

    it('revokes on an invalid re-validation and stamps a valid one', async () => {
        const { ctx, rows } = makeCtx([{ _id: 'ent_1', ...BASE, status: 'active', seats: 1, createdAt: 1 }]);
        await (ent.markValidated as any)._handler(ctx, { instanceId: 'inst-1', valid: true });
        expect(rows[0].lastValidatedAt).toBeGreaterThan(0);
        await (ent.markValidated as any)._handler(ctx, { instanceId: 'inst-1', valid: false });
        expect(rows[0].status).toBe('revoked');
    });
});

/**
 * `redeemEntitlement` is the only public path from a licence key to an
 * entitlement, and it talks to Lemon Squeezy. The network is stubbed, the
 * environment is set per test, and the assertions are about what reaches the
 * database — the part that can hand out a free game if it is wrong.
 */
describe('redeemEntitlement', () => {
    const KEY = 'ABCD-1234-EFGH-5678';
    const KEY_HASH = sha256Hex(KEY);
    const PRODUCT = '1361446';

    function stubLicenseApi(payload: unknown, ok = true) {
        const calls: any[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init: any) => {
                calls.push({ url, init });
                return { ok, json: async () => payload };
            }),
        );
        return calls;
    }

    function withEnv(vars: Record<string, string | undefined>) {
        const saved: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(vars)) {
            saved[key] = process.env[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        return () => {
            for (const [key, value] of Object.entries(saved)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        };
    }

    const ACTIVATED = {
        activated: true,
        instance: { id: 'inst-9' },
        license_key: {
            activation_limit: 3,
            meta: { product_id: PRODUCT, store_id: '474582' },
        },
    };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fails closed when no product allow-list is configured', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: undefined });
        const calls = stubLicenseApi(ACTIVATED);
        const { ctx } = makeCtx();

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: KEY,
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'products_not_configured' });
        expect(calls).toHaveLength(0);
        restore();
    });

    it('rejects a key too short to be real without calling the licence API', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: PRODUCT });
        const calls = stubLicenseApi(ACTIVATED);
        const { ctx } = makeCtx();

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: 'short',
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'malformed_key' });
        expect(calls).toHaveLength(0);
        restore();
    });

    it('exchanges a good key for an instance id and stores only the hash', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: PRODUCT });
        stubLicenseApi(ACTIVATED);
        const { ctx, rows } = makeCtx();

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: KEY,
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: true, instanceId: 'inst-9', productId: PRODUCT });
        // The rate limiter writes to `rateLimits`; only entitlement rows matter here.
        const entitlementRows = rows.filter((r: any) => r.instanceId !== undefined);
        expect(entitlementRows).toHaveLength(1);
        expect(entitlementRows[0].licenseKeyHash).toBe(KEY_HASH);
        expect(entitlementRows[0].seats).toBe(3);
        expect(entitlementRows[0].status).toBe('active');
        // The raw key must never be written, and the client must never see it.
        expect(JSON.stringify(rows)).not.toContain(KEY);
        expect(JSON.stringify(res)).not.toContain(KEY);
        restore();
    });

    it('refuses a key for a product that is not on the allow-list', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: '999999' });
        stubLicenseApi(ACTIVATED);
        const { ctx, rows } = makeCtx();

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: KEY,
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'product_not_allowed' });
        expect(rows.filter((r: any) => r.instanceId !== undefined)).toHaveLength(0);
        restore();
    });

    it('refuses a refunded key even when Lemon Squeezy still activates it', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: PRODUCT });
        stubLicenseApi(ACTIVATED);
        const { ctx, rows } = makeCtx([
            { _id: 'p1', orderId: 'order-1', licenseKeyHash: KEY_HASH, status: 'refunded' },
        ]);

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: KEY,
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'key_refunded' });
        expect(rows.filter((r: any) => r.instanceId)).toHaveLength(0);
        restore();
    });

    it('reports an unreachable licence service as such, not as a purchase', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: PRODUCT });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network down');
            }),
        );
        const { ctx, rows } = makeCtx();

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: KEY,
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'license_service_unreachable' });
        expect(rows.filter((r: any) => r.instanceId !== undefined)).toHaveLength(0);
        restore();
    });

    it('stops calling the licence API once a device has spent its budget', async () => {
        const restore = withEnv({ LEMONSQUEEZY_PRODUCT_IDS: PRODUCT });
        const calls = stubLicenseApi({ activated: false, error: 'license_key not found' });
        const { ctx } = makeCtx();

        for (let i = 0; i < 5; i += 1) {
            await (ent.redeemEntitlement as any)._handler(ctx, {
                licenseKey: `BAD-KEY-${String(i).padStart(4, '0')}`,
                instanceName: 'device-1',
            });
        }
        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: 'BAD-KEY-9999',
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'rate_limited' });
        // Five outbound calls, not six: the refused attempt never reached LS.
        expect(calls).toHaveLength(5);
        restore();
    });
});
