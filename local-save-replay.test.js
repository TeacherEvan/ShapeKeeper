import { describe, expect, it } from 'vitest';

import {
    LOCAL_SAVE_VERSION,
    createLocalSavePayload,
    validateLocalSavePayload,
} from './local-save-replay.js';

function createSnapshot(currentPlayer = 1) {
    return {
        comboCount: 0,
        claimedCells: [],
        currentPlayer,
        ghostLines: [],
        lastComboPlayer: 0,
        lineOwners: [],
        lines: [],
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
        scores: { 1: 0, 2: 0 },
        squares: {},
        triangles: {},
        triangleCellOwners: [],
    };
}

describe('local save payload validation', () => {
    it('creates and validates versioned local payloads', () => {
        const initialSnapshot = createSnapshot(1);
        const afterSnapshot = {
            ...createSnapshot(2),
            lines: ['0,0-0,1'],
            lineOwners: [['0,0-0,1', 1]],
        };

        const game = {
            aiDifficulty: 'medium',
            gridSize: 5,
            localMode: 'human',
            player1Color: '#ff0000',
            player2Color: '#0000ff',
            replayIndex: 1,
            initialLocalSnapshot: initialSnapshot,
            moveHistory: [
                {
                    before: initialSnapshot,
                    after: afterSnapshot,
                    lineKey: '0,0-0,1',
                    player: 1,
                },
            ],
            redoHistory: [],
            captureMoveSnapshot: () => afterSnapshot,
        };

        const payload = createLocalSavePayload(game);
        expect(payload.version).toBe(LOCAL_SAVE_VERSION);

        const result = validateLocalSavePayload(payload);
        expect(result.ok).toBe(true);
        expect(result.payload.config.localMode).toBe('human');
        expect(result.payload.moveHistory).toHaveLength(1);
    });

    it('rejects incompatible payload versions', () => {
        const result = validateLocalSavePayload({
            mode: 'local',
            version: 999,
        });

        expect(result.ok).toBe(false);
        expect(result.type).toBe('incompatible');
    });

    it('rejects invalid payload history shape', () => {
        const validSnapshot = createSnapshot();
        const result = validateLocalSavePayload({
            mode: 'local',
            version: LOCAL_SAVE_VERSION,
            config: {
                gridSize: 5,
                player1Color: '#ff0000',
                player2Color: '#0000ff',
                localMode: 'human',
                aiDifficulty: 'medium',
            },
            replayIndex: 0,
            state: validSnapshot,
            initialSnapshot: validSnapshot,
            moveHistory: [{ before: validSnapshot, after: validSnapshot }],
            redoHistory: [],
        });

        expect(result.ok).toBe(false);
        expect(result.type).toBe('invalid');
    });
});
