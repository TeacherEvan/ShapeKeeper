/**
 * AmbientSoundscape - Generative soothing, relaxing, and hypnotic audio
 *
 * Implements an ambient soundscape using Web Audio API:
 * - Hypnotic drone pad with detuned oscillators and warm resonant filtering
 * - Pentatonic chime tones on sprite grab, fling, and touch
 * - Breathing LFO and pointer modulation
 * - Automatic smooth fade-out on idle or screen exit
 *
 * @module audio/AmbientSoundscape
 */

export const PENTATONIC_SCALE = [
    220.0, // A3
    246.94, // B3
    277.18, // C#4
    329.63, // E4
    369.99, // F#4
    440.0, // A4
    493.88, // B4
    554.37, // C#5
    659.25, // E5
    739.99, // F#5
];

/** Index of the scale zone under screen position `x` (0 when unmeasurable). */
export function pickScaleIndex(x, width, scale = PENTATONIC_SCALE) {
    if (!Array.isArray(scale) || scale.length === 0) return 0;
    if (!width || width <= 0) return 0;

    const ratio = Math.max(0, Math.min(1, x / width));
    return Math.min(scale.length - 1, Math.floor(ratio * scale.length));
}

export function pickScaleNote(x, width, scale = PENTATONIC_SCALE) {
    if (!Array.isArray(scale) || scale.length === 0) return 440;
    return scale[pickScaleIndex(x, width, scale)];
}

/**
 * Voice shape per interaction. Real bells ring long in the fundamental and
 * lose their upper partials fast, so each profile pairs a long body with a
 * shorter overtone. `sparkle` is the quiet harp note played while dragging
 * across note zones.
 */
export const CHIME_PROFILES = {
    grab: { octave: 1, duration: 1.4, jitter: 0.3, gain: 0.9, overtone: 0.5, echo: 0.25 },
    fling: { octave: 1, duration: 2.2, jitter: 0.8, gain: 1, overtone: 0.5, echo: 0.3 },
    ripple: { octave: 0.5, duration: 2.6, jitter: 0.6, gain: 1, overtone: 0.6, echo: 0.3 },
    firework: { octave: 2, duration: 2.0, jitter: 0.6, gain: 0.8, overtone: 0.4, echo: 0.3 },
    sparkle: { octave: 1, duration: 0.7, jitter: 0.2, gain: 0.45, overtone: 0.3, echo: 0.12 },
    touch: { octave: 1, duration: 2.2, jitter: 0.8, gain: 1, overtone: 0.5, echo: 0.25 },
};

/** Chimes go through their own bus; the drone fade must never mute them. */
const CHIME_BUS_LEVEL = 0.6;
/** Minimum gap between glissando notes, so a fast drag ripples, not buzzes. */
const GLISSANDO_GAP_MS = 80;
/** Ring-out allowance before an idle fade is allowed to suspend the context. */
const SUSPEND_RETRY_MS = 500;

