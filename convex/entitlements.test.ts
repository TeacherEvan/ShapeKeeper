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

describe('redeemEntitlement', () => {

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

/**
 * The daily sweep is the slow path that makes a dead licence stop working when
 * no webhook ever said so. It must never mark anything valid on a failed
 * request, and it must never spend money it does not need to.
 */
describe('licensesDueForCheck', () => {
    it('returns active entitlements oldest-checked first and skips the unlinked', async () => {
        const { ctx } = makeCtx([
            { _id: 'e1', instanceId: 'a', orderId: 'o1', status: 'active', lastValidatedAt: 30 },
            { _id: 'e2', instanceId: 'b', orderId: 'o2', status: 'active', lastValidatedAt: 10 },
            { _id: 'e3', instanceId: 'c', status: 'active' },
            { _id: 'e4', instanceId: 'd', orderId: 'o4', status: 'revoked', lastValidatedAt: 1 },
        ]);

        const res = await (ent.licensesDueForCheck as any)._handler(ctx, { limit: 5 });

        expect(res.due.map((r: any) => r.instanceId)).toEqual(['b', 'a']);
        expect(res.active).toBe(3);
        expect(res.unchecked).toBe(1);
    });

    it('respects the batch limit', async () => {
        const seed = Array.from({ length: 10 }, (_, i) => ({
            _id: `e${i}`,
            instanceId: `i${i}`,
            orderId: `o${i}`,
            status: 'active',
            lastValidatedAt: i,
        }));
        const { ctx } = makeCtx(seed);

        const res = await (ent.licensesDueForCheck as any)._handler(ctx, { limit: 3 });

        expect(res.due).toHaveLength(3);
        expect(res.due[0].instanceId).toBe('i0');
    });
});

describe('sweepExpiredLicenses', () => {
    const DUE = {
        due: [
            { instanceId: 'inst-live', orderId: 'order-live' },
            { instanceId: 'inst-dead', orderId: 'order-dead' },
        ],
        unchecked: 0,
        active: 2,
    };

    function sweepCtx(keyStatus: () => Promise<any>) {
        const mutations: any[] = [];
        return {
            mutations,
            ctx: {
                runQuery: vi.fn(async () => DUE),
                runMutation: vi.fn(async (_ref: any, args: any) => {
                    mutations.push(args);
                    return { updated: true };
                }),
                fetchImpl: keyStatus,
            } as any,
        };
    }

    it('does nothing, and claims nothing, without an API key', async () => {
        const restore = withEnv({ LEMONSQUEEZY_API_KEY: undefined });
        const { ctx, mutations } = sweepCtx(async () => ({ status: 'active' }));

        const res = await (ent.sweepExpiredLicenses as any)._handler(ctx, {});

        expect(res).toEqual({ skipped: 'no_api_key', checked: 0, revoked: 0 });
        expect(mutations).toHaveLength(0);
        restore();
    });

    it('revokes a key that is no longer active and stamps the live one', async () => {
        const restore = withEnv({ LEMONSQUEEZY_API_KEY: 'test-api-key' });
        const byOrder: Record<string, string> = {
            'order-live': 'active',
            'order-dead': 'expired',
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                const orderId = decodeURIComponent(String(url).split('filter[order_id]=')[1] ?? '');
                return {
                    ok: true,
                    json: async () => ({
                        data: [{ attributes: { status: byOrder[orderId] } }],
                    }),
                };
            }),
        );
        const { ctx, mutations } = sweepCtx(async () => ({}));

        const res = await (ent.sweepExpiredLicenses as any)._handler(ctx, {});

        expect(res.checked).toBe(1);
        expect(res.revoked).toBe(1);
        expect(mutations).toEqual([
            { instanceId: 'inst-live', valid: true },
            { instanceId: 'inst-dead', valid: false },
        ]);
        vi.unstubAllGlobals();
        restore();
    });

    it('treats an unreachable licence API as unknown, never as valid', async () => {
        const restore = withEnv({ LEMONSQUEEZY_API_KEY: 'test-api-key' });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network down');
            }),
        );
        const { ctx, mutations } = sweepCtx(async () => ({}));

        const res = await (ent.sweepExpiredLicenses as any)._handler(ctx, {});

        expect(res.unreachable).toBe(2);
        expect(mutations).toHaveLength(0);
        vi.unstubAllGlobals();
        restore();
    });

    it('refuses a test-mode purchase instead of unlocking the live game', async () => {
        const restore = withEnv({
            LEMONSQUEEZY_PRODUCT_IDS: PRODUCT,
            LEMONSQUEEZY_ALLOW_TEST_ORDERS: undefined,
        });
        stubLicenseApi(ACTIVATED);
        const { ctx, rows } = makeCtx([
            { _id: 'p1', orderId: 'order-1', licenseKeyHash: KEY_HASH, status: 'paid', testMode: true },
        ]);

        const res = await (ent.redeemEntitlement as any)._handler(ctx, {
            licenseKey: KEY,
            instanceName: 'device-1',
        });

        expect(res).toEqual({ active: false, reason: 'test_order' });
        expect(rows.filter((r: any) => r.instanceId !== undefined)).toHaveLength(0);
        restore();
    });
});
