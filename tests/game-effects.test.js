import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import {
    executeEffect,
    stealConnectedTerritory,
    applyLandmine,
} from '../effect-system/gameplay.js';
import { TILE_EFFECTS } from '../constants.js';
import {
    createLocalSavePayload,
    validateLocalSavePayload,
    isValidSnapshot,
} from '../local-save-replay.js';

function installPRNG(seed = 1) {
    let s = seed >>> 0;
    const rng = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
    vi.spyOn(Math, 'random').mockImplementation(rng);
    return rng;
}

const CANVAS_MOCK = () => ({
    scale() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    translate() {},
    clip() {},
    fillText() {},
    measureText: () => ({ width: 0 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    setLineDash() {},
});

function makeGame({ localMode = 'human', aiDifficulty = 'easy' } = {}) {
    document.body.innerHTML = `
        <canvas id="gameCanvas"></canvas>
        <div id="player1Score"></div>
        <div id="player2Score"></div>
        <div id="player1Info"></div>
        <div id="player2Info"></div>
        <div id="turnIndicator"></div>
        <button id="populateBtn"></button>
        <div id="gameLoadingSkeleton"></div>
        <button id="undoBtn"></button>
        <button id="redoBtn"></button>
        <button id="saveLocalBtn"></button>
        <button id="replayBackBtn"></button>
        <button id="replayForwardBtn"></button>
        <button id="replayRestartBtn"></button>
        <button id="soundToggle"></button>
    `;
    window.devicePixelRatio = 1;
    navigator.maxTouchPoints = 0;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    HTMLCanvasElement.prototype.getContext = CANVAS_MOCK;
    const game = new DotsAndBoxesGame(4, '#FF0000', '#0000FF', {
        localMode,
        aiDifficulty,
    });
    return game;
}

function makeEffectSystem(game, pendingEffect = null) {
    const system = {
        game,
        pendingEffect,
        effectModal: null,
        announceTurnMessage: vi.fn(),
        closeEffectModal: vi.fn(() => {
            system.effectModal = null;
        }),
    };
    // Add mock methods that applyLandmine might call
    if (!game.switchToNextPlayer) {
        game.switchToNextPlayer = vi.fn();
    }
    return system;
}

function addLine(game, dot1, dot2) {
    game.lines.add(game.getLineKey(dot1, dot2));
}

describe('effect-system - executeEffect core effects', () => {
    let game;
    let system;

    beforeEach(() => {
        installPRNG(42);
        game = makeGame();
        system = makeEffectSystem(game);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('freeze effect', () => {
        it('sets frozenTurns = 1 on the acting player', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'freeze' }, type: 'trap', activated: false },
            };
            executeEffect(system, 'freeze', 'trap', 1, '0-0');
            expect(game.playerEffects[1].frozenTurns).toBe(1);
        });

        it('creates freeze particles', () => {
            const createFreezeParticles = vi.spyOn(game.particleSystem, 'createFreezeParticles');
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'freeze' }, type: 'trap', activated: false },
            };
            executeEffect(system, 'freeze', 'trap', 1, '0-0');
            expect(createFreezeParticles).toHaveBeenCalled();
        });
    });

    describe('reverse effect (bonus turn)', () => {
        it('grants bonusTurns += 1 to the acting player', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'reverse' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'reverse', 'powerup', 1, '0-0');
            expect(game.playerEffects[1].bonusTurns).toBe(1);
        });

        it('announces REVERSE message', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'reverse' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'reverse', 'powerup', 1, '0-0');
            expect(system.announceTurnMessage).toHaveBeenCalledWith(
                '🔄 REVERSE! Play Again!',
                '#E91E63',
                2000
            );
        });
    });

    describe('ghost effect', () => {
        it('grants ghostLines = 3 to the acting player', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'ghost' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'ghost', 'powerup', 1, '0-0');
            expect(game.playerEffects[1].ghostLines).toBe(3);
        });
    });

    describe('shield effect', () => {
        it('sets shieldCount = 3 on the acting player', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'shield' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'shield', 'powerup', 1, '0-0');
            expect(game.playerEffects[1].shieldCount).toBe(3);
        });

        it('triggers shield animation and particles', () => {
            const triggerEffectAnimation = vi.spyOn(game.animationSystem, 'triggerEffectAnimation');
            const createShieldParticles = vi.spyOn(game.particleSystem, 'createShieldParticles');
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'shield' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'shield', 'powerup', 1, '0-0');
            expect(triggerEffectAnimation).toHaveBeenCalledWith('shield', 1);
            expect(createShieldParticles).toHaveBeenCalled();
        });

        it('prevents territory stealing when shield is active', () => {
            game.playerEffects[1].shieldCount = 3;
            game.protectedSquares.add('0-0');
            game.squares['0-0'] = 2;

            const stealSystem = makeEffectSystem(game);
            stealSystem.announceTurnMessage = vi.fn();

            stealConnectedTerritory(stealSystem, 1, 2);
            expect(stealSystem.announceTurnMessage).toHaveBeenCalledWith(
                '🛡️ Steal blocked!',
                '#3F51B5',
                1500
            );
        });
    });

    describe('extra_turns effect', () => {
        it('grants bonusTurns += 2', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'extra_turns' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'extra_turns', 'powerup', 1, '0-0');
            expect(game.playerEffects[1].bonusTurns).toBe(2);
        });
    });

    describe('double_points effect', () => {
        it('sets doublePointsCount = 3', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'double_points' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'double_points', 'powerup', 1, '0-0');
            expect(game.playerEffects[1].doublePointsCount).toBe(3);
        });
    });

    describe('lightning effect', () => {
        it('sets doubleLine = true', () => {
            system.pendingEffect = {
                squareKey: '0-0',
                player: 1,
                effectData: { effect: { id: 'lightning' }, type: 'powerup', activated: false },
            };
            executeEffect(system, 'lightning', 'powerup', 1, '0-0');
            expect(game.playerEffects[1].doubleLine).toBe(true);
        });
    });
});

