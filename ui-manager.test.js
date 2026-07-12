import { describe, expect, it, beforeEach } from 'vitest';

import { UIManager } from './ui-manager.js';

function makeGame(overrides = {}) {
    return {
        lastUIUpdate: 0,
        uiUpdateInterval: 100,
        scores: { 1: 0, 2: 0 },
        displayedScores: { 1: 0, 2: 0 },
        scoreAnimationSpeed: 0.2,
        currentPlayer: 1,
        player1Color: '#FF0000',
        player2Color: '#0000FF',
        isMultiplayer: false,
        localMode: 'local',
        aiThinking: false,
        moveHistory: [],
        redoHistory: [],
        replayIndex: 0,
        gameLogic: { getSafeLines: () => ['0,0-0,1'] },
        tutorialSystem: { isActive: () => false },
        ...overrides,
    };
}

function seedDom() {
    document.body.innerHTML = `
        <div id="player1Score"></div>
        <div id="player2Score"></div>
        <div id="player1Info"></div>
        <div id="player2Info"></div>
        <div id="turnIndicator"></div>
        <button id="populateBtn"></button>
        <button id="undoBtn"></button>
        <button id="redoBtn"></button>
        <button id="saveLocalBtn"></button>
        <button id="replayBackBtn"></button>
        <button id="replayForwardBtn"></button>
        <button id="replayRestartBtn"></button>
        <div id="gameLoadingSkeleton"></div>
    `;
}

describe('UIManager — undo/redo/replay control gating', () => {
    beforeEach(() => {
        seedDom();
    });

    it('enables undo/redo when there is local history', () => {
        const game = makeGame({ moveHistory: [{ line: 'a' }] });
        const ui = new UIManager(game);
        ui.updateUndoRedoControls();
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        expect(undoBtn.disabled).toBe(false);
        expect(redoBtn.disabled).toBe(true); // redoHistory empty
    });

    it('disables both controls in multiplayer', () => {
        const game = makeGame({
            isMultiplayer: true,
            moveHistory: [{ x: 1 }],
            redoHistory: [{ x: 2 }],
        });
        const ui = new UIManager(game);
        ui.updateUndoRedoControls();
        expect(document.getElementById('undoBtn').disabled).toBe(true);
        expect(document.getElementById('redoBtn').disabled).toBe(true);
    });

    it('locks controls while the AI is thinking', () => {
        const game = makeGame({ localMode: 'ai', aiThinking: true, moveHistory: [{ x: 1 }] });
        const ui = new UIManager(game);
        ui.updateUndoRedoControls();
        expect(document.getElementById('undoBtn').disabled).toBe(true);
    });

    it('locks controls while the tutorial is active', () => {
        const game = makeGame({
            moveHistory: [{ x: 1 }],
            tutorialSystem: { isActive: () => true },
        });
        const ui = new UIManager(game);
        ui.updateUndoRedoControls();
        expect(document.getElementById('undoBtn').disabled).toBe(true);
    });

    it('replay controls forward disabled at end of history, back disabled at start', () => {
        const game = makeGame({
            moveHistory: [{ x: 1 }, { x: 2 }],
            replayIndex: 2, // at the end
        });
        const ui = new UIManager(game);
        ui.updateReplayControls();
        expect(document.getElementById('replayForwardBtn').disabled).toBe(true);
        expect(document.getElementById('replayBackBtn').disabled).toBe(false);
        expect(document.getElementById('replayRestartBtn').disabled).toBe(false);
    });

    it('disables all replay controls in multiplayer', () => {
        const game = makeGame({
            isMultiplayer: true,
            moveHistory: [{ x: 1 }],
            replayIndex: 1,
        });
        const ui = new UIManager(game);
        ui.updateReplayControls();
        expect(document.getElementById('saveLocalBtn').disabled).toBe(true);
        expect(document.getElementById('replayBackBtn').disabled).toBe(true);
        expect(document.getElementById('replayForwardBtn').disabled).toBe(true);
        expect(document.getElementById('replayRestartBtn').disabled).toBe(true);
    });
});

describe('UIManager — populate button visibility', () => {
    beforeEach(() => {
        seedDom();
    });

    it('hides populate button for non-host multiplayer players', () => {
        const game = makeGame({ isMultiplayer: true, isHost: false });
        const ui = new UIManager(game);
        ui.updatePopulateButtonVisibility();
        expect(document.getElementById('populateBtn').classList.contains('hidden')).toBe(true);
    });

    it('shows populate button when safe lines exist in local mode', () => {
        const game = makeGame({
            isMultiplayer: false,
            gameLogic: { getSafeLines: () => ['0,0-0,1'] },
        });
        const ui = new UIManager(game);
        ui.updatePopulateButtonVisibility();
        expect(document.getElementById('populateBtn').classList.contains('hidden')).toBe(false);
    });

    it('hides populate button when no safe lines remain', () => {
        const game = makeGame({ isMultiplayer: false, gameLogic: { getSafeLines: () => [] } });
        const ui = new UIManager(game);
        ui.updatePopulateButtonVisibility();
        expect(document.getElementById('populateBtn').classList.contains('hidden')).toBe(true);
    });
});

describe('UIManager — loading skeleton', () => {
    beforeEach(() => {
        seedDom();
    });

    it('toggles the hidden class on the loading skeleton', () => {
        const ui = new UIManager(makeGame());
        ui.displayLoadingSkeleton(true);
        expect(document.getElementById('gameLoadingSkeleton').classList.contains('hidden')).toBe(
            false
        );
        ui.displayLoadingSkeleton(false);
        expect(document.getElementById('gameLoadingSkeleton').classList.contains('hidden')).toBe(
            true
        );
    });
});
