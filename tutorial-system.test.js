import { describe, expect, it, beforeEach, vi } from 'vitest';

import { TutorialSystem } from './tutorial-system.js';

/**
 * Build a minimal fake game object exposing every member the TutorialSystem
 * touches. Each collaborator is a vi.fn() so tests can assert call order.
 */
function createMockGame() {
    return {
        lines: new Set(),
        lineOwners: new Map(),
        squares: {},
        scores: { 1: 0, 2: 0 },
        currentPlayer: 1,
        selectedDot: null,
        selectionLocked: false,
        selectionRibbon: null,
        moveHistory: [],
        redoHistory: [],
        replayIndex: 0,
        getLineKey: vi.fn((a, b) => `${a.row},${a.col}-${b.row},${b.col}`),
        animationSystem: { addPulsatingLine: vi.fn() },
        uiManager: {
            updateUI: vi.fn(),
            updatePopulateButtonVisibility: vi.fn(),
            updateUndoRedoControls: vi.fn(),
            updateReplayControls: vi.fn(),
        },
        gameState: { initializeGameState: vi.fn() },
        effectSystem: {
            initializeMultipliers: vi.fn(),
            initializeTileEffects: vi.fn(),
        },
        initialLocalSnapshot: null,
        captureMoveSnapshot: vi.fn(() => ({ snapshot: true })),
        draw: vi.fn(),
    };
}

describe('TutorialSystem — lifecycle', () => {
    let game;

    beforeEach(() => {
        game = createMockGame();
        // jsdom provides document; ensure the elements resolveDom looks up exist
        document.body.innerHTML = `
            <div id="tutorialOverlay"></div>
            <div id="tutorialTitle"></div>
            <div id="tutorialMessage"></div>
            <div id="tutorialStepLabel"></div>
            <button id="tutorialSkipBtn"></button>
            <button id="tutorialExitBtn"></button>
            <button id="tutorialContinueBtn"></button>
        `;
    });

    it('starts inactive until start() is called', () => {
        const t = new TutorialSystem(game);
        expect(t.isActive()).toBe(false);
        expect(t.getSnapshot().stepIndex).toBe(0);
    });

    it('auto-starts when options.enabled is true', () => {
        const t = new TutorialSystem(game, { enabled: true });
        expect(t.isActive()).toBe(true);
        expect(t.stepIndex).toBe(0);
    });

    it('is idempotent: calling start() twice does not advance the step', () => {
        const t = new TutorialSystem(game, { enabled: true });
        t.start();
        expect(t.stepIndex).toBe(0);
    });

    it('getSnapshot reports completed only after the last step', () => {
        const t = new TutorialSystem(game, { enabled: true });
        // walk to the end via skips
        t.handleSkip();
        const snap = t.getSnapshot();
        expect(snap.active).toBe(false);
        expect(snap.completed).toBe(true);
        expect(snap.stepId).toBeNull();
    });
});

describe('TutorialSystem — dot gating', () => {
    let game;
    beforeEach(() => {
        game = createMockGame();
        document.body.innerHTML = `
            <div id="tutorialOverlay"></div><div id="tutorialTitle"></div>
            <div id="tutorialMessage"></div><div id="tutorialStepLabel"></div>
            <button id="tutorialSkipBtn"></button><button id="tutorialExitBtn"></button>
            <button id="tutorialContinueBtn"></button>
        `;
    });

    it('allows any dot when inactive', () => {
        const t = new TutorialSystem(game);
        expect(t.canSelectDot({ row: 5, col: 5 })).toBe(true);
    });

    it('blocks selecting a non-required dot on step "select-first-dot"', () => {
        const t = new TutorialSystem(game, { enabled: true });
        expect(t.canSelectDot({ row: 0, col: 0 })).toBe(true);
        expect(t.canSelectDot({ row: 3, col: 3 })).toBe(false);
    });

    it('advances after the required first dot is selected', () => {
        const t = new TutorialSystem(game, { enabled: true });
        t.onDotSelected({ row: 0, col: 0 });
        expect(t.stepIndex).toBe(1);
        expect(t.getCurrentStep().id).toBe('draw-first-line');
    });
});