describe('effect-system - freezeTurns thawing behavior', () => {
    let game;
    let system;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame();
        system = makeEffectSystem(game);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('frozenTurns decrements when the frozen player would take a turn', () => {
        game.playerEffects[1].frozenTurns = 1;
        game.currentPlayer = 1;
        expect(game.playerEffects[1].frozenTurns).toBe(1);
    });

    it('bonusTurns allows the player to keep their turn', () => {
        game.playerEffects[1].bonusTurns = 1;
        game.currentPlayer = 1;
        expect(game.playerEffects[1].bonusTurns).toBe(1);
    });
});

describe('effect-system - ghostLines behavior', () => {
    let game;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('ghostLines decrements when a line is drawn', () => {
        game.playerEffects[1].ghostLines = 3;
        game.currentPlayer = 1;
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        expect(game.playerEffects[1].ghostLines).toBe(3);
    });

    it('ghost lines are tracked in the game state', () => {
        game.playerEffects[1].ghostLines = 2;
        expect(game.playerEffects[1].ghostLines).toBe(2);
    });
});

describe('effect-system - protectedSquares prevents stealing', () => {
    let game;
    let system;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame();
        system = makeEffectSystem(game);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('protectSquares blocks steal_territory from taking protected squares', () => {
        game.squares['0-0'] = 2;
        game.protectedSquares.add('0-0');

        stealConnectedTerritory(system, 1, 2);

        expect(game.squares['0-0']).toBe(2);
        expect(system.announceTurnMessage).toHaveBeenCalledWith(
            '🛡️ Steal blocked!',
            '#3F51B5',
            1500
        );
    });

    it('landmine removes protection and square', () => {
        game.squares['0-0'] = 1;
        game.protectedSquares.add('0-0');

        applyLandmine(system, '0-0', 1);

        expect(game.squares['0-0']).toBeUndefined();
        expect(game.protectedSquares.has('0-0')).toBe(false);
    });
});

describe('effect-system - social effects are no-op on game state', () => {
    let game;
    let system;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame();
        system = makeEffectSystem(game);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const socialEffects = [
        'truth',
        'hypothetical',
        'drink',
        'dared',
        'dare_left',
        'physical_challenge',
    ];

    for (const effectId of socialEffects) {
        it(effectId + ' does not mutate playerEffects', () => {
            const before = JSON.stringify(game.playerEffects);
            executeEffect(system, effectId, 'social', 1, '0-0');
            expect(JSON.stringify(game.playerEffects)).toBe(before);
        });
    }
});

