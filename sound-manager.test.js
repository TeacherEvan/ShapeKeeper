import { describe, expect, it, beforeEach, vi } from 'vitest';

import { SoundManager } from './sound-manager.js';

describe('SoundManager', () => {
    let sm;

    beforeEach(() => {
        // No AudioContext in jsdom → ctx stays null, all play* are no-ops
        sm = new SoundManager();
    });

    it('constructs without an audio context in a non-Web-Audio env', () => {
        expect(sm.ctx).toBeNull();
        expect(sm.initialized).toBe(false);
        expect(sm.enabled).toBe(true);
    });

    it('toggles enabled state (no #soundToggle element is safe)', () => {
        expect(sm.enabled).toBe(true);
        sm.toggleSound();
        expect(sm.enabled).toBe(false);
        sm.toggleSound();
        expect(sm.enabled).toBe(true);
    });

    it('does not throw when playing sounds without a context', () => {
        expect(() => {
            sm.playLineSound();
            sm.playSquareSound(2);
            sm.playInvalidSound();
            sm.playComboSound(3);
            sm.playVictorySound();
            sm.playEffectRevealSound('trap');
            sm.playEffectRevealSound('powerup');
            sm.playEffectActivationSound('landmine', 'landmine');
            sm.playEffectActivationSound('freeze', 'freeze');
        }).not.toThrow();
    });

    it('respects the enabled flag when a context is present', () => {
        const fakeOsc = {
            type: '',
            frequency: {
                setValueAtTime() {},
                exponentialRampToValueAtTime() {},
                linearRampToValueAtTime() {},
            },
            connect: vi.fn(() => fakeOsc),
            start() {},
            stop() {},
        };
        const fakeGain = {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect: vi.fn(() => fakeOsc),
        };
        sm.ctx = {
            currentTime: 0,
            createOscillator: () => fakeOsc,
            createGain: () => fakeGain,
            destination: {},
        };
        sm.enabled = false;
        const startSpy = vi.spyOn(fakeOsc, 'start');
        sm.playLineSound();
        expect(startSpy).not.toHaveBeenCalled();
    });
});
