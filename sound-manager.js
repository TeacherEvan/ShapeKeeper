/**
 * ShapeKeeper - Sound Manager
 * Web Audio API sound generation and management
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { GAME_CONSTANTS } from './constants.js';

export class SoundManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.enabled = true;
        this._landmineBuffer = null;
    }

    /**
     * Initialize Web Audio API context (lazy, on first user gesture)
     */
    initializeAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                this._landmineBuffer = null;
                this.initialized = true;
            }
        } catch {
            console.log('[Sound] Web Audio API not available');
        }
    }

    /**
     * Ensure audio context is initialized (call from user gesture)
     */
    ensureAudioContext() {
        if (!this.ctx || this.ctx.state === 'closed') {
            this.initializeAudioContext();
        }
        if (this.ctx && this.ctx.state !== 'running' && typeof this.ctx.resume === 'function') {
            this.ctx.resume().catch(() => {});
        }
    }

    /**
     * Guarded audio runner: never lets WebAudio errors abort gameplay moves.
     */
    runAudio(fn) {
        if (!this.enabled || !this.ctx || this.ctx.state === 'closed') return;
        try {
            fn(this.ctx);
        } catch {
            // Audio context error or unavailable
        }
    }

    /**
     * Clean up AudioContext hardware resources
     */
    destroy() {
        if (this.ctx && this.ctx.state !== 'closed' && typeof this.ctx.close === 'function') {
            this.ctx.close().catch(() => {});
        }
        this.ctx = null;
        this._landmineBuffer = null;
        this.initialized = false;
    }

    /**
     * Play line draw sound (rising tone)
     */
    playLineSound() {
        this.runAudio((ctx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(GAME_CONSTANTS.SOUND_LINE_BASE, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(
                GAME_CONSTANTS.SOUND_LINE_BASE * 2,
                ctx.currentTime + 0.1
            );

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        });
    }

    /**
     * Play square completion sound (chord)
     */
    playSquareSound(comboCount = 1) {
        this.runAudio((ctx) => {
            const baseFreq = GAME_CONSTANTS.SOUND_SQUARE_BASE * (1 + comboCount * 0.1);

            // Play a chord (root + major third + fifth)
            [1, 1.26, 1.5].forEach((mult, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(baseFreq * mult, ctx.currentTime);

                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.05);
                osc.stop(ctx.currentTime + 0.35);
            });
        });
    }

    /**
     * Play invalid move sound (dissonant buzz)
     */
    playInvalidSound() {
        this.runAudio((ctx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        });
    }

    /**
     * Play penalty 0.2x box sound (falling cartoon "wah-wah" tone)
     */
    playPenaltySound() {
        this.runAudio((ctx) => {
            const now = ctx.currentTime;
            const freqs = [330, 290, 220, 160];
            const stepDuration = 0.18;

            freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'sawtooth';
                const startTime = now + idx * stepDuration;
                const stopTime = startTime + stepDuration;

                osc.frequency.setValueAtTime(freq, startTime);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.9, stopTime);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, startTime);

                gain.gain.setValueAtTime(0.09, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

                osc.connect(filter).connect(gain).connect(ctx.destination);
                osc.start(startTime);
                osc.stop(stopTime);
            });
        });
    }

    /**
     * Play combo sound (escalating arpeggio)
     */
    playComboSound(comboLevel) {
        this.runAudio((ctx) => {
            const notes = [1, 1.26, 1.5, 2]; // Major arpeggio

            notes.slice(0, Math.min(comboLevel, 4)).forEach((mult, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(
                    GAME_CONSTANTS.SOUND_COMBO_BASE * mult * (1 + comboLevel * 0.05),
                    ctx.currentTime
                );

                gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);

                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.08);
                osc.stop(ctx.currentTime + i * 0.08 + 0.25);
            });
        });
    }

    /**
     * Play victory fanfare
     */
    playVictorySound() {
        this.runAudio((ctx) => {
            const melody = [523, 659, 784, 1047]; // C5, E5, G5, C6

            melody.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);

                gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);

                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.35);
            });
        });
    }

    /**
     * Soft, friendly chime for the optional donation prompt.
     * The caller must have resumed the audio context after a user gesture.
     */
    playDonationChime() {
        this.runAudio((ctx) => {
            const now = ctx.currentTime;
            const notes = [659.25, 783.99, 987.77]; // E5, G5, B5

            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const start = now + index * 0.08;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.055, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);

                osc.connect(gain).connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.35);
            });
        });
    }

    /**
     * Play effect reveal sound
     */
    playEffectRevealSound(type) {
        this.runAudio((ctx) => {
            const now = ctx.currentTime;

            if (type === 'trap') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.5);
            } else {
                const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + i * 0.08);
                    gain.gain.setValueAtTime(0.1, now + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
                    osc.connect(gain).connect(ctx.destination);
                    osc.start(now + i * 0.08);
                    osc.stop(now + i * 0.08 + 0.25);
                });
            }
        });
    }

    /**
     * Play effect activation sound
     */
    playEffectActivationSound(type, effectId) {
        this.runAudio((ctx) => {
            const now = ctx.currentTime;

            if (effectId === 'landmine') {
                const noise = ctx.createBufferSource();
                if (!this._landmineBuffer) {
                    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < buffer.length; i++) {
                        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
                    }
                    this._landmineBuffer = buffer;
                }
                noise.buffer = this._landmineBuffer;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                noise.connect(gain).connect(ctx.destination);
                noise.start(now);
            } else if (effectId === 'freeze') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(2000, now);
                osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        });
    }

    /**
     * Play heartbeat countdown tick for urgency (final 3 seconds)
     * @param {number} urgency 1 (mild) to 3 (highest pitch/urgency)
     */
    playTickSound(urgency = 1) {
        if (!this.enabled || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            const pitch = 440 + urgency * 140; // 580Hz -> 720Hz -> 860Hz
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, now);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, now + 0.08);

            const volume = 0.04 + urgency * 0.03;
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } catch {
            // Audio context error or not ready
        }
    }

    /**
     * Play game over defeat stinger (descending minor chord sequence)
     */
    playGameOverSound() {
        if (!this.enabled || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            // Minor chord descent: Eb4 (311Hz), C4 (261Hz), G3 (196Hz), C3 (130Hz)
            const chords = [311.13, 261.63, 196.0, 130.81];

            chords.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const startTime = now + idx * 0.14;

                osc.type = idx === 3 ? 'sawtooth' : 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.95, startTime + 0.35);

                const vol = idx === 3 ? 0.12 : 0.09;
                gain.gain.setValueAtTime(vol, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

                osc.connect(gain).connect(this.ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.45);
            });
        } catch {
            // Audio context error
        }
    }

    /**
     * Toggle sound on/off
     */
    toggleSound() {
        this.enabled = !this.enabled;
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.textContent = this.enabled ? '🔊' : '🔇';
            soundToggle.classList.toggle('muted', !this.enabled);
        }
        // Let the home soundscape honour the same mute switch.
        if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
            window.dispatchEvent(
                new CustomEvent('shapekeeper:soundToggled', { detail: { enabled: this.enabled } })
            );
        }
    }
}
