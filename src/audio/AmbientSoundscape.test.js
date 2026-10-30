import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AmbientSoundscape,
    CHIME_PROFILES,
    PENTATONIC_SCALE,
    pickScaleIndex,
    pickScaleNote,
} from './AmbientSoundscape.js';

describe('pickScaleNote', () => {
    it('returns scale[0] when width is non-positive', () => {
        expect(pickScaleNote(100, 0)).toBe(PENTATONIC_SCALE[0]);
        expect(pickScaleNote(100, -50)).toBe(PENTATONIC_SCALE[0]);
    });

    it('returns 440 when scale is empty or invalid', () => {
        expect(pickScaleNote(50, 100, [])).toBe(440);
        expect(pickScaleNote(50, 100, null)).toBe(440);
    });

    it('maps horizontal positions proportionally across the scale', () => {
        const width = 1000;
        // x = 0 -> first note (A3 = 220)
        expect(pickScaleNote(0, width)).toBe(PENTATONIC_SCALE[0]);
        // x = 999 -> highest note (F#5 = 739.99)
        expect(pickScaleNote(999, width)).toBe(PENTATONIC_SCALE[PENTATONIC_SCALE.length - 1]);
        // x = 500 -> middle note (A4 = 440)
        expect(pickScaleNote(500, width)).toBe(PENTATONIC_SCALE[5]);
    });

    it('clamps values below 0 and above width', () => {
        expect(pickScaleNote(-100, 1000)).toBe(PENTATONIC_SCALE[0]);
        expect(pickScaleNote(2000, 1000)).toBe(PENTATONIC_SCALE[PENTATONIC_SCALE.length - 1]);
    });
});

describe('pickScaleIndex', () => {
    it('matches the zone pickScaleNote resolves to', () => {
        for (const x of [0, 99, 100, 450, 999, 5000, -5]) {
            expect(PENTATONIC_SCALE[pickScaleIndex(x, 1000)]).toBe(pickScaleNote(x, 1000));
        }
        expect(pickScaleIndex(10, 0)).toBe(0);
    });
});

