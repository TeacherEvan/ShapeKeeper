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

export function pickScaleNote(x, width, scale = PENTATONIC_SCALE) {
    if (!Array.isArray(scale) || scale.length === 0) return 440;
    if (!width || width <= 0) return scale[0];

    const ratio = Math.max(0, Math.min(1, x / width));
    const index = Math.min(scale.length - 1, Math.floor(ratio * scale.length));
    return scale[index];
}

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

        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
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

        // Breathing LFO (~0.07Hz)
        this.lfo = this.ctx.createOscillator();
        this.lfo.frequency.setValueAtTime(0.07, now);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(120, now); // Modulates filter +/- 120Hz
        this.lfo.connect(lfoGain);
        lfoGain.connect(this.filter.frequency);
        this.lfo.start();

        // 3 detuned soothing drone oscillators (A2, E3, A3)
        const droneFreqs = [110.0, 164.81, 220.0];
        const detunes = [-4, 3, 5];

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

        setTimeout(
            () => {
                if (!this.isActive && this.ctx && this.ctx.state === 'running') {
                    this.ctx.suspend().catch(() => {});
                }
            },
            durationSec * 1000 + 50
        );
    }

    playInteractionChime(x, y, speed = 1) {
        if (!this.ensureAudioContext() || !this.masterGain) return;
        if (this.activeChimes >= this.maxChimes) return;

        const width = typeof window !== 'undefined' ? window.innerWidth : 800;
        const noteFreq = pickScaleNote(x, width);

        const now = this.ctx.currentTime;
        const chimeGain = this.ctx.createGain();
        const osc = this.ctx.createOscillator();
        const overtone = this.ctx.createOscillator();

        // Sine primary + subtle harmonic
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(noteFreq * 2, now);

        // Volume scales gently with speed
        const volume = Math.min(0.28, 0.12 + Math.min(speed, 5) * 0.03);
        const duration = 2.2 + Math.random() * 0.8; // 2.2s - 3s soothing decay

        chimeGain.gain.setValueAtTime(volume, now);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(chimeGain);
        overtone.connect(chimeGain);
        chimeGain.connect(this.masterGain);

        this.activeChimes++;
        osc.start(now);
        overtone.start(now);
        osc.stop(now + duration);
        overtone.stop(now + duration);

        setTimeout(() => {
            this.activeChimes = Math.max(0, this.activeChimes - 1);
        }, duration * 1000);
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

        if (type === 'grab' || type === 'fling' || type === 'ripple' || type === 'tap') {
            this.playInteractionChime(x, y, speed);
        }
    }

    destroy() {
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
