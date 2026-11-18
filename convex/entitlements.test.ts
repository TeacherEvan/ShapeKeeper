import { describe, expect, it, vi } from 'vitest';
import * as ent from './entitlements';

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
