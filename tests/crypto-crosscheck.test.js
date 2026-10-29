import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hmacSha256Hex, sha256Hex, timingSafeEqualHex } from '../convex/utils/crypto';

/**
 * Cross-check the hand-rolled SHA-256/HMAC used by the Lemon Squeezy webhook
 * relay against Node's own implementation, over the edge cases: empty
 * message, the padding boundary at 55/56/64/65 bytes, keys longer than the
 * 64-byte block, and multi-byte UTF-8.
 *
 * The published-vector proof lives in `convex/utils/crypto.test.ts` (it has to
 * stay free of Node types so the Convex deployment type-check passes); this
 * file is the broad sweep.
 */
describe('sha256Hex vs node:crypto', () => {
    const cases = [
        '',
        'a',
        'abc',
        'The quick brown fox jumps over the lazy dog',
        'x'.repeat(55),
        'x'.repeat(56),
        'x'.repeat(63),
        'x'.repeat(64),
        'x'.repeat(65),
        'x'.repeat(1000),
        'ünïcödé — ключ 🔑',
        JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: '1' } }),
    ];

    it('matches for every case', () => {
        for (const input of cases) {
            expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
        }
    });
});

describe('hmacSha256Hex vs node:crypto', () => {
    const cases = [
        ['sh', ''],
        ['sh', 'body'],
        ['Jefe', 'what do ya want for nothing?'],
        ['a-signing-secret-longer-than-the-sixty-four-byte-block-size-limit', 'body'],
        ['k'.repeat(64), 'body'],
        ['k'.repeat(65), 'body'],
        ['k'.repeat(200), 'body'],
        ['sh', '{"meta":{"event_name":"order_created"}}'],
    ];

    it('matches for every case', () => {
        for (const [secret, body] of cases) {
            expect(hmacSha256Hex(secret, body)).toBe(
                createHmac('sha256', secret).update(body, 'utf8').digest('hex')
            );
        }
    });
});

describe('timingSafeEqualHex', () => {
    it('rejects a single-character difference', () => {
        const a = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';
        const b = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff8';
        expect(timingSafeEqualHex(a, a)).toBe(true);
        expect(timingSafeEqualHex(a, b)).toBe(false);
    });
});
