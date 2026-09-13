/**
 * Tests for the silly [Adjective][Animal] passcode generator.
 * No environment, no Convex — pure functions only.
 */
import { describe, it, expect } from 'vitest';
import { ADJECTIVES, ANIMALS, generateSillyPasscode } from './shared.ts';

describe('word lists', () => {
    it('exposes 50+ adjectives and 50+ animals', () => {
        expect(ADJECTIVES.length).toBeGreaterThanOrEqual(50);
        expect(ANIMALS.length).toBeGreaterThanOrEqual(50);
    });

    it('word lists are all lowercase ASCII (no numbers, no spaces, no capitals)', () => {
        for (const word of [...ADJECTIVES, ...ANIMALS]) {
            expect(word).toMatch(/^[a-z]+$/);
        }
    });

    it('no duplicate words within a list', () => {
        expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length);
        expect(new Set(ANIMALS).size).toBe(ANIMALS.length);
    });
});

describe('generateSillyPasscode', () => {
    it('returns TitleCase [Adjective][Animal] with no numbers', () => {
        for (let i = 0; i < 200; i++) {
            const code = generateSillyPasscode();
            expect(code).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
            expect(code).not.toMatch(/\d/);
        }
    });

    it('passcode parts are members of the word lists', () => {
        for (let i = 0; i < 200; i++) {
            const code = generateSillyPasscode();
            // Split on the second capital: first cap = start of adjective, second cap = start of animal
            const parts = code.split(/(?=[A-Z])/);
            expect(parts).toHaveLength(2);
            const adj = parts[0][0].toLowerCase() + parts[0].slice(1);
            const animal = parts[1][0].toLowerCase() + parts[1].slice(1);
            expect(ADJECTIVES).toContain(adj);
            expect(ANIMALS).toContain(animal);
        }
    });

    it('produces variation across many calls (collision sanity)', () => {
        const seen = new Set();
        for (let i = 0; i < 500; i++) {
            seen.add(generateSillyPasscode());
        }
        // 50 * 50 = 2500 possible combos; over 500 samples we expect MANY distinct values
        expect(seen.size).toBeGreaterThan(400);
    });

    it('avoids human-name word starts (e.g. Bob-cat should not match "Bob")', () => {
        // Each passcode is two words starting at capital letters. Check each word
        // independently against a small set of human-name first halves.
        const firstNames = [
            'John',
            'Jane',
            'Bob',
            'Alice',
            'Charlie',
            'David',
            'Eve',
            'Frank',
            'Grace',
            'Heidi',
        ];
        for (let i = 0; i < 500; i++) {
            const code = generateSillyPasscode();
            const parts = code.split(/(?=[A-Z])/);
            for (const part of parts) {
                for (const name of firstNames) {
                    // Reject if the word IS the name OR starts with it (would read as a name)
                    expect(part === name || part.startsWith(name)).toBe(false);
                }
            }
        }
    });
});
