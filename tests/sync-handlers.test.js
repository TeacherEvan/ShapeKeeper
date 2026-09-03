import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleAuthoritativeGameState } from '../src/ui/menu/syncHandlers.js';

// Minimal stubs for the deps `handleAuthoritativeGameState` reads.
function makeDeps(overrides = {}) {
    return {
        multiplayerStartup: {
            markFirstAuthoritativeState: () => ({ isFirstAuthoritativeState: false }),
            getSnapshot: () => ({}),
        },
        STARTUP_STATES: {},
        getGame: () => overrides.game,
        setStartupState: vi.fn(),
        showToast: vi.fn(),
        ...overrides,
    };
}

// A game-like object that mimics the real DotsAndBoxesGame surface used by
// handleAuthoritativeGameState. The key assertion target: the finished-room
// branch must NOT clobber `game.isGameOver` (which elsewhere is a METHOD on
// gameState, `this.gameState.isGameOver()`). It must use a separate boolean
// flag (`gameOverHandled`) so callers checking `gameState.isGameOver()` still
// work.
function makeGame() {
    return {
        lines: new Set(),
        lineOwners: new Map(),
        lineDrawings: [],
        pulsatingLines: [],
        squares: {},
        squareMultipliers: {},
        scores: { 1: 0, 2: 0 },
        currentPlayer: 1,
        myPlayerNumber: 1,
        uiManager: { updatePopulateButtonVisibility: vi.fn(), updateUI: vi.fn() },
        draw: vi.fn(),
        showWinner: vi.fn(),
        playLineSound: vi.fn(),
        playSquareSound: vi.fn(),
        triggerSquareAnimation: vi.fn(),
        gameState: { isGameOver: vi.fn(() => true) },
    };
}

function finishedRoomState() {
    return {
        players: [
            { playerIndex: 0, score: 3 },
            { playerIndex: 1, score: 1 },
        ],
        lines: [],
        squares: [],
        room: { status: 'finished', currentPlayerIndex: 1 },
    };
}

describe('handleAuthoritativeGameState — online game completion', () => {
    let game;
    let deps;

    beforeEach(() => {
        game = makeGame();
        deps = makeDeps({ game });
    });

    it('triggers showWinner exactly once when the room status is finished', () => {
        handleAuthoritativeGameState(finishedRoomState(), deps);

        expect(game.showWinner).toHaveBeenCalledTimes(1);
    });

    it('does NOT overwrite game.isGameOver (avoids method/property collision)', () => {
        handleAuthoritativeGameState(finishedRoomState(), deps);

        // The real game has no `game.isGameOver` property — game-over state is a
        // METHOD on gameState (`this.gameState.isGameOver()`). The old code set
        // `game.isGameOver = true`, clobbering that contract. Assert the boolean
        // collision is gone: the flag is neither defined nor the boolean `true`.
        expect(game.isGameOver).toBeUndefined();

        // Instead a dedicated completion flag is set.
        expect(game.gameOverHandled).toBe(true);
    });

    it('does not re-trigger showWinner on a second finished-state update (idempotent)', () => {
        handleAuthoritativeGameState(finishedRoomState(), deps);
        handleAuthoritativeGameState(finishedRoomState(), deps);

        expect(game.showWinner).toHaveBeenCalledTimes(1);
        expect(game.gameOverHandled).toBe(true);
    });

    it('leaves game over untouched while the room is still playing', () => {
        const playing = finishedRoomState();
        playing.room = { status: 'playing', currentPlayerIndex: 0 };

        handleAuthoritativeGameState(playing, deps);

        expect(game.showWinner).not.toHaveBeenCalled();
        expect(game.gameOverHandled).toBeUndefined();
    });
});

