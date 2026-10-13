import { describe, expect, it } from 'vitest';
import * as games from './games';

describe('live game API surface', () => {
    it.each([
        'drawLine',
        'getGameState',
        'revealMultiplier',
        'tapSquare',
        'endGame',
        'resetGame',
        'populateLines',
        'requestRematch',
    ])('registers %s', (name) => {
        expect((games as any)[name]).toBeDefined();
    });

    it('drawLine accepts clientSentAt (client always sends it)', () => {
        const exported = (games.drawLine as any).exportArgs?.();
        expect(typeof exported).toBe('string');
        expect(exported).toContain('clientSentAt');
    });
});
