const ACHIEVEMENT_STORAGE_KEY = 'shapekeeper.local.achievements.v1';
const ACHIEVEMENT_STORAGE_VERSION = 1;

const ACHIEVEMENT_DEFINITIONS = [
    {
        id: 'first_square',
        icon: '⬜',
        title: 'First Claim',
        description: 'Complete your first square in local play.',
    },
    {
        id: 'combo_3',
        icon: '⚡',
        title: 'Combo Starter',
        description: 'Reach a combo count of 3 or higher.',
    },
    {
        id: 'score_15',
        icon: '🎯',
        title: 'Score Hunter',
        description: 'Reach 15 points in a local match.',
    },
    {
        id: 'first_win',
        icon: '🏆',
        title: 'First Victory',
        description: 'Win a local match.',
    },
    {
        id: 'comeback_win',
        icon: '🔄',
        title: 'Comeback King',
        description: 'Win after trailing by 3 or more points.',
    },
];

const DEFINITION_BY_ID = new Map(ACHIEVEMENT_DEFINITIONS.map((achievement) => [achievement.id, achievement]));

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildDefaultStore() {
    return {
        version: ACHIEVEMENT_STORAGE_VERSION,
        unlocked: {},
    };
}

function validateAchievementStore(payload) {
    if (!isPlainObject(payload)) {
        return { ok: false, type: 'invalid', message: 'Achievement data is not an object.' };
    }

    if (payload.version !== ACHIEVEMENT_STORAGE_VERSION) {
        return {
            ok: false,
            type: 'incompatible',
            message: `Achievement data version ${payload.version ?? 'unknown'} is not supported.`,
        };
    }

    if (!isPlainObject(payload.unlocked)) {
        return { ok: false, type: 'invalid', message: 'Achievement unlock map is invalid.' };
    }

    const normalizedUnlocked = {};
    for (const [id, unlockedAt] of Object.entries(payload.unlocked)) {
        if (!DEFINITION_BY_ID.has(id) || typeof unlockedAt !== 'string') {
            return {
                ok: false,
                type: 'invalid',
                message: 'Achievement unlock entry is malformed.',
            };
        }
        normalizedUnlocked[id] = unlockedAt;
    }

    return {
        ok: true,
        payload: {
            version: ACHIEVEMENT_STORAGE_VERSION,
            unlocked: normalizedUnlocked,
        },
    };
}

export class AchievementSystem {
    static STORAGE_KEY = ACHIEVEMENT_STORAGE_KEY;

    constructor(storage = globalThis.window?.localStorage) {
        this.storage = storage;
        this.store = buildDefaultStore();
        this.loadIssue = null;
        this.matchStats = this.createInitialMatchStats();
        this.loadFromStorage();
    }

    createInitialMatchStats() {
        return {
            maxDeficitByPlayer: { 1: 0, 2: 0 },
        };
    }

    resetMatchStats() {
        this.matchStats = this.createInitialMatchStats();
    }

    getLoadIssue() {
        return this.loadIssue;
    }

    getAchievementDefinitions() {
        return ACHIEVEMENT_DEFINITIONS;
    }

    getUnlockedAchievements() {
        return ACHIEVEMENT_DEFINITIONS.filter((achievement) =>
            Object.prototype.hasOwnProperty.call(this.store.unlocked, achievement.id)
        ).map((achievement) => ({
            ...achievement,
            unlockedAt: this.store.unlocked[achievement.id],
        }));
    }

    loadFromStorage() {
        if (!this.storage) {
            return;
        }

        let rawPayload = null;
        try {
            rawPayload = this.storage.getItem(AchievementSystem.STORAGE_KEY);
        } catch (error) {
            console.error('[Achievements] Failed to read achievements:', error);
            this.loadIssue = {
                type: 'storage_error',
                message: 'Unable to read achievement progress from local storage.',
            };
            return;
        }

        if (!rawPayload) {
            return;
        }

        let parsedPayload = null;
        try {
            parsedPayload = JSON.parse(rawPayload);
        } catch (error) {
            console.error('[Achievements] Corrupted achievement payload:', error);
            this.loadIssue = {
                type: 'invalid',
                message: 'Achievement data is corrupted and was not loaded.',
            };
            return;
        }

        const validation = validateAchievementStore(parsedPayload);
        if (!validation.ok) {
            this.loadIssue = {
                type: validation.type,
                message: validation.message,
            };
            return;
        }

        this.store = validation.payload;
    }

    persist() {
        if (!this.storage) {
            return;
        }

        try {
            this.storage.setItem(AchievementSystem.STORAGE_KEY, JSON.stringify(this.store));
        } catch (error) {
            console.error('[Achievements] Failed to persist achievements:', error);
        }
    }

    unlock(id, unlockedAt = new Date().toISOString()) {
        if (!DEFINITION_BY_ID.has(id) || this.store.unlocked[id]) {
            return null;
        }

        this.store.unlocked[id] = unlockedAt;
        this.persist();
        return {
            ...DEFINITION_BY_ID.get(id),
            unlockedAt,
        };
    }

    updateDeficitTracking(scores) {
        const lead = scores[1] - scores[2];
        if (lead > 0) {
            this.matchStats.maxDeficitByPlayer[2] = Math.max(this.matchStats.maxDeficitByPlayer[2], lead);
            return;
        }

        if (lead < 0) {
            this.matchStats.maxDeficitByPlayer[1] = Math.max(this.matchStats.maxDeficitByPlayer[1], Math.abs(lead));
        }
    }

    onMoveResolved({ isMultiplayer, isTutorial = false, scores, completedSquaresCount, comboCount }) {
        if (isMultiplayer || isTutorial) {
            return [];
        }

        const unlocked = [];
        this.updateDeficitTracking(scores);

        if (completedSquaresCount > 0) {
            const firstSquare = this.unlock('first_square');
            if (firstSquare) unlocked.push(firstSquare);
        }

        if (comboCount >= 3) {
            const combo = this.unlock('combo_3');
            if (combo) unlocked.push(combo);
        }

        if (Math.max(scores[1], scores[2]) >= 15) {
            const scoreThreshold = this.unlock('score_15');
            if (scoreThreshold) unlocked.push(scoreThreshold);
        }

        return unlocked;
    }

    onGameOver({ isMultiplayer, isTutorial = false, scores }) {
        if (isMultiplayer || isTutorial) {
            return [];
        }

        this.updateDeficitTracking(scores);

        const winner = scores[1] > scores[2] ? 1 : scores[2] > scores[1] ? 2 : 0;
        if (winner === 0) {
            return [];
        }

        const unlocked = [];
        const firstWin = this.unlock('first_win');
        if (firstWin) unlocked.push(firstWin);

        if (this.matchStats.maxDeficitByPlayer[winner] >= 3) {
            const comeback = this.unlock('comeback_win');
            if (comeback) unlocked.push(comeback);
        }

        return unlocked;
    }
}

export { ACHIEVEMENT_DEFINITIONS };