export class AmbientSoundscape {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.droneGain = null;
        this.filter = null;
        this.oscillators = [];
        this.lfo = null;
        this.isActive = false;
        this.idleTimeout = null;
        this.maxMasterVolume = 0.22;
        this.activeChimes = 0;
        this.maxChimes = 8;
        this.chimeBus = null;
        this.delayNode = null;
        this.enabled = true;
        this.lastGlissandoIndex = -1;
        this.lastGlissandoTime = 0;
        this.attachGlobalListeners();
    }

    /** Hide the tab or mute sound from the game and the soundscape goes quiet. */
    attachGlobalListeners() {
        if (typeof document !== 'undefined') {
            this.onVisibilityChange = () => {
                if (document.hidden) this.fadeOut(0.3);
            };
            document.addEventListener('visibilitychange', this.onVisibilityChange);
        }
        if (typeof window !== 'undefined') {
            this.onSoundToggled = (e) => {
                this.enabled = e?.detail?.enabled !== false;
                if (!this.enabled) this.fadeOut(0.3);
            };
            window.addEventListener('shapekeeper:soundToggled', this.onSoundToggled);
        }
    }

    ensureAudioContext() {
        if (!this.ctx || this.ctx.state === 'closed') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;

            try {
                this.ctx = new AudioCtx();
                this.setupDrone();
            } catch (e) {
                console.warn('[AmbientSoundscape] AudioContext failed:', e);
                return null;
            }
        }

        // 'interrupted' is iOS Safari after a call/alarm; resume it like 'suspended'.
        if (this.ctx && this.ctx.state !== 'running' && typeof this.ctx.resume === 'function') {
            this.ctx.resume().catch(() => {});
        }

        return this.ctx;
    }

    setupDrone() {
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.0001, now);
        this.masterGain.connect(this.ctx.destination);

        // Chime bus: bypasses the drone's fade (a chime on the first touch used
        // to play through a master gain still ramping up from silence), and an
        // optional compressor keeps stacked voices from clipping.
        this.chimeBus = this.ctx.createGain();
        this.chimeBus.gain.setValueAtTime(CHIME_BUS_LEVEL, now);
        if (typeof this.ctx.createDynamicsCompressor === 'function') {
            const limiter = this.ctx.createDynamicsCompressor();
            this.chimeBus.connect(limiter);
            limiter.connect(this.ctx.destination);
        } else {
            this.chimeBus.connect(this.ctx.destination);
        }

        // Lowpass filter for warm, dreamy sound
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(450, now);
        this.filter.Q.setValueAtTime(2.5, now);

        // Drone gain
        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.setValueAtTime(0.35, now);

        this.filter.connect(this.droneGain);
        this.droneGain.connect(this.masterGain);

        // Optional stereo delay shimmer bus
        this.delayNode = null;
        if (typeof this.ctx.createDelay === 'function') {
            try {
                this.delayNode = this.ctx.createDelay();
                this.delayNode.delayTime.setValueAtTime(0.36, now);
                const delayFeedback = this.ctx.createGain();
                delayFeedback.gain.setValueAtTime(0.3, now);
                const delayFilter = this.ctx.createBiquadFilter();
                delayFilter.type = 'lowpass';
                delayFilter.frequency.setValueAtTime(1600, now);

                this.delayNode.connect(delayFilter);
                delayFilter.connect(delayFeedback);
                delayFeedback.connect(this.delayNode);
                delayFilter.connect(this.chimeBus);
            } catch (_e) {
                // Ignore delay setup if unsupported
            }
        }

        // Breathing LFO (~0.07Hz)
        this.lfo = this.ctx.createOscillator();
        this.lfo.frequency.setValueAtTime(0.07, now);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(120, now); // Modulates filter +/- 120Hz
        this.lfo.connect(lfoGain);
        lfoGain.connect(this.filter.frequency);
        this.lfo.start();

        // 4 detuned soothing drone oscillators (A2, E3, A3, B3 -> lush Amaj9 pad)
        const droneFreqs = [110.0, 164.81, 220.0, 246.94];
        const detunes = [-4, 3, 5, -2];

        this.oscillators = droneFreqs.map((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = i === 1 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.detune.setValueAtTime(detunes[i], now);
            osc.connect(this.filter);
            osc.start();
            return osc;
        });
    }

    fadeIn(durationSec = 1.5) {
        if (!this.ensureAudioContext() || !this.masterGain) return;

        this.isActive = true;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
        this.masterGain.gain.exponentialRampToValueAtTime(this.maxMasterVolume, now + durationSec);
    }

    fadeOut(durationSec = 1.5) {
        if (!this.ctx || !this.masterGain) return;

        this.isActive = false;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        setTimeout(() => this.suspendWhenQuiet(), durationSec * 1000 + 50);
    }

    /** Suspend an idle context, but never cut a chime that is still ringing. */
    suspendWhenQuiet() {
        if (this.isActive || !this.ctx || this.ctx.state !== 'running') return;
        if (this.activeChimes > 0) {
            setTimeout(() => this.suspendWhenQuiet(), SUSPEND_RETRY_MS);
            return;
        }
        this.ctx
            .suspend()
            .then(() => {
                // A touch landed while suspend() was in flight: wake back up.
                if (this.isActive && this.ctx && this.ctx.state !== 'running') {
                    this.ctx.resume().catch(() => {});
                }
            })
            .catch(() => {});
    }

    /**
     * Where a voice plugs in: through a stereo panner that follows the touch
     * (low notes left, high notes right, matching the pitch map) when the
     * browser has one, otherwise straight onto the chime bus.
     */
    voiceOutput(x, width, now) {
        if (typeof this.ctx.createStereoPanner !== 'function') return this.chimeBus;
        try {
            const panner = this.ctx.createStereoPanner();
            const ratio = width > 0 ? Math.max(0, Math.min(1, x / width)) : 0.5;
            panner.pan.setValueAtTime((ratio * 2 - 1) * 0.7, now);
            panner.connect(this.chimeBus);
            return panner;
        } catch (_e) {
            return this.chimeBus;
        }
    }

    playInteractionChime(x, y, speed = 1, type = 'touch') {
        if (!this.ensureAudioContext() || !this.masterGain || !this.chimeBus) return;
        if (!this.enabled || this.activeChimes >= this.maxChimes) return;

        const profile = CHIME_PROFILES[type] || CHIME_PROFILES.touch;
        const width = typeof window !== 'undefined' ? window.innerWidth : 800;
        const noteFreq = pickScaleNote(x, width) * profile.octave;

        const now = this.ctx.currentTime;
        const chimeGain = this.ctx.createGain();
        const overtoneGain = this.ctx.createGain();
        const osc = this.ctx.createOscillator();
        const overtone = this.ctx.createOscillator();

        // Sine primary + a brighter partial that dies first, like a struck bell.
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);
        // A few cents of random detune so repeated notes never sound sampled.
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(noteFreq * 2, now);

        // Volume scales gently with speed
        const volume = Math.min(0.28, 0.12 + Math.min(speed, 5) * 0.03) * profile.gain;
        const duration = profile.duration + Math.random() * profile.jitter;

        // 8 ms attack: starting at full volume on a sine is an audible click.
        chimeGain.gain.setValueAtTime(0.0001, now);
        chimeGain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        overtoneGain.gain.setValueAtTime(profile.overtone, now);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.45);

        osc.connect(chimeGain);
        overtone.connect(overtoneGain);
        overtoneGain.connect(chimeGain);
        const output = this.voiceOutput(x, width, now);
        chimeGain.connect(output);

        if (this.delayNode && profile.echo > 0) {
            try {
                const delaySend = this.ctx.createGain();
                delaySend.gain.setValueAtTime(profile.echo, now);
                chimeGain.connect(delaySend);
                delaySend.connect(this.delayNode);
            } catch (_e) {
                // Ignore delay send failure
            }
        }

        this.activeChimes++;
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            this.activeChimes = Math.max(0, this.activeChimes - 1);
        };
        // The audio clock is authoritative; the timer is only a safety net.
        osc.onended = release;
        setTimeout(release, (duration + 0.5) * 1000);

        osc.start(now);
        overtone.start(now);
        osc.stop(now + duration);
        overtone.stop(now + duration);

        // On fast fling, add an ascending harmonic shimmer note
        if (type === 'fling' && speed > 2.5 && this.activeChimes < this.maxChimes) {
            const arpTime = now + 0.08;
            const arpOsc = this.ctx.createOscillator();
            const arpGain = this.ctx.createGain();
            arpOsc.type = 'sine';
            arpOsc.frequency.setValueAtTime(noteFreq * 1.5, arpTime);
            arpGain.gain.setValueAtTime(0.0001, arpTime);
            arpGain.gain.exponentialRampToValueAtTime(volume * 0.7, arpTime + 0.008);
            arpGain.gain.exponentialRampToValueAtTime(0.0001, arpTime + 1.8);
            arpOsc.connect(arpGain);
            arpGain.connect(output);
            arpOsc.start(arpTime);
            arpOsc.stop(arpTime + 1.8);
        }
    }

    /**
     * Dragging a sprite (or swirling the field) strums the pentatonic scale:
     * one soft note each time the pointer crosses into a new note zone.
     */
    playGlissandoNote(x, y, speed, type) {
        const width = typeof window !== 'undefined' ? window.innerWidth : 800;
        const index = pickScaleIndex(x, width);
        if (index === this.lastGlissandoIndex) return;

        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (nowMs - this.lastGlissandoTime < GLISSANDO_GAP_MS) return;

        this.lastGlissandoIndex = index;
        this.lastGlissandoTime = nowMs;
        this.playInteractionChime(x, y, type === 'swirl' ? speed * 0.5 : speed, 'sparkle');
    }

    modulateWithPointer(x, y, speed = 0) {
        if (!this.ctx || !this.filter) return;

        const height = typeof window !== 'undefined' ? window.innerHeight : 600;
        // Higher on screen (smaller y) = brighter sound (~750Hz), lower = warmer (~380Hz)
        const yRatio = 1 - Math.max(0, Math.min(1, y / height));
        const targetFreq = 380 + yRatio * 370;

        const now = this.ctx.currentTime;
        this.filter.frequency.setTargetAtTime(targetFreq, now, 0.12);

        // Subtly modulate drone volume with movement
        if (this.droneGain) {
            const targetDroneVol = 0.32 + Math.min(speed, 4) * 0.05;
            this.droneGain.gain.setTargetAtTime(targetDroneVol, now, 0.1);
        }
    }

    handleInteraction(event = {}) {
        const { type = 'touch', x = 200, y = 200, speed = 1 } = event;
        if (!this.enabled) return;

        if (!this.isActive) {
            this.fadeIn(1.5);
        }

        // Reset 6-second idle timer
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
        }
        this.idleTimeout = setTimeout(() => {
            this.fadeOut(1.5);
        }, 6000);

        this.modulateWithPointer(x, y, speed);

        if (
            type === 'grab' ||
            type === 'fling' ||
            type === 'ripple' ||
            type === 'tap' ||
            type === 'firework'
        ) {
            if (type === 'grab' || type === 'touch') {
                // The grab chime already voices this zone; strum from the next.
                const width = typeof window !== 'undefined' ? window.innerWidth : 800;
                this.lastGlissandoIndex = pickScaleIndex(x, width);
            }
            this.playInteractionChime(x, y, speed, type);
        } else if (type === 'drag' || type === 'swirl') {
            this.playGlissandoNote(x, y, speed, type);
        }
    }

    destroy() {
        if (typeof document !== 'undefined' && this.onVisibilityChange) {
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
        }
        if (typeof window !== 'undefined' && this.onSoundToggled) {
            window.removeEventListener('shapekeeper:soundToggled', this.onSoundToggled);
        }
        this.activeChimes = 0;
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }
        if (this.lfo) {
            try {
                this.lfo.stop();
            } catch (_e) {
                // Ignore errors if already stopped
            }
        }
        for (const osc of this.oscillators) {
            try {
                osc.stop();
            } catch (_e) {
                // Ignore errors if already stopped
            }
        }
        if (this.ctx && this.ctx.state !== 'closed' && typeof this.ctx.close === 'function') {
            this.ctx.close().catch(() => {});
        }
        this.ctx = null;
        this.isActive = false;
    }
}
