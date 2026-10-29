import { describe, expect, it } from 'vitest';
import { hmacSha256Hex, sha256Hex, timingSafeEqualHex, toHex } from './crypto';

/**
 * The webhook relay verifies Lemon Squeezy's signature with this code. If it
 * is wrong in any way, either every sale is rejected or every caller is
 * trusted.
 *
 * These expectations are NOT computed by this repository — they are published
 * test vectors: FIPS 180-2 (SHA-256) and RFC 4231 (HMAC-SHA256). A
 * cross-check against another implementation lives in
 * `tests/crypto-crosscheck.test.js`, which runs under Node and can import
 * `node:crypto`; this file stays free of Node types so the Convex deployment
 * type-check has nothing to complain about.
 */
describe('sha256Hex — published vectors', () => {
    it('matches FIPS 180-2 examples', () => {
        expect(sha256Hex('')).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        );
        expect(sha256Hex('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
        expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
            '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
        );
    });

    it('matches the canonical long-message vector', () => {
        expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
            'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
        );
    });
});

describe('hmacSha256Hex — RFC 4231 vectors', () => {
    it('matches test case 1 (20-byte key, short data)', () => {
        const key = '\x0b'.repeat(20);
        expect(hmacSha256Hex(key, 'Hi There')).toBe(
            'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
        );
    });

    it('matches test case 2 (short key, short data)', () => {
        expect(hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe(
            '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
        );
    });
});

describe('timingSafeEqualHex', () => {
    it('accepts identical strings', () => {
        expect(timingSafeEqualHex('abc123', 'abc123')).toBe(true);
    });

    it('rejects different strings of the same length', () => {
        expect(timingSafeEqualHex('abc123', 'abc124')).toBe(false);
    });

    it('rejects strings of different lengths', () => {
        expect(timingSafeEqualHex('abc123', 'abc1234')).toBe(false);
    });

    it('rejects non-strings without throwing', () => {
        expect(timingSafeEqualHex(undefined as unknown as string, 'abc')).toBe(false);
        expect(timingSafeEqualHex('abc', null as unknown as string)).toBe(false);
    });
});

describe('toHex', () => {
    it('zero-pads each byte', () => {
        expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
    });
});
