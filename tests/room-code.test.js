import { describe, expect, it } from 'vitest';

import {
    generateRoomCode,
    generateSecureRoomCode,
    ROOM_CODE_CHARSET,
    ROOM_CODE_LENGTH,
} from '../convex/rooms/shared-utils.js';

describe('generateRoomCode', () => {
    it('produces a string of the configured length', () => {
        const code = generateRoomCode();
        expect(code).toHaveLength(ROOM_CODE_LENGTH);
    });

    it('uses only characters from the 32-char alphabet', () => {
        // Run a bunch of trials because Math.random makes individual
        // draws nondeterministic.
        for (let i = 0; i < 200; i++) {
            const code = generateRoomCode();
            for (const c of code) {
                expect(ROOM_CODE_CHARSET).toContain(c);
            }
        }
    });

    it('accepts an injected RNG for deterministic testing', () => {
        // Sequence: 0.0, 0.5, 0.99, 0.25, 0.75, 0.1
        const seq = [0, 0.5, 0.99, 0.25, 0.75, 0.1];
        let i = 0;
        const code = generateRoomCode(() => seq[i++]);
        expect(code).toHaveLength(6);
        // Each char must be the floor(seq * 32)-th char in the alphabet.
        const expected = seq.map(
            (s) => ROOM_CODE_CHARSET[Math.floor(s * ROOM_CODE_CHARSET.length)]
        );
        expect(code.split('')).toEqual(expected);
    });

    it('returns a different code on each call (statistical check)', () => {
        const seen = new Set();
        for (let i = 0; i < 200; i++) seen.add(generateRoomCode());
        // Birthday-paradox: with 200 samples over a ~1e9 space, collisions
        // are astronomically unlikely. A duplicate here would mean the RNG
        // is broken.
        expect(seen.size).toBe(200);
    });
});

describe('generateSecureRoomCode', () => {
    it('produces a string of the configured length using only charset chars', () => {
        for (let i = 0; i < 50; i++) {
            const code = generateSecureRoomCode();
            expect(code).toHaveLength(ROOM_CODE_LENGTH);
            for (const c of code) {
                expect(ROOM_CODE_CHARSET).toContain(c);
            }
        }
    });

    it('falls back to Math.random when crypto.getRandomValues is unavailable', () => {
        const original = globalThis.crypto;
        // Strip the Web Crypto API. The fallback path must still produce a
        // valid code (and must NOT throw).
        // @ts-expect-error -- intentionally mutate the global for the test
        delete globalThis.crypto;
        try {
            const code = generateSecureRoomCode();
            expect(code).toHaveLength(ROOM_CODE_LENGTH);
        } finally {
            // Restore so later tests in the same file aren't affected.
            // @ts-expect-error -- restore
            globalThis.crypto = original;
        }
    });
});
