import { describe, expect, it } from 'vitest';
import {
    ALLOWED_ORIGINS,
    generateReference,
    isAllowedOrigin,
    paymentMatchesOrder,
    timingSafeHexEqual,
} from './paystackAuth';

describe('paystackAuth - origin allowlist', () => {
    it('accepts every explicit allowlist origin', () => {
        for (const origin of ALLOWED_ORIGINS) {
            expect(isAllowedOrigin(origin)).toBe(true);
        }
    });

    it('denies implicit Vercel preview origins', () => {
        expect(isAllowedOrigin('https://shape-keeper-git-main-abc123.vercel.app')).toBe(false);
        expect(isAllowedOrigin('https://shape-keeper-abc-123.vercel.app')).toBe(false);
    });

    it('denies a missing Origin (no wildcard fallback)', () => {
        expect(isAllowedOrigin(null)).toBe(false);
        expect(isAllowedOrigin(undefined)).toBe(false);
        expect(isAllowedOrigin('')).toBe(false);
    });

    it('denies unknown and look-alike origins', () => {
        expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
        expect(isAllowedOrigin('http://shape-keeper.vercel.app')).toBe(false);
        expect(isAllowedOrigin('https://shape-keeper.vercel.app.evil.com')).toBe(false);
        expect(isAllowedOrigin('https://not-shape-keeper-abc.vercel.app')).toBe(false);
    });
});

describe('paystackAuth - timing-safe hex comparison', () => {
    it('accepts identical strings, including empty', () => {
        expect(timingSafeHexEqual('', '')).toBe(true);
        expect(timingSafeHexEqual('abcdef0123', 'abcdef0123')).toBe(true);
    });

    it('rejects equal-length strings that differ', () => {
        expect(timingSafeHexEqual('abcdef0123', 'abcdef0124')).toBe(false);
        expect(timingSafeHexEqual('a'.repeat(128), 'a'.repeat(127) + 'b')).toBe(false);
    });

    it('rejects different-length strings', () => {
        expect(timingSafeHexEqual('abc', 'abcd')).toBe(false);
        expect(timingSafeHexEqual('abcd', 'abc')).toBe(false);
    });

    it('is case-sensitive and rejects non-strings', () => {
        expect(timingSafeHexEqual('ABCD', 'abcd')).toBe(false);
        expect(timingSafeHexEqual('abc' as any, undefined as any)).toBe(false);
    });
});

describe('paystackAuth - secure payment reference', () => {
    it('uses the Paystack-allowed shape', () => {
        const ref = generateReference();
        expect(ref).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
        expect(ref.startsWith('SK-')).toBe(true);
        // SK- prefix + 16 base64url characters = 96 bits of CSPRNG entropy.
        expect(ref).toMatch(/^SK-[A-Za-z0-9_-]{16}$/);
    });

    it('produces unique references across many calls', () => {
        const refs = new Set(Array.from({ length: 200 }, () => generateReference()));
        expect(refs.size).toBe(200);
    });
});


describe('paystackAuth - authoritative order check', () => {
    it('accepts a successful R18 payment in the expected currency', () => {
        expect(
            paymentMatchesOrder({ status: 'success', amount: 1800, currency: 'ZAR' }, 1800, 'ZAR')
        ).toBe(true);
    });

    it('accepts lowercase currency codes', () => {
        expect(
            paymentMatchesOrder({ status: 'success', amount: 1800, currency: 'zar' }, 1800, 'ZAR')
        ).toBe(true);
    });

    it('rejects the same subunit amount in a cheaper currency', () => {
        expect(
            paymentMatchesOrder({ status: 'success', amount: 1800, currency: 'NGN' }, 1800, 'ZAR')
        ).toBe(false);
    });

    it('rejects a wrong amount and a missing currency', () => {
        expect(
            paymentMatchesOrder({ status: 'success', amount: 18000, currency: 'ZAR' }, 1800, 'ZAR')
        ).toBe(false);
        expect(paymentMatchesOrder({ status: 'success', amount: 1800 }, 1800, 'ZAR')).toBe(false);
    });

    it('rejects pending/failed payments and missing data', () => {
        expect(
            paymentMatchesOrder({ status: 'pending', amount: 1800, currency: 'ZAR' }, 1800, 'ZAR')
        ).toBe(false);
        expect(paymentMatchesOrder(null, 1800, 'ZAR')).toBe(false);
        expect(paymentMatchesOrder(undefined, 1800, 'ZAR')).toBe(false);
    });
});