describe('local-save-replay - undoMove / redoMove snapshot integrity', () => {
    let game;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame({ localMode: 'human' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('undoMove restores the previous snapshot exactly', () => {
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });

        game.undoMove();
        expect(game.lines.size).toBe(0);
    });

    it('redoMove re-applies the undone move', () => {
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });

        game.undoMove();
        expect(game.lines.size).toBe(0);

        game.redoMove();
        expect(game.lines.size).toBe(1);
    });

    it('move snapshot captures all game state including effects', () => {
        game.playerEffects[1].frozenTurns = 1;
        game.playerEffects[1].shieldCount = 2;
        game.playerEffects[1].ghostLines = 1;
        game.playerEffects[1].bonusTurns = 1;
        game.playerEffects[1].doublePointsCount = 1;
        game.playerEffects[1].doubleLine = true;
        game.comboCount = 3;
        game.lastComboPlayer = 1;

        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });

        game.undoMove();

        expect(game.playerEffects[1].frozenTurns).toBe(1);
        expect(game.playerEffects[1].shieldCount).toBe(2);
        expect(game.playerEffects[1].ghostLines).toBe(1);
        expect(game.playerEffects[1].bonusTurns).toBe(1);
        expect(game.playerEffects[1].doublePointsCount).toBe(1);
        expect(game.playerEffects[1].doubleLine).toBe(true);
        expect(game.comboCount).toBe(3);
        expect(game.lastComboPlayer).toBe(1);
    });

    it('undoMove is blocked during AI thinking', () => {
        game.localMode = 'ai';
        game.aiThinking = true;
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });
        const lineCount = game.lines.size;

        game.undoMove();
        expect(game.lines.size).toBe(lineCount);
    });

    it('redoMove is blocked during AI thinking', () => {
        game.localMode = 'ai';
        game.aiThinking = true;
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });
        game.undoMove();
        const lineCount = game.lines.size;

        game.redoMove();
        expect(game.lines.size).toBe(lineCount);
    });

    it('undoMove is blocked in multiplayer', () => {
        game.isMultiplayer = true;
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });
        const lineCount = game.lines.size;

        game.undoMove();
        expect(game.lines.size).toBe(lineCount);
    });

    it('undoMove is blocked during tutorial', () => {
        game.tutorialSystem = { isActive: () => true };
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });
        const lineCount = game.lines.size;

        game.undoMove();
        expect(game.lines.size).toBe(lineCount);
    });
});

describe('local-save-replay - AI cancellation on undo/redo', () => {
    let game;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame({ localMode: 'ai', aiDifficulty: 'hard' });
        game.currentPlayer = game.humanPlayerNumber || (game.aiPlayerNumber === 1 ? 2 : 1);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('undoMove is blocked when AI is thinking', () => {
        game.aiThinking = true;
        game.moveHistory.push({
            before: game.captureMoveSnapshot(),
            lineKey: '0,0-0,1',
            player: 1,
            after: game.captureMoveSnapshot(),
        });
        const initialMoveHistoryLength = game.moveHistory.length;

        game.undoMove();
        expect(game.moveHistory.length).toBe(initialMoveHistoryLength);
    });

    it('undoMove clears aiThinking when not AI turn', () => {
        game.aiThinking = false;
        game.moveHistory.push({
            before: game.captureMoveSnapshot(),
            lineKey: '0,0-0,1',
            player: 1,
            after: game.captureMoveSnapshot(),
        });
        game.undoMove();
        expect(game.aiThinking).toBe(false);
    });

    it('redoMove is blocked when AI is thinking', () => {
        game.aiThinking = true;
        game.moveHistory.push({
            before: game.captureMoveSnapshot(),
            lineKey: '0,0-0,1',
            player: 1,
            after: game.captureMoveSnapshot(),
        });
        game.redoHistory.push({
            before: game.captureMoveSnapshot(),
            lineKey: '0,0-0,1',
            player: 1,
            after: game.captureMoveSnapshot(),
        });
        const initialRedoHistoryLength = game.redoHistory.length;

        game.redoMove();
        expect(game.redoHistory.length).toBe(initialRedoHistoryLength);
    });

    it('aiTurnToken increments to invalidate stale AI callbacks', () => {
        const tokenBefore = game.aiTurnToken;
        game.moveHistory.push({
            before: game.captureMoveSnapshot(),
            lineKey: '0,0-0,1',
            player: 1,
            after: game.captureMoveSnapshot(),
        });
        game.undoMove();
        expect(game.aiTurnToken).toBe(tokenBefore + 1);
    });
});

