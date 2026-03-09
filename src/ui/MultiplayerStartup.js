/**
 * Multiplayer startup state controller for live match boot flow.
 */

export const STARTUP_STATES = Object.freeze({
    IDLE: 'idle',
    CREATING_OR_JOINING_ROOM: 'creating_or_joining_room',
    ROOM_SUBSCRIBED: 'room_subscribed',
    ROOM_READY_TO_START: 'room_ready_to_start',
    INITIALIZING_GAME_SHELL: 'initializing_game_shell',
    AWAITING_FIRST_AUTHORITATIVE_STATE: 'awaiting_first_authoritative_state',
    IN_MATCH: 'in_match',
    RECONNECTING: 'reconnecting',
    DESYNCED: 'desynced',
    FATAL_STARTUP_FAILURE: 'fatal_startup_failure',
});

export const STARTUP_COPY = {
    [STARTUP_STATES.CREATING_OR_JOINING_ROOM]: {
        message: 'Connecting to room...',
        hint: 'Establishing the multiplayer session.',
    },
    [STARTUP_STATES.ROOM_SUBSCRIBED]: {
        message: 'Room connected.',
        hint: 'Waiting for the host to launch the match.',
    },
    [STARTUP_STATES.ROOM_READY_TO_START]: {
        message: 'Room ready.',
        hint: 'All players are ready. Waiting for kickoff.',
    },
    [STARTUP_STATES.INITIALIZING_GAME_SHELL]: {
        message: 'Preparing live match...',
        hint: 'Building the local game shell before sync begins.',
    },
    [STARTUP_STATES.AWAITING_FIRST_AUTHORITATIVE_STATE]: {
        message: 'Synchronizing live match...',
        hint: 'Waiting for the first authoritative board state from Convex.',
    },
    [STARTUP_STATES.RECONNECTING]: {
        message: 'Reconnecting to live match...',
        hint: 'Re-subscribing and requesting the latest board state.',
    },
    [STARTUP_STATES.DESYNCED]: {
        message: 'Match sync interrupted.',
        hint: 'Trying to recover the authoritative board state.',
    },
    [STARTUP_STATES.FATAL_STARTUP_FAILURE]: {
        message: 'Live match sync timed out.',
        hint: 'You can retry synchronization or leave the match safely.',
    },
};

export function createMultiplayerStartupController({
    timeoutMs,
    onTimeout,
    nowFn = () => Date.now(),
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
}) {
    const state = {
        phase: STARTUP_STATES.IDLE,
        firstAuthoritativeStateReceived: false,
        timeoutId: null,
        lastRoomState: null,
        startupBeganAt: null,
        retryCount: 0,
    };

    function clearAwaitingTimeout() {
        if (state.timeoutId) {
            clearTimeoutFn(state.timeoutId);
            state.timeoutId = null;
        }
    }

    function getSnapshot() {
        return {
            phase: state.phase,
            firstAuthoritativeStateReceived: state.firstAuthoritativeStateReceived,
            lastRoomState: state.lastRoomState,
            startupBeganAt: state.startupBeganAt,
            retryCount: state.retryCount,
        };
    }

    function setPhase(nextPhase) {
        const previousPhase = state.phase;
        state.phase = nextPhase;
        return { previousPhase, nextPhase };
    }

    function setLastRoomState(roomState) {
        state.lastRoomState = roomState;
    }

    function beginGameShell(roomState) {
        state.lastRoomState = roomState;
        state.firstAuthoritativeStateReceived = false;
        state.startupBeganAt = nowFn();
        state.retryCount = 0;
    }

    function startAwaitingFirstState() {
        clearAwaitingTimeout();
        state.timeoutId = setTimeoutFn(() => {
            if (state.firstAuthoritativeStateReceived) {
                return;
            }
            onTimeout?.(getSnapshot());
        }, timeoutMs);
    }

    function markRetry() {
        state.retryCount += 1;
        state.firstAuthoritativeStateReceived = false;
    }

    function markFirstAuthoritativeState() {
        const isFirstAuthoritativeState = !state.firstAuthoritativeStateReceived;
        if (!isFirstAuthoritativeState) {
            return {
                isFirstAuthoritativeState: false,
                startupDurationMs: null,
                retryCount: state.retryCount,
            };
        }

        state.firstAuthoritativeStateReceived = true;
        clearAwaitingTimeout();

        return {
            isFirstAuthoritativeState: true,
            startupDurationMs: state.startupBeganAt ? nowFn() - state.startupBeganAt : null,
            retryCount: state.retryCount,
        };
    }

    function reset({ preserveLastRoomState = false } = {}) {
        clearAwaitingTimeout();
        state.phase = STARTUP_STATES.IDLE;
        state.firstAuthoritativeStateReceived = false;
        state.startupBeganAt = null;
        state.retryCount = 0;

        if (!preserveLastRoomState) {
            state.lastRoomState = null;
        }
    }

    return {
        getSnapshot,
        setPhase,
        setLastRoomState,
        beginGameShell,
        startAwaitingFirstState,
        clearAwaitingTimeout,
        markRetry,
        markFirstAuthoritativeState,
        reset,
    };
}
