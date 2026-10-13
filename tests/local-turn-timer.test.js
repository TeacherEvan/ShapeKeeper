import { describe, it, expect } from 'vitest';
import { createLocalTurnTimer } from '../src/timing/local-turn-timer.js';

describe('createLocalTurnTimer', () => {
    it('is disabled when durationMs is 0, negative, or NaN', () => {
        let currentTime = 1000;
        const fakeNow = () => currentTime;

        for (const badDuration of [0, -5000, NaN, null, undefined]) {
            const timer = createLocalTurnTimer({ durationMs: badDuration, now: fakeNow });
            expect(timer.enabled).toBe(false);
            expect(timer.durationMs).toBe(0);
            timer.start();
            expect(timer.remainingMs()).toBeNull();
            expect(timer.consumeExpiry()).toBe(false);
        }
    });

    it('counts down and triggers consumeExpiry once at/after deadline', () => {
        let currentTime = 1000;
        const fakeNow = () => currentTime;
        const timer = createLocalTurnTimer({ durationMs: 15000, now: fakeNow });

        expect(timer.enabled).toBe(true);
        expect(timer.durationMs).toBe(15000);
        expect(timer.remainingMs()).toBeNull();

        timer.start();
        expect(timer.remainingMs()).toBe(15000);
        expect(timer.consumeExpiry()).toBe(false);

        currentTime = 6000;
        expect(timer.remainingMs()).toBe(10000);
        expect(timer.consumeExpiry()).toBe(false);

        currentTime = 16000;
        expect(timer.remainingMs()).toBe(0);
        expect(timer.consumeExpiry()).toBe(true);
        // Consumed once
        expect(timer.consumeExpiry()).toBe(false);

        currentTime = 17000;
        expect(timer.consumeExpiry()).toBe(false);
    });

    it('start() re-arms the timer and resets consumeExpiry', () => {
        let currentTime = 1000;
        const fakeNow = () => currentTime;
        const timer = createLocalTurnTimer({ durationMs: 10000, now: fakeNow });

        timer.start();
        currentTime = 12000;
        expect(timer.consumeExpiry()).toBe(true);

        currentTime = 13000;
        timer.start();
        expect(timer.remainingMs()).toBe(10000);
        expect(timer.consumeExpiry()).toBe(false);

        currentTime = 24000;
        expect(timer.consumeExpiry()).toBe(true);
        expect(timer.consumeExpiry()).toBe(false);
    });

    it('pause() freezes remaining time and resume() continues countdown', () => {
        let currentTime = 1000;
        const fakeNow = () => currentTime;
        const timer = createLocalTurnTimer({ durationMs: 10000, now: fakeNow });

        timer.start();
        currentTime = 4000;
        expect(timer.remainingMs()).toBe(7000);

        timer.pause();
        currentTime = 8000; // time elapses while paused
        expect(timer.remainingMs()).toBe(7000);
        expect(timer.consumeExpiry()).toBe(false);

        timer.resume();
        expect(timer.remainingMs()).toBe(7000);

        currentTime = 12000; // 4000ms after resume
        expect(timer.remainingMs()).toBe(3000);
        expect(timer.consumeExpiry()).toBe(false);

        currentTime = 16000; // past deadline
        expect(timer.remainingMs()).toBe(0);
        expect(timer.consumeExpiry()).toBe(true);
    });

    it('stop() deactivates the timer and returns null remainingMs', () => {
        let currentTime = 1000;
        const fakeNow = () => currentTime;
        const timer = createLocalTurnTimer({ durationMs: 10000, now: fakeNow });

        timer.start();
        currentTime = 5000;
        expect(timer.remainingMs()).toBe(6000);

        timer.stop();
        expect(timer.remainingMs()).toBeNull();
        expect(timer.consumeExpiry()).toBe(false);
    });
});
