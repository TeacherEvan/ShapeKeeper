import { describe, expect, it, vi } from 'vitest';
import {
    validateLicenseHandler,
    verifyPaymentHandler,
    paystackWebhookHandler,
} from './http';

const ALLOWED_ORIGIN = 'https://shape-keeper.vercel.app';

describe('convex/http rate limiting and payload bounds', () => {
    it('returns 429 with Retry-After when /paystack/verify exceeds rate limit', async () => {
        let calls = 0;
        const ctx = {
            runMutation: vi.fn(async () => {
                calls += 1;
                if (calls > 10) return { allowed: false, remaining: 0, resetMs: 45000 };
                return { allowed: true, remaining: 10 - calls, resetMs: 60000 };
            }),
            runQuery: vi.fn(),
        };

        for (let i = 0; i < 10; i++) {
            const req = new Request('https://example.convex.site/paystack/verify', {
                method: 'POST',
                headers: {
                    origin: ALLOWED_ORIGIN,
                    'content-type': 'application/json',
                    'x-forwarded-for': '203.0.113.10',
                },
                body: JSON.stringify({ reference: 'BAD' }), // fails regex -> 400 after rate-limit check
            });
            const res = await verifyPaymentHandler(ctx, req);
            expect(res.status).toBe(400);
        }

        const eleventh = new Request('https://example.convex.site/paystack/verify', {
            method: 'POST',
            headers: {
                origin: ALLOWED_ORIGIN,
                'content-type': 'application/json',
                'x-forwarded-for': '203.0.113.10',
            },
            body: JSON.stringify({ reference: 'VALID_REF_1234' }),
        });
        const blocked = await verifyPaymentHandler(ctx, eleventh);
        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    });

    it('returns 429 when /license/validate exceeds rate limit', async () => {
        const ctx = {
            runMutation: vi.fn(async () => ({ allowed: false, remaining: 0, resetMs: 30000 })),
            runQuery: vi.fn(),
        };
        const req = new Request('https://example.convex.site/license/validate', {
            method: 'POST',
            headers: {
                origin: ALLOWED_ORIGIN,
                'content-type': 'application/x-www-form-urlencoded',
                'cf-connecting-ip': '198.51.100.7',
            },
            body: 'license_key=SK-TEST-TEST-TEST-TEST',
        });
        const res = await validateLicenseHandler(ctx, req);
        expect(res.status).toBe(429);
        expect(ctx.runQuery).not.toHaveBeenCalled();
    });

    it('rejects oversized webhook payloads (> 64 KiB) with 413 before HMAC', async () => {
        const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
        const oversized = 'x'.repeat(70000);
        const req = new Request('https://example.convex.site/paystack/webhook', {
            method: 'POST',
            headers: {
                'x-paystack-signature': 'a'.repeat(128),
            },
            body: oversized,
        });
        const res = await paystackWebhookHandler(ctx, req);
        expect(res.status).toBe(413);
    });
});
