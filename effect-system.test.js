import { describe, expect, it, vi } from 'vitest';

import { EffectSystem } from './effect-system.js';

function makeGame(overrides = {}) {
    return {
        tileEffects: {},
        revealedEffects: new Set(),
        gameLogic: { getCellOwnerForEffects: vi.fn(() => 1), parseSquareKey: (k) => k },
        soundManager: { playEffectRevealSound: vi.fn() },
        particleSystem: { createEffectParticles: vi.fn() },
        draw: vi.fn(),
        ...overrides,
    };
}

describe('EffectSystem — delegation & modal', () => {
    it('constructs and creates the effect modal via the injected factory', () => {
        const game = makeGame();
        const sys = new EffectSystem(game);
        expect(sys.game).toBe(game);
        // createEffectModal runs on construction (real import); just ensure state is sane
        expect(sys.pendingEffect).toBeNull();
        expect(sys.oracleVisionActive).toBe(false);
    });

    it('initializeMultipliers delegates to the game multiplier store', () => {
        const game = makeGame({ gridRows: 6, gridCols: 6, squareMultipliers: {} });
        const sys = new EffectSystem(game);
        sys.initializeMultipliers();
        // 5x5 grid of squares => 25 squares, every square gets a multiplier
        const keys = Object.keys(game.squareMultipliers);
        expect(keys.length).toBe(25);
        for (const k of keys) {
            expect(game.squareMultipliers[k]).toMatchObject({ type: 'multiplier' });
        }
    });

    it('initializeTileEffects is a no-op when party mode is disabled', () => {
        const game = makeGame({
            gridRows: 6,
            gridCols: 6,
            partyModeEnabled: false,
            tileEffects: {},
        });
        const sys = new EffectSystem(game);
        sys.initializeTileEffects();
        expect(Object.keys(game.tileEffects).length).toBe(0);
    });

    it('initializeTileEffects populates a trap+powerup on every square in party mode', () => {
        const game = makeGame({
            gridRows: 4,
            gridCols: 4,
            partyModeEnabled: true,
            tileEffects: {},
        });
        const sys = new EffectSystem(game);
        sys.initializeTileEffects();
        const entries = Object.entries(game.tileEffects);
        expect(entries.length).toBe(9); // 3x3 squares
        for (const [, e] of entries) {
            expect(['trap', 'powerup']).toContain(e.type);
            expect(e.revealed).toBe(false);
        }
    });
});

describe('EffectSystem — revealTileEffect', () => {
    function seededGame() {
        return makeGame({
            tileEffects: {
                '0,0': { type: 'powerup', effect: { id: 'gift' }, revealed: false },
            },
        });
    }

    it('does nothing when the square has no effect', () => {
        const game = makeGame();
        const sys = new EffectSystem(game);
        sys.revealTileEffect('9,9');
        expect(sys.pendingEffect).toBeNull();
        expect(game.soundManager.playEffectRevealSound).not.toHaveBeenCalled();
    });

    it('does nothing when the effect was already revealed', () => {
        const game = seededGame();
        game.revealedEffects.add('0,0');
        const sys = new EffectSystem(game);
        sys.revealTileEffect('0,0');
        expect(sys.pendingEffect).toBeNull();
    });

    it('reveals a fresh effect: marks revealed, sets pending, plays sound, spawns particles, draws', () => {
        const game = seededGame();
        const sys = new EffectSystem(game);
        sys.revealTileEffect('0,0');
        expect(game.revealedEffects.has('0,0')).toBe(true);
        expect(game.tileEffects['0,0'].revealed).toBe(true);
        expect(sys.pendingEffect).toMatchObject({ squareKey: '0,0', player: 1 });
        expect(game.soundManager.playEffectRevealSound).toHaveBeenCalledWith('powerup');
        expect(game.particleSystem.createEffectParticles).toHaveBeenCalledOnce();
        expect(game.draw).toHaveBeenCalledOnce();
    });
});
