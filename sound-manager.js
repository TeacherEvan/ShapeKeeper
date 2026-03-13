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
        this.initializeAudioContext();
    }

    /**
     * Initialize Web Audio API context
     */
    initializeAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                this.initialized = true;
            }
        } catch (e) {
            console.log('[Sound] Web Audio API not available');
        }
    }

    /**
     * Ensure audio context is initialized (call from user gesture)
     */
    ensureAudioContext() {
        if (!this.ctx || this.initialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
        } catch (e) {
            console.log('[Sound] Could not initialize audio context');
        }
    }

    /**
     * Play line draw sound (rising tone)
     */
    playLineSound() {
        if (!this.enabled || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(GAME_CONSTANTS.SOUND_LINE_BASE, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            GAME_CONSTANTS.SOUND_LINE_BASE * 2,
            this.ctx.currentTime + 0.1
        );

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    /**
     * Play square completion sound (chord)
     */
    playSquareSound(comboCount = 1) {
        if (!this.enabled || !this.ctx) return;

        const baseFreq = GAME_CONSTANTS.SOUND_SQUARE_BASE * (1 + comboCount * 0.1);

        // Play a chord (root + major third + fifth)
        [1, 1.26, 1.5].forEach((mult, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(baseFreq * mult, this.ctx.currentTime);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.05);
            osc.stop(this.ctx.currentTime + 0.35);
        });
    }

    /**
     * Play invalid move sound (dissonant buzz)
     */
    playInvalidSound() {
        if (!this.enabled || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    /**
     * Play combo sound (escalating arpeggio)
     */
    playComboSound(comboLevel) {
        if (!this.enabled || !this.ctx) return;

        const notes = [1, 1.26, 1.5, 2]; // Major arpeggio

        notes.slice(0, Math.min(comboLevel, 4)).forEach((mult, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(
                GAME_CONSTANTS.SOUND_COMBO_BASE * mult * (1 + comboLevel * 0.05),
                this.ctx.currentTime
            );

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.08 + 0.2);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.08);
            osc.stop(this.ctx.currentTime + i * 0.08 + 0.25);
        });
    }

    /**
     * Play victory fanfare
     */
    playVictorySound() {
        if (!this.enabled || !this.ctx) return;

        const melody = [523, 659, 784, 1047]; // C5, E5, G5, C6

        melody.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.15 + 0.3);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.15);
            osc.stop(this.ctx.currentTime + i * 0.15 + 0.35);
        });
    }

    /**
     * Play effect reveal sound
     */
    playEffectRevealSound(type) {
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;

        if (type === 'trap') {
            // Ominous descending tone
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } else {
            // Magical ascending sparkle
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);
                gain.gain.setValueAtTime(0.1, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.25);
            });
        }
    }

    /**
     * Play effect activation sound
     */
    playEffectActivationSound(type, effectId) {
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;

        // Special sounds for specific effects
        if (effectId === 'landmine') {
            // Explosion sound
            const noise = this.ctx.createBufferSource();
            const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
            }
            noise.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            noise.connect(gain).connect(this.ctx.destination);
            noise.start(now);
        } else if (effectId === 'freeze') {
            // Ice crackle
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2000, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
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
    }
}
