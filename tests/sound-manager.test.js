import { describe, it, expect, beforeEach } from 'vitest';
import { SoundManager } from '../sound-manager.js';

// jsdom does not ship a real Web Audio API. Provide a minimal but functional
// fake so the SoundManager actually exercises node creation (oscillator/gain)
// instead of silently early-returning on a null ctx.
function installFakeAudioContext() {
    const created = { oscillators: 0, gains: 0 };
    class FakeParam {
        setValueAtTime() {}
        exponentialRampToValueAtTime() {}
        linearRampToValueAtTime() {}
    }
    class FakeAudioContext {
        constructor() {
            this.currentTime = 0;
            this.sampleRate = 44100;
            this.destination = {};
        }
        createOscillator() {
            created.oscillators += 1;
            return {
                type: '',
                frequency: new FakeParam(),
                connect() {
                    return this;
                },
                start() {},
                stop() {},
            };
        }
        createGain() {
            created.gains += 1;
            return {
                gain: new FakeParam(),
                connect() {
                    return this;
                },
            };
        }
        createBuffer() {
            return { getChannelData: () => new Float32Array(16) };
        }
        createBufferSource() {
            return {
                buffer: null,
                connect() {
                    return this;
                },
                start() {},
            };
        }
    }
    window.AudioContext = FakeAudioContext;
    return created;
}

describe('SoundManager', () => {
    let created;
    beforeEach(() => {
        created = installFakeAudioContext();
    });

    it('initializes an audio context when Web Audio is available', () => {
        const sm = new SoundManager();
        expect(sm.initialized).toBe(true);
        expect(sm.ctx).toBeTruthy();
        expect(sm.enabled).toBe(true);
    });

    it('stays uninitialized (no throw) when Web Audio is unavailable', () => {
        delete window.AudioContext;
        delete window.webkitAudioContext;
        const sm = new SoundManager();
        expect(sm.initialized).toBe(false);
        expect(sm.ctx).toBeNull();
    });

    it('creates oscillator/gain nodes for each gameplay sound without throwing', () => {
        const sm = new SoundManager();
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
        // line + square(3) + invalid + combo(3) + victory(4) + reveal-trap(1)
        // + reveal-powerup(4) + landmine(1) + freeze(1) = 21 oscillators
        expect(created.oscillators).toBeGreaterThan(0);
        expect(created.gains).toBeGreaterThan(0);
    });

    it('does not create audio nodes when sound is disabled', () => {
        const sm = new SoundManager();
        sm.enabled = false;
        const before = created.oscillators;
        sm.playLineSound();
        expect(created.oscillators).toBe(before); // no nodes created while muted
    });

    it('toggleSound flips enabled and updates the #soundToggle label', () => {
        const toggle = document.createElement('button');
        toggle.id = 'soundToggle';
        document.body.appendChild(toggle);
        const sm = new SoundManager();
        expect(sm.enabled).toBe(true);
        sm.toggleSound();
        expect(sm.enabled).toBe(false);
        expect(toggle.textContent).toBe('🔇');
        expect(toggle.classList.contains('muted')).toBe(true);
        sm.toggleSound();
        expect(sm.enabled).toBe(true);
        expect(toggle.textContent).toBe('🔊');
        toggle.remove();
    });
});
