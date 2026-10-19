/**
 * ShapeKeeper - Levels Progress & Sprite Collection Manager
 *
 * Persists level unlocks (1..25), grid progression, and collected background sprites.
 * Key invariants:
 * - Max level = 25.
 * - Level 1 starts with 3x3 grid and only 1 colorful sprite in the background.
 * - Grid increases by 1x every 5 levels, maxing out at 7x5.
 * - +1 sprite per win (even if all levels are completed).
 * - Default visual sprites (120) on game launch are only displayed until the first "Levels" game is played.
 * - Once "Levels" is triggered, all colorful background sprites are removed and added as players win levels.
 */

export const MAX_LEVEL = 25;
export const STORAGE_KEY = 'shapekeeper_levels_progress.v1';
export const BASE_LEVEL_TURN_DURATION_SECONDS = 7;
export const SECONDS_PER_COMPLETED_LEVEL = 2;

export function getTurnDurationForLevel(completedCountOverride) {
    const completedCount = Number.isFinite(completedCountOverride)
        ? Math.max(0, Math.floor(completedCountOverride))
        : LevelsProgress.getState().completedLevels.length;
    return BASE_LEVEL_TURN_DURATION_SECONDS + completedCount * SECONDS_PER_COMPLETED_LEVEL;
}

export function getGridSizeForLevel(level) {
    const lvl = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
    const tier = Math.floor((lvl - 1) / 5); // 0 for 1-5, 1 for 6-10, 2 for 11-15, 3 for 16-20, 4 for 21-25
    const cols = 3 + tier; // 3, 4, 5, 6, 7
    const rows = Math.min(5, 3 + tier); // 3, 4, 5, 5, 5
    return { cols, rows };
}

function getInitialState() {
    return {
        levelsTriggered: false,
        unlockedLevel: 1,
        completedLevels: [],
        spritesObtained: 0,
    };
}

export class LevelsProgress {
    static getState() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return getInitialState();
        }

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return getInitialState();
            const parsed = JSON.parse(raw);
            return {
                levelsTriggered: Boolean(parsed.levelsTriggered),
                unlockedLevel: Math.max(1, Math.min(MAX_LEVEL, Number(parsed.unlockedLevel) || 1)),
                completedLevels: Array.isArray(parsed.completedLevels)
                    ? parsed.completedLevels
                    : [],
                spritesObtained: Math.max(
                    parsed.levelsTriggered ? 1 : 0,
                    Number(parsed.spritesObtained) || 0
                ),
            };
        } catch {
            return getInitialState();
        }
    }

    static saveState(state) {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('[LevelsProgress] Failed to save state to localStorage:', e);
        }
    }

    /**
     * Called when the user launches their first "Levels" match.
     * Clears default visual sprites down to 1 colorful sprite for Level 1.
     */
    static triggerLevelsMode() {
        const state = this.getState();
        if (!state.levelsTriggered) {
            state.levelsTriggered = true;
            if (state.spritesObtained < 1) {
                state.spritesObtained = 1; // Level 1 starts with 1 colorful sprite
            }
            this.saveState(state);
        }
        return state;
    }

    /**
     * Called when a player wins a game in Levels mode.
     * Unlocks the next level (up to 25) and awards +1 permanent colorful sprite.
     */
    static recordLevelWin(level) {
        const state = this.getState();
        state.levelsTriggered = true;
        if (state.spritesObtained < 1) {
            state.spritesObtained = 1;
        }

        // Award +1 sprite on every win
        state.spritesObtained += 1;

        const lvlNum = Number(level) || 1;
        if (!state.completedLevels.includes(lvlNum)) {
            state.completedLevels.push(lvlNum);
            state.completedLevels.sort((a, b) => a - b);
        }

        if (lvlNum >= state.unlockedLevel && state.unlockedLevel < MAX_LEVEL) {
            state.unlockedLevel = Math.min(MAX_LEVEL, lvlNum + 1);
        }

        this.saveState(state);
        return state;
    }

    static isLevelUnlocked(level) {
        const state = this.getState();
        return level <= state.unlockedLevel;
    }

    static isLevelCompleted(level) {
        const state = this.getState();
        return state.completedLevels.includes(Number(level));
    }
}
