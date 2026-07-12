export const LOCAL_SAVE_STORAGE_KEY = 'shapekeeper.local.save.v1';
export const LOCAL_SAVE_VERSION = 1;

const LINE_KEY_PATTERN = /^\d+,\d+-\d+,\d+$/;
const CELL_KEY_PATTERN = /^\d+,\d+$/;
const AI_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const LOCAL_MODES = new Set(['human', 'ai']);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlayerNumber(value) {
    return Number.isInteger(value) && value >= 1 && value <= 99;
}

function isCellKey(value) {
    return typeof value === 'string' && CELL_KEY_PATTERN.test(value);
}

function isLineKey(value) {
    return typeof value === 'string' && LINE_KEY_PATTERN.test(value);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function validatePlayerEffects(effects) {
    if (!isPlainObject(effects)) {
        return false;
    }

    return ['1', '2'].every((playerKey) => {
        const player = effects[playerKey];
        return (
            isPlainObject(player) &&
            Number.isInteger(player.frozenTurns) &&
            Number.isInteger(player.shieldCount) &&
            Number.isInteger(player.doublePointsCount) &&
            Number.isInteger(player.ghostLines) &&
            Number.isInteger(player.bonusTurns) &&
            typeof player.doubleLine === 'boolean'
        );
    });
}

export function isValidSnapshot(snapshot) {
    if (!isPlainObject(snapshot)) {
        return false;
    }

    if (
        !Array.isArray(snapshot.lines) ||
        !snapshot.lines.every(isLineKey) ||
        !Array.isArray(snapshot.ghostLines) ||
        !snapshot.ghostLines.every(isLineKey)
    ) {
        return false;
    }

    if (
        !Array.isArray(snapshot.lineOwners) ||
        !snapshot.lineOwners.every(
            (entry) =>
                Array.isArray(entry) &&
                entry.length === 2 &&
                isLineKey(entry[0]) &&
                isPlayerNumber(entry[1])
        )
    ) {
        return false;
    }

    if (
        !isPlainObject(snapshot.squares) ||
        !Object.entries(snapshot.squares).every(
            ([cellKey, owner]) => isCellKey(cellKey) && isPlayerNumber(owner)
        )
    ) {
        return false;
    }

    if (
        !isPlainObject(snapshot.scores) ||
        !Number.isFinite(snapshot.scores[1]) ||
        !Number.isFinite(snapshot.scores[2]) ||
        !Number.isInteger(snapshot.currentPlayer) ||
        ![1, 2].includes(snapshot.currentPlayer)
    ) {
        return false;
    }

    if (
        !Array.isArray(snapshot.claimedCells) ||
        !snapshot.claimedCells.every(isCellKey) ||
        !validatePlayerEffects(snapshot.playerEffects) ||
        !Array.isArray(snapshot.protectedSquares) ||
        !snapshot.protectedSquares.every(isCellKey) ||
        !Number.isInteger(snapshot.comboCount) ||
        !Number.isInteger(snapshot.lastComboPlayer)
    ) {
        return false;
    }

    return true;
}

function validateMoveHistoryEntry(entry) {
    return (
        isPlainObject(entry) &&
        isValidSnapshot(entry.before) &&
        isValidSnapshot(entry.after) &&
        isLineKey(entry.lineKey) &&
        [1, 2].includes(entry.player)
    );
}

function normalizeGridSize(gridSize) {
    if (Number.isInteger(gridSize) && gridSize >= 4 && gridSize <= 60) {
        return gridSize;
    }

    if (
        isPlainObject(gridSize) &&
        Number.isInteger(gridSize.rows) &&
        Number.isInteger(gridSize.cols) &&
        gridSize.rows >= 4 &&
        gridSize.rows <= 60 &&
        gridSize.cols >= 4 &&
        gridSize.cols <= 60
    ) {
        return {
            rows: gridSize.rows,
            cols: gridSize.cols,
        };
    }

    return null;
}

function normalizeConfig(config) {
    if (!isPlainObject(config)) {
        return null;
    }

    const normalizedGridSize = normalizeGridSize(config.gridSize);
    if (!normalizedGridSize) {
        return null;
    }

    if (
        typeof config.player1Color !== 'string' ||
        typeof config.player2Color !== 'string' ||
        !LOCAL_MODES.has(config.localMode) ||
        !AI_DIFFICULTIES.has(config.aiDifficulty)
    ) {
        return null;
    }

    return {
        gridSize: normalizedGridSize,
        player1Color: config.player1Color,
        player2Color: config.player2Color,
        localMode: config.localMode,
        aiDifficulty: config.aiDifficulty,
    };
}

export function createLocalSavePayload(game) {
    return {
        mode: 'local',
        savedAt: new Date().toISOString(),
        version: LOCAL_SAVE_VERSION,
        config: {
            aiDifficulty: game.aiDifficulty,
            gridSize: game.gridSize,
            localMode: game.localMode,
            player1Color: game.player1Color,
            player2Color: game.player2Color,
        },
        replayIndex: game.replayIndex,
        state: game.captureMoveSnapshot(),
        initialSnapshot: clone(game.initialLocalSnapshot),
        moveHistory: clone(game.moveHistory),
        redoHistory: clone(game.redoHistory),
    };
}

export function validateLocalSavePayload(payload) {
    if (!isPlainObject(payload)) {
        return { ok: false, type: 'invalid', message: 'Saved game payload is not an object.' };
    }

    if (payload.version !== LOCAL_SAVE_VERSION) {
        return {
            ok: false,
            type: 'incompatible',
            message: `Saved game version ${payload.version ?? 'unknown'} is not supported.`,
        };
    }

    if (payload.mode !== 'local') {
        return { ok: false, type: 'invalid', message: 'Saved payload is not a local game state.' };
    }

    const config = normalizeConfig(payload.config);
    if (!config) {
        return { ok: false, type: 'invalid', message: 'Saved game configuration is invalid.' };
    }

    if (!isValidSnapshot(payload.state) || !isValidSnapshot(payload.initialSnapshot)) {
        return { ok: false, type: 'invalid', message: 'Saved game state snapshot is invalid.' };
    }

    if (
        !Array.isArray(payload.moveHistory) ||
        !payload.moveHistory.every(validateMoveHistoryEntry) ||
        !Array.isArray(payload.redoHistory) ||
        !payload.redoHistory.every(validateMoveHistoryEntry)
    ) {
        return { ok: false, type: 'invalid', message: 'Saved move history is invalid.' };
    }

    const replayIndex = Number.isInteger(payload.replayIndex)
        ? Math.max(0, Math.min(payload.replayIndex, payload.moveHistory.length))
        : payload.moveHistory.length;

    return {
        ok: true,
        payload: {
            version: LOCAL_SAVE_VERSION,
            mode: 'local',
            savedAt:
                typeof payload.savedAt === 'string' ? payload.savedAt : new Date().toISOString(),
            config,
            replayIndex,
            state: clone(payload.state),
            initialSnapshot: clone(payload.initialSnapshot),
            moveHistory: clone(payload.moveHistory),
            redoHistory: clone(payload.redoHistory),
        },
    };
}
