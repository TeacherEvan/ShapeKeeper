import { describe, expect, it, vi } from 'vitest';

import { AnimationSystem } from './animation-system.js';

function makeSystem() {
    return new AnimationSystem();
}

describe('AnimationSystem — lifecycle / compaction', () => {
    it('starts with empty animation buckets', () => {
        const s = makeSystem();
        const active = s.getActiveAnimations();
        expect(active.squareAnimations).toEqual([]);
        expect(active.pulsatingLines).toEqual([]);
        expect(active.invalidLineFlash).toBeNull();
    });

    it('clears expired pulsating lines but keeps fresh ones', () => {
        const s = makeSystem();
        const now = 10_000;
        s.pulsatingLines = [
            { line: 'a', time: now - 5000 }, // expired (duration 2000)
            { line: 'b', time: now - 100 }, // fresh
        ];
        s.updateAnimations(now);
        expect(s.pulsatingLines.map((p) => p.line)).toEqual(['b']);
    });

    it('nulls invalidLineFlash once its duration has elapsed', () => {
        const s = makeSystem();
        s.triggerInvalidLineFlash({ row: 0, col: 0 }, { row: 0, col: 1 });
        expect(s.invalidLineFlash).not.toBeNull();
        // ANIMATION_INVALID_FLASH_DURATION is 300ms
        s.updateAnimations(Date.now() + 1000);
        expect(s.invalidLineFlash).toBeNull();
    });

    it('compacts square animations whose duration has elapsed', () => {
        const s = makeSystem();
        const now = 20_000;
        s.squareAnimations = [
            { squareKey: '0,0', startTime: now - 1000, duration: 600 }, // expired
            { squareKey: '1,1', startTime: now - 100, duration: 600 }, // fresh
        ];
        s.updateAnimations(now);
        expect(s.squareAnimations.map((a) => a.squareKey)).toEqual(['1,1']);
    });
});

describe('AnimationSystem — triggers', () => {
    const parseSquareKey = (key) => {
        const [row, col] = key.split(',').map(Number);
        return { row, col };
    };

    it('triggerSquareAnimation pushes a square animation and calls spawnParticles', () => {
        const s = makeSystem();
        const spawnParticles = vi.fn();
        s.triggerSquareAnimation(
            '2,3',
            parseSquareKey,
            0,
            0,
            10,
            '#FF0000',
            spawnParticles,
            () => {}
        );
        expect(s.squareAnimations.length).toBe(1);
        expect(s.squareAnimations[0].squareKey).toBe('2,3');
        expect(spawnParticles).toHaveBeenCalledOnce();
    });

    it('triggerMultiplierAnimation pushes a multiplier animation', () => {
        const s = makeSystem();
        const createMultiplierParticles = vi.fn();
        s.triggerMultiplierAnimation('1,1', 5, parseSquareKey, 0, 0, 10, createMultiplierParticles);
        expect(s.multiplierAnimations.length).toBe(1);
        expect(s.multiplierAnimations[0]).toMatchObject({ squareKey: '1,1', value: 5 });
        expect(createMultiplierParticles).toHaveBeenCalledOnce();
    });

    it('addTouchVisual / addLineDrawing / addPulsatingLine append entries', () => {
        const s = makeSystem();
        s.addTouchVisual(5, 5);
        s.addLineDrawing('0,0-0,1', { row: 0, col: 0 }, { row: 0, col: 1 }, 1, false, 0, 0, 10);
        s.addPulsatingLine('0,0-0,1', 1, false);
        expect(s.touchVisuals.length).toBe(1);
        expect(s.lineDrawings.length).toBe(1);
        expect(s.pulsatingLines.length).toBe(1);
    });

    it('triggerEffectAnimation appends to effectAnimations', () => {
        const s = makeSystem();
        s.triggerEffectAnimation('landmine', 1, 1500);
        expect(s.effectAnimations[0]).toMatchObject({
            type: 'landmine',
            player: 1,
            duration: 1500,
        });
    });
});
