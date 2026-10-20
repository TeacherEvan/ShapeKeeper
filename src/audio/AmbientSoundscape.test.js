import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientSoundscape, PENTATONIC_SCALE, pickScaleNote } from './AmbientSoundscape.js';

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
});
