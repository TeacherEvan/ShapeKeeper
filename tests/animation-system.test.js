import { describe, it, expect } from 'vitest';
import { AnimationSystem } from '../animation-system.js';

// Minimal fakes exercising the real animation array compaction + tracking.
const fakeParseSquareKey = (key) => {
    const [row, col] = key.split('-').map(Number);
    return { row, col };
};
const noop = () => {};

describe('AnimationSystem', () => {
    it('starts empty across every animation collection', () => {
        const a = new AnimationSystem();
        const active = a.getActiveAnimations();
        expect(active.squareAnimations).toEqual([]);
        expect(active.sparkleEmojis).toEqual([]);
        expect(active.lineDrawings).toEqual([]);
        expect(active.invalidLineFlash).toBeNull();
    });

    it('triggerSquareAnimation pushes a square animation and sparkles and calls spawnParticles', () => {
        const a = new AnimationSystem();
        let spawned = 0;
        a.triggerSquareAnimation(
            '2-3',
            fakeParseSquareKey,
            0,
            0,
            40,
            '#f00',
            () => {
                spawned += 1;
            },
            noop
        );
        expect(a.squareAnimations.length).toBe(1);
        expect(a.squareAnimations[0].squareKey).toBe('2-3');
        expect(a.sparkleEmojis.length).toBeGreaterThan(0);
        expect(spawned).toBe(1);
    });

    it('triggerMultiplierAnimation records the multiplier value', () => {
        const a = new AnimationSystem();
        a.triggerMultiplierAnimation('1-1', 3, fakeParseSquareKey, 0, 0, 40, noop);
        expect(a.multiplierAnimations.length).toBe(1);
        expect(a.multiplierAnimations[0].value).toBe(3);
    });

    it('triggerInvalidLineFlash sets then clears after the flash duration elapses', () => {
        const a = new AnimationSystem();
        const now = Date.now();
        a.triggerInvalidLineFlash({ col: 0, row: 0 }, { col: 1, row: 0 }, 0, 0, 40);
        expect(a.invalidLineFlash).not.toBeNull();
        // updateAnimations uses GAME_CONSTANTS.ANIMATION_INVALID_FLASH_DURATION; pass a
        // far-future timestamp so the flash is considered expired.
        a.updateAnimations(now + 100000);
        expect(a.invalidLineFlash).toBeNull();
    });

    it('addPulsatingLine / addLineDrawing / addTouchVisual register entries', () => {
        const a = new AnimationSystem();
        a.addPulsatingLine('L-0-1', 1, false);
        a.addLineDrawing('L-0-1', { col: 0, row: 0 }, { col: 1, row: 0 }, 1, false, 0, 0, 40);
        a.addTouchVisual(10, 10);
        const active = a.getActiveAnimations();
        expect(active.pulsatingLines.length).toBe(1);
        expect(active.lineDrawings.length).toBe(1);
        expect(active.touchVisuals.length).toBe(1);
    });

    it('updateAnimations compacts expired pulsating lines in place', () => {
        const a = new AnimationSystem();
        const future = Date.now() + 100000;
        // push one already-expired pulsating line directly, then run compaction
        a.pulsatingLines.push({ line: 'L-x', player: 1, time: 0, ghost: false });
        a.updateAnimations(future);
        expect(a.pulsatingLines.length).toBe(0);
    });
});