describe('AmbientSoundscape', () => {
    let mockContext;

    beforeEach(() => {
        vi.useFakeTimers();

        const createMockParam = (initialVal = 0) => ({
            value: initialVal,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            setTargetAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
        });

        const createMockNode = () => ({
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            frequency: createMockParam(440),
            detune: createMockParam(0),
            gain: createMockParam(0.0001),
            Q: createMockParam(1),
        });

        mockContext = {
            state: 'running',
            currentTime: 0,
            destination: {},
            createGain: vi.fn(() => createMockNode()),
            createOscillator: vi.fn(() => createMockNode()),
            createBiquadFilter: vi.fn(() => createMockNode()),
            resume: vi.fn().mockResolvedValue(undefined),
            suspend: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
        };

        window.AudioContext = vi.fn(function () {
            return mockContext;
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not create an AudioContext on initial construction', () => {
        const soundscape = new AmbientSoundscape();
        expect(soundscape.ctx).toBeNull();
        expect(window.AudioContext).not.toHaveBeenCalled();
    });

    it('creates AudioContext and builds drone on first ensureAudioContext call', () => {
        const soundscape = new AmbientSoundscape();
        const ctx = soundscape.ensureAudioContext();

        expect(ctx).toBe(mockContext);
        expect(soundscape.masterGain).not.toBeNull();
        expect(soundscape.droneGain).not.toBeNull();
        expect(soundscape.filter).not.toBeNull();
        expect(soundscape.oscillators.length).toBe(4);
        expect(soundscape.lfo).not.toBeNull();
    });

    it('fadeIn ramps master gain towards maxMasterVolume', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.fadeIn(2.0);

        expect(soundscape.isActive).toBe(true);
        expect(soundscape.masterGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            soundscape.maxMasterVolume,
            2.0
        );
    });

    it('fadeOut ramps master gain down and suspends after duration', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.fadeIn(1.0);
        soundscape.fadeOut(1.5);

        expect(soundscape.isActive).toBe(false);
        expect(soundscape.masterGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            0.0001,
            soundscape.ctx.currentTime + 1.5
        );

        vi.advanceTimersByTime(1600);
        expect(mockContext.suspend).toHaveBeenCalled();
    });

    it('modulateWithPointer modulates lowpass filter frequency', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.ensureAudioContext();

        // Higher on screen (y = 50 of 600) -> brighter filter (~690Hz)
        soundscape.modulateWithPointer(300, 50, 2);
        expect(soundscape.filter.frequency.setTargetAtTime).toHaveBeenCalled();
    });

    it('handleInteraction triggers chime on grab/fling and resets idle timer', () => {
        const soundscape = new AmbientSoundscape();
        const playChimeSpy = vi.spyOn(soundscape, 'playInteractionChime');

        soundscape.handleInteraction({ type: 'grab', x: 250, y: 150, speed: 2 });
        expect(soundscape.isActive).toBe(true);
        expect(playChimeSpy).toHaveBeenCalledWith(250, 150, 2, 'grab');

        // 6-second idle timer should trigger fadeOut
        const fadeOutSpy = vi.spyOn(soundscape, 'fadeOut');
        vi.advanceTimersByTime(6050);
        expect(fadeOutSpy).toHaveBeenCalledWith(1.5);
    });

    it('destroy cleanly closes context and stops oscillators', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.ensureAudioContext();

        soundscape.destroy();
        expect(soundscape.ctx).toBeNull();
        expect(soundscape.isActive).toBe(false);
        expect(mockContext.close).toHaveBeenCalled();
    });
    it('routes chimes through their own bus so the drone fade cannot mute them', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.ensureAudioContext();
        expect(soundscape.chimeBus).not.toBeNull();

        soundscape.playInteractionChime(300, 200, 2, 'grab');
        // The chime voice gain feeds the chime bus, never the faded master.
        const voiceGain = mockContext.createGain.mock.results.find((r) =>
            r.value.connect.mock.calls.some(([n]) => n === soundscape.chimeBus)
        ).value;
        expect(voiceGain.connect).toHaveBeenCalledWith(soundscape.chimeBus);
        expect(voiceGain.connect).not.toHaveBeenCalledWith(soundscape.masterGain);
    });

    it('opens every chime with a short attack ramp (no onset click)', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.ensureAudioContext();
        soundscape.playInteractionChime(300, 200, 2, 'ripple');
        const voiceGain = mockContext.createGain.mock.results.find((r) =>
            r.value.connect.mock.calls.some(([n]) => n === soundscape.chimeBus)
        ).value;
        const [, firstRampTime] = voiceGain.gain.exponentialRampToValueAtTime.mock.calls[0];
        expect(voiceGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0);
        expect(firstRampTime).toBeGreaterThan(0);
        expect(firstRampTime).toBeLessThan(0.02);
    });

    it('pans chimes with the touch when a stereo panner exists', () => {
        const pan = { setValueAtTime: vi.fn() };
        const panner = { pan, connect: vi.fn() };
        mockContext.createStereoPanner = vi.fn(() => panner);
        const soundscape = new AmbientSoundscape();
        soundscape.ensureAudioContext();
        soundscape.playInteractionChime(0, 0, 1, 'grab');
        expect(pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(-0.7, 5);
        expect(panner.connect).toHaveBeenCalledWith(soundscape.chimeBus);
    });

    it('strums one soft note per new note zone while dragging', () => {
        window.innerWidth = 1000;
        const soundscape = new AmbientSoundscape();
        const chime = vi.spyOn(soundscape, 'playInteractionChime');
        const now = vi.spyOn(performance, 'now');

        now.mockReturnValue(1000);
        soundscape.handleInteraction({ type: 'drag', x: 50, y: 10, speed: 3 });
        now.mockReturnValue(1010);
        soundscape.handleInteraction({ type: 'drag', x: 60, y: 10, speed: 3 }); // same zone
        now.mockReturnValue(1020);
        soundscape.handleInteraction({ type: 'drag', x: 250, y: 10, speed: 3 }); // too soon
        now.mockReturnValue(1200);
        soundscape.handleInteraction({ type: 'drag', x: 250, y: 10, speed: 3 });

        expect(chime).toHaveBeenCalledTimes(2);
        expect(chime.mock.calls.every(([, , , type]) => type === 'sparkle')).toBe(true);
        expect(CHIME_PROFILES.sparkle.gain).toBeLessThan(CHIME_PROFILES.grab.gain);
    });

    it('does not suspend while a chime is still ringing, then suspends', () => {
        const soundscape = new AmbientSoundscape();
        soundscape.fadeIn(1);
        soundscape.activeChimes = 1;
        soundscape.fadeOut(0.1);
        vi.advanceTimersByTime(300);
        expect(mockContext.suspend).not.toHaveBeenCalled();

        soundscape.activeChimes = 0;
        vi.advanceTimersByTime(600);
        expect(mockContext.suspend).toHaveBeenCalled();
    });

    it('stays silent after the game mutes sound', () => {
        const soundscape = new AmbientSoundscape();
        window.dispatchEvent(
            new CustomEvent('shapekeeper:soundToggled', { detail: { enabled: false } })
        );
        const chime = vi.spyOn(soundscape, 'playInteractionChime');
        soundscape.handleInteraction({ type: 'grab', x: 10, y: 10, speed: 2 });
        expect(chime).not.toHaveBeenCalled();
        expect(soundscape.isActive).toBe(false);

        window.dispatchEvent(
            new CustomEvent('shapekeeper:soundToggled', { detail: { enabled: true } })
        );
        soundscape.handleInteraction({ type: 'grab', x: 10, y: 10, speed: 2 });
        expect(chime).toHaveBeenCalledTimes(1);
        soundscape.destroy();
    });
    it('handles singularity and supernova interaction types with harmonic chimes', () => {
        const soundscape = new AmbientSoundscape();
        const chimeSpy = vi.spyOn(soundscape, 'playInteractionChime');

        soundscape.handleInteraction({ type: 'singularity_start', x: 200, y: 150 });
        soundscape.handleInteraction({ type: 'supernova', x: 200, y: 150, speed: 4 });

        expect(chimeSpy).toHaveBeenCalledWith(200, 150, 4, 'supernova');
        expect(CHIME_PROFILES.supernova.gain).toBeGreaterThan(1);
    });
});
