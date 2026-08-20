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
