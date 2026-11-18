import { describe, expect, it, vi } from 'vitest';
import * as lic from './licences';

/** Same handler-level harness style as entitlements.test.ts. */
function makeCtx(seed: any[] = []) {
    // Rows carry their table name so queries against paystackRefunds cannot
    // accidentally match a licence row with the same reference.
    const rows: any[] = seed.map((r) => ({ _table: 'paystackLicences', ...r }));
    let seq = 0;
    const ctx: any = {
        db: {
            insert: vi.fn(async (table: string, doc: any) => {
                const _id = `row_${++seq}`;
                rows.push({ _id, _table: table, ...doc });
                return _id;
            }),
            patch: vi.fn(async (id: any, patchObj: any) => {
                const row = rows.find((r) => r._id === id);
                if (row) Object.assign(row, patchObj);
            }),
            query: vi.fn((table: string) => ({
                withIndex: (_name: string, fn: (q: any) => any) => {
                    const preds: Array<[string, any]> = [];
                    const q: any = { eq: (f: string, v: any) => { preds.push([f, v]); return q; } };
                    fn(q);
                    const matched = () =>
                        rows.filter(
                            (r) => r._table === table && preds.every(([f, v]) => r[f] === v)
                        );
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

const BASE = {
    keyHash: 'a'.repeat(64),
    key: 'SK-ABCD-EFGH-JKLM-NPQR',
    reference: 'SK-abc-123',
    email: 'buyer@example.com',
    amountKobo: 1800,
};

describe('paystack licences', () => {
    it('issues one active licence and returns the key', async () => {
        const { ctx, rows } = makeCtx();
        const res = await (lic.issue as any)._handler(ctx, BASE);
        expect(res.created).toBe(true);
        expect(res.key).toBe(BASE.key);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('active');
        expect(rows[0].amountKobo).toBe(1800);
    });

    it('never mints twice for the same Paystack reference', async () => {
        const { ctx, rows } = makeCtx();
        await (lic.issue as any)._handler(ctx, BASE);
        const second = await (lic.issue as any)._handler(ctx, { ...BASE, key: 'ANOTHER-KEY' });
        expect(second.created).toBe(false);
        expect(second.key).toBe(BASE.key);
        expect(rows).toHaveLength(1);
    });

    it('validates only active licences by key hash', async () => {
        const { ctx } = makeCtx([
            { _id: 'lic_1', ...BASE, status: 'active', createdAt: 1 },
            { _id: 'lic_2', ...BASE, keyHash: 'b'.repeat(64), status: 'revoked', createdAt: 1 },
        ]);
        expect(await (lic.getByHash as any)._handler(ctx, { keyHash: BASE.keyHash })).toEqual({ valid: true });
        expect(await (lic.getByHash as any)._handler(ctx, { keyHash: 'b'.repeat(64) })).toEqual({ valid: false });
        expect(await (lic.getByHash as any)._handler(ctx, { keyHash: 'c'.repeat(64) })).toEqual({ valid: false });
    });

    it('returns the original key to a returning buyer', async () => {
        const { ctx } = makeCtx([{ _id: 'lic_1', ...BASE, status: 'active', createdAt: 1 }]);
        const found = await (lic.getByReference as any)._handler(ctx, { reference: BASE.reference });
        expect(found.key).toBe(BASE.key);
        expect((await (lic.getByReference as any)._handler(ctx, { reference: 'missing' }))).toBeNull();
    });

    it('revokes by reference so refunds cannot keep a licence live', async () => {
        const { ctx, rows } = makeCtx([{ _id: 'lic_1', ...BASE, status: 'active', createdAt: 1 }]);
        const res = await (lic.revokeByReference as any)._handler(ctx, { reference: BASE.reference });
        expect(res.revoked).toBe(true);
        expect(rows[0].status).toBe('revoked');
        expect(rows[0].revokedAt).toBeGreaterThan(0);
        expect(await (lic.getByHash as any)._handler(ctx, { keyHash: BASE.keyHash })).toEqual({ valid: false });
    });
});


describe('paystack refund tombstones', () => {
    it('records a refund once and reports it by reference', async () => {
        const { ctx, rows } = makeCtx();
        expect(await (lic.markRefunded as any)._handler(ctx, { reference: 'REF-1' })).toEqual({ created: true });
        expect(await (lic.isRefunded as any)._handler(ctx, { reference: 'REF-1' })).toBe(true);
        expect(await (lic.markRefunded as any)._handler(ctx, { reference: 'REF-1' })).toEqual({ created: false });
        expect(rows).toHaveLength(1);
    });

    it('reports unknown references as not refunded', async () => {
        const { ctx } = makeCtx();
        expect(await (lic.isRefunded as any)._handler(ctx, { reference: 'missing' })).toBe(false);
    });
});


describe('paystack atomic refund guard', () => {
    it('refuses to issue an active licence when a refund tombstone exists', async () => {
        const { ctx, rows } = makeCtx([
            { _table: 'paystackRefunds', reference: 'REF-ATOMIC', createdAt: 1 },
        ]);
        const res = await (lic.issue as any)._handler(ctx, { ...BASE, reference: 'REF-ATOMIC' });
        expect(res.refunded).toBe(true);
        expect(res.created).toBe(false);
        expect(rows.filter((r: any) => r._table === 'paystackLicences')).toHaveLength(0);
    });
});