describe('handleRoomStateUpdate — isHost/isYou from server', () => {
    // The hostToken commit (054c4a8) strips every player's sessionId and the
    // room's hostPlayerId from the public getRoomByCode response. The server
    // now returns server-computed isHost (on the room) and isYou (on each
    // player). These tests prove the consumer side uses the new fields and
    // does not re-introduce a sessionId comparison that would always
    // evaluate to false on the new response shape.

    function makeLobbyManager() {
        return {
            roomCode: null,
            gridSize: null,
            isHost: false,
            isReady: false,
            myPlayerId: null,
            players: [],
            canStartGame: () => false,
        };
    }

    function makeRoomState(overrides = {}) {
        return {
            _id: 'rooms:1',
            roomCode: 'ABC123',
            status: 'lobby',
            gridSize: 5,
            isHost: false,
            players: [
                {
                    _id: 'p1',
                    name: 'Alice',
                    sessionId: 'session_a',
                    playerIndex: 0,
                    isHost: true,
                    isYou: false,
                },
                {
                    _id: 'p2',
                    name: 'Bob',
                    sessionId: 'session_b',
                    playerIndex: 1,
                    isHost: false,
                    isYou: true,
                },
            ],
            ...overrides,
        };
    }

    function makeDepsForRoom(lobbyManager, overrides = {}) {
        return {
            multiplayerStartup: {
                setLastRoomState: () => {},
                getSnapshot: () => ({ phase: 'idle' }),
            },
            STARTUP_STATES: {
                IDLE: 'idle',
                ROOM_SUBSCRIBED: 'subscribed',
                ROOM_READY_TO_START: 'ready',
                IN_MATCH: 'in_match',
            },
            lobbyManager,
            getGame: () => null,
            setStartupState: vi.fn(),
            showToast: vi.fn(),
            showScreen: vi.fn(),
            updateLobbyUI: vi.fn(),
            ...overrides,
        };
    }

    it('sets lobbyManager.isHost from roomState.isHost (host view)', async () => {
        const { handleRoomStateUpdate } = await import('../src/ui/menu/syncHandlers.js');
        const lobbyManager = makeLobbyManager();
        const room = makeRoomState({ isHost: true });

        handleRoomStateUpdate(room, makeDepsForRoom(lobbyManager));

        expect(lobbyManager.isHost).toBe(true);
    });

    it('sets lobbyManager.isHost from roomState.isHost (guest view)', async () => {
        const { handleRoomStateUpdate } = await import('../src/ui/menu/syncHandlers.js');
        const lobbyManager = makeLobbyManager();
        const room = makeRoomState({ isHost: false });

        handleRoomStateUpdate(room, makeDepsForRoom(lobbyManager));

        expect(lobbyManager.isHost).toBe(false);
    });

    it('sets lobbyManager.myPlayerId to the player with isYou=true (not sessionId match)', async () => {
        const { handleRoomStateUpdate } = await import('../src/ui/menu/syncHandlers.js');
        const lobbyManager = makeLobbyManager();
        const room = makeRoomState();

        handleRoomStateUpdate(room, makeDepsForRoom(lobbyManager));

        expect(lobbyManager.myPlayerId).toBe('p2');
    });

    it('marks every player with roomState.isHost (per-player isHost in lobby list)', async () => {
        const { handleRoomStateUpdate } = await import('../src/ui/menu/syncHandlers.js');
        const lobbyManager = makeLobbyManager();
        const room = makeRoomState({ isHost: true });

        handleRoomStateUpdate(room, makeDepsForRoom(lobbyManager));

        expect(lobbyManager.players).toHaveLength(2);
        expect(lobbyManager.players[0].isHost).toBe(true);
        expect(lobbyManager.players[1].isHost).toBe(true);
    });

    it('regression: works when per-player sessionId is missing from response', async () => {
        // This is the actual production shape: the new getRoomByCode response
        // does NOT include per-player sessionId at all. The old consumer
        // code (roomState.players.find((p) => p.sessionId === mySessionId))
        // would have returned undefined for myPlayer. The new code must
        // succeed.
        const { handleRoomStateUpdate } = await import('../src/ui/menu/syncHandlers.js');
        const lobbyManager = makeLobbyManager();
        const room = {
            _id: 'rooms:1',
            roomCode: 'ABC123',
            status: 'lobby',
            gridSize: 5,
            isHost: true,
            // Note: NO hostPlayerId field, NO per-player sessionId field.
            players: [{ _id: 'p1', name: 'Alice', playerIndex: 0, isYou: true, isReady: false }],
        };

        handleRoomStateUpdate(room, makeDepsForRoom(lobbyManager));

        expect(lobbyManager.isHost).toBe(true);
        expect(lobbyManager.myPlayerId).toBe('p1');
    });
});