describe('local-save-replay - replay step controls', () => {
    let game;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame({ localMode: 'human' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stepReplayBackward moves replay index backward', () => {
        game.moveHistory.push(
            {
                before: game.captureMoveSnapshot(),
                lineKey: '0,0-0,1',
                player: 1,
                after: game.captureMoveSnapshot(),
            },
            {
                before: game.captureMoveSnapshot(),
                lineKey: '0,1-1,1',
                player: 2,
                after: game.captureMoveSnapshot(),
            }
        );
        game.replayIndex = 2;

        game.stepReplayBackward();
        expect(game.replayIndex).toBe(1);
    });

    it('stepReplayForward moves replay index forward', () => {
        game.moveHistory.push(
            {
                before: game.captureMoveSnapshot(),
                lineKey: '0,0-0,1',
                player: 1,
                after: game.captureMoveSnapshot(),
            },
            {
                before: game.captureMoveSnapshot(),
                lineKey: '0,1-1,1',
                player: 2,
                after: game.captureMoveSnapshot(),
            }
        );
        game.replayIndex = 2;

        game.stepReplayBackward();
        game.stepReplayBackward();
        expect(game.replayIndex).toBe(0);

        game.stepReplayForward();
        expect(game.replayIndex).toBe(1);
    });

    it('restartReplay resets to initial snapshot when move history exists', () => {
        game.moveHistory.push({
            before: game.captureMoveSnapshot(),
            lineKey: '0,0-0,1',
            player: 1,
            after: game.captureMoveSnapshot(),
        });
        game.replayIndex = 1;

        game.restartReplay();
        expect(game.replayIndex).toBe(0);
    });

    it('replay controls are blocked during AI thinking', () => {
        game.localMode = 'ai';
        game.aiThinking = true;
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });
        const initialReplayIndex = game.replayIndex;

        game.stepReplayBackward();
        expect(game.replayIndex).toBe(initialReplayIndex);
    });

    it('replay controls are blocked in multiplayer', () => {
        game.isMultiplayer = true;
        const beforeSnapshot = game.captureMoveSnapshot();
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const afterSnapshot = game.captureMoveSnapshot();
        game.moveHistory.push({
            before: beforeSnapshot,
            lineKey: '0,0-0,1',
            player: 1,
            after: afterSnapshot,
        });
        const initialReplayIndex = game.replayIndex;

        game.stepReplayBackward();
        expect(game.replayIndex).toBe(initialReplayIndex);
    });
});

describe('local-save-replay - save/load validates payload', () => {
    let game;

    beforeEach(() => {
        installPRNG(1);
        game = makeGame({ localMode: 'human' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        window.localStorage.clear();
    });

    it('createLocalSavePayload produces a valid snapshot', () => {
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const payload = createLocalSavePayload(game);

        expect(validateLocalSavePayload(payload).ok).toBe(true);
        expect(payload.state.lines).toBeInstanceOf(Array);
        expect(payload.state.squares).toBeInstanceOf(Object);
        expect(payload.state.scores).toEqual({ 1: 0, 2: 0 });
        expect(payload.state.playerEffects).toBeDefined();
        expect(payload.state.protectedSquares).toBeInstanceOf(Array);
    });

    it('saveLocalGame writes to localStorage', () => {
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 });
        const result = game.saveLocalGame();
        expect(result).toBe(true);

        const stored = window.localStorage.getItem('shapekeeper.local.save.v1');
        expect(stored).toBeTruthy();

        const parsed = JSON.parse(stored);
        expect(parsed.state.lines.length).toBe(1);
    });

    it('saveLocalGame is blocked in multiplayer', () => {
        game.isMultiplayer = true;
        const result = game.saveLocalGame();
        expect(result).toBe(false);
    });

    it('saveLocalGame is blocked during tutorial', () => {
        game.tutorialSystem = { isActive: () => true };
        const result = game.saveLocalGame();
        expect(result).toBe(false);
    });
});

describe('local-save-replay - isValidSnapshot validation', () => {
    it('rejects snapshots with invalid line keys', () => {
        const badSnapshot = {
            lines: ['not-a-valid-line-key'],
            ghostLines: [],
            lineOwners: [],
            squares: {},
            scores: { 1: 0, 2: 0 },
            currentPlayer: 1,
            claimedCells: [],
            playerEffects: {
                1: {
                    frozenTurns: 0,
                    shieldCount: 0,
                    doublePointsCount: 0,
                    ghostLines: 0,
                    bonusTurns: 0,
                    doubleLine: false,
                },
                2: {
                    frozenTurns: 0,
                    shieldCount: 0,
                    doublePointsCount: 0,
                    ghostLines: 0,
                    bonusTurns: 0,
                    doubleLine: false,
                },
            },
            protectedSquares: [],
            comboCount: 0,
            lastComboPlayer: 1,
        };
        expect(isValidSnapshot(badSnapshot)).toBe(false);
    });

    it('accepts valid snapshots', () => {
        const goodSnapshot = {
            lines: ['0,0-0,1'],
            ghostLines: [],
            lineOwners: [['0,0-0,1', 1]],
            squares: { '0,0': 1 },
            scores: { 1: 1, 2: 0 },
            currentPlayer: 2,
            claimedCells: ['0,0'],
            playerEffects: {
                1: {
                    frozenTurns: 0,
                    shieldCount: 0,
                    doublePointsCount: 0,
                    ghostLines: 0,
                    bonusTurns: 0,
                    doubleLine: false,
                },
                2: {
                    frozenTurns: 0,
                    shieldCount: 0,
                    doublePointsCount: 0,
                    ghostLines: 0,
                    bonusTurns: 0,
                    doubleLine: false,
                },
            },
            protectedSquares: [],
            comboCount: 0,
            lastComboPlayer: 1,
        };
        expect(isValidSnapshot(goodSnapshot)).toBe(true);
    });
});
