import { afterEach, describe, expect, it, vi } from 'vitest';

import { STARTUP_STATES, createMultiplayerStartupController } from './MultiplayerStartup.js';

describe('createMultiplayerStartupController', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('clears the awaiting timeout after the first authoritative state arrives', () => {
        vi.useFakeTimers();
        const onTimeout = vi.fn();
        let now = 1000;

        const controller = createMultiplayerStartupController({
            timeoutMs: 8000,
            onTimeout,
            nowFn: () => now,
        });

        controller.beginGameShell({ roomCode: 'ABC123' });
        controller.setPhase(STARTUP_STATES.AWAITING_FIRST_AUTHORITATIVE_STATE);
        controller.startAwaitingFirstState();

        vi.advanceTimersByTime(3000);
        now += 3000;

        const firstState = controller.markFirstAuthoritativeState();

        expect(firstState).toEqual({
            isFirstAuthoritativeState: true,
            startupDurationMs: 3000,
            retryCount: 0,
        });

        vi.advanceTimersByTime(5000);
        expect(onTimeout).not.toHaveBeenCalled();
        expect(controller.getSnapshot().firstAuthoritativeStateReceived).toBe(true);
    });

    it('fires the timeout callback if the first authoritative state never arrives', () => {
        vi.useFakeTimers();
        const onTimeout = vi.fn();

        const controller = createMultiplayerStartupController({
            timeoutMs: 8000,
            onTimeout,
        });

        controller.beginGameShell({ roomCode: 'ABC123' });
        controller.setPhase(STARTUP_STATES.AWAITING_FIRST_AUTHORITATIVE_STATE);
        controller.startAwaitingFirstState();

        vi.advanceTimersByTime(8000);

        expect(onTimeout).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot().firstAuthoritativeStateReceived).toBe(false);
    });

    it('tracks retries and resets cleanly for a new match startup', () => {
        const controller = createMultiplayerStartupController({ timeoutMs: 8000 });

        controller.beginGameShell({ roomCode: 'FIRST01' });
        controller.markRetry();
        controller.markRetry();

        expect(controller.getSnapshot().retryCount).toBe(2);

        controller.reset();
        expect(controller.getSnapshot()).toMatchObject({
            phase: STARTUP_STATES.IDLE,
            retryCount: 0,
            firstAuthoritativeStateReceived: false,
            lastRoomState: null,
        });

        controller.beginGameShell({ roomCode: 'SECOND2' });
        expect(controller.getSnapshot()).toMatchObject({
            retryCount: 0,
            firstAuthoritativeStateReceived: false,
            lastRoomState: { roomCode: 'SECOND2' },
        });
    });
});