describe('TutorialSystem — line gating & advance', () => {
    let game;
    beforeEach(() => {
        game = createMockGame();
        document.body.innerHTML = `
            <div id="tutorialOverlay"></div><div id="tutorialTitle"></div>
            <div id="tutorialMessage"></div><div id="tutorialStepLabel"></div>
            <button id="tutorialSkipBtn"></button><button id="tutorialExitBtn"></button>
            <button id="tutorialContinueBtn"></button>
        `;
    });

    it('blocks drawing a line that is not the required line key', () => {
        const t = new TutorialSystem(game, { enabled: true });
        t.onDotSelected({ row: 0, col: 0 }); // advance to draw-first-line
        expect(t.canDrawLine({ row: 0, col: 0 }, { row: 1, col: 0 })).toBe(false);
        expect(t.canDrawLine({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    });

    it('blocks drawing entirely during an info step', () => {
        const t = new TutorialSystem(game, { enabled: true });
        // advance to bonus-turn (info step): select dot, draw line, complete square
        t.onDotSelected({ row: 0, col: 0 });
        t.onMoveResolved({ lineKey: '0,0-0,1', completedSquaresCount: 0 });
        t.onMoveResolved({ lineKey: '0,1-1,1', completedSquaresCount: 1 });
        expect(t.getCurrentStep().id).toBe('bonus-turn');
        expect(t.canDrawLine({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(false);
    });

    it('advances on completing the square at the final required step', () => {
        const t = new TutorialSystem(game, { enabled: true });
        t.onDotSelected({ row: 0, col: 0 });
        t.onMoveResolved({ lineKey: '0,0-0,1', completedSquaresCount: 0 });
        expect(t.getCurrentStep().id).toBe('complete-square');
        t.onMoveResolved({ lineKey: '0,1-1,1', completedSquaresCount: 1 });
        expect(t.getCurrentStep().id).toBe('bonus-turn');
    });
});

describe('TutorialSystem — finish paths', () => {
    let game;
    beforeEach(() => {
        game = createMockGame();
        document.body.innerHTML = `
            <div id="tutorialOverlay"></div><div id="tutorialTitle"></div>
            <div id="tutorialMessage"></div><div id="tutorialStepLabel"></div>
            <button id="tutorialSkipBtn"></button><button id="tutorialExitBtn"></button>
            <button id="tutorialContinueBtn"></button>
        `;
    });

    it('handleSkip deactivates and resets the board', () => {
        const onSkip = vi.fn();
        const t = new TutorialSystem(game, { enabled: true, onSkip });
        t.handleSkip();
        expect(t.isActive()).toBe(false);
        expect(game.gameState.initializeGameState).toHaveBeenCalled();
        expect(game.effectSystem.initializeMultipliers).toHaveBeenCalled();
        expect(onSkip).toHaveBeenCalled();
    });

    it('handleExit deactivates without resetting the board and calls onExit', () => {
        const onExit = vi.fn();
        const t = new TutorialSystem(game, { enabled: true, onExit });
        t.handleExit();
        expect(t.isActive()).toBe(false);
        expect(game.gameState.initializeGameState).not.toHaveBeenCalled();
        expect(onExit).toHaveBeenCalled();
    });

    it('handleContinue finishes only on the bonus-turn info step', () => {
        const t = new TutorialSystem(game, { enabled: true });
        t.onDotSelected({ row: 0, col: 0 });
        const before = t.stepIndex;
        t.handleContinue(); // on draw-first-line, should be a no-op
        expect(t.stepIndex).toBe(before);

        // reach bonus-turn
        t.onMoveResolved({ lineKey: '0,0-0,1', completedSquaresCount: 0 });
        t.onMoveResolved({ lineKey: '0,1-1,1', completedSquaresCount: 1 });
        t.handleContinue();
        expect(t.isActive()).toBe(false);
        expect(game.gameState.initializeGameState).toHaveBeenCalled();
    });
});
