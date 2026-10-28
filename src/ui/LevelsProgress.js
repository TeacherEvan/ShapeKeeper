/**
 * ShapeKeeper - Levels Progress & Sprite Collection Manager
 *
 * Persists level progress (1..100), grid progression, and collected background sprites.
 * Key invariants:
 * - Max level = 100.
 * - Level 1 starts with 3x3 grid and only 1 colorful sprite in the background.
 * - Grid tiers:
 *   - Levels 1..25: scales by 1x every 5 levels, from 3x3 up to 7x5.
 *   - Levels 26..50: 6x8.
 *   - Levels 51..89: 8x8.
 *   - Levels 90..99: 10x10.
 *   - Level 100: 10x15.
 * - Turn timer scales by +2s per completed level, capped at 30s.
 * - Free edition: levels 1..FREE_LEVELS (19) are playable and unlock in order.
 *   Levels FREE_LEVELS+1..100 require an entitlement (one purchase unlocks all).
 * - A save with any progress past FREE_LEVELS, or a completed level above it, is
 *   grandfathered as entitled so existing players never lose access.
 * - Lose a level match: -1 sprite (floored at 1).
 * - Beating Level 100 unlocks the special fireworks sparkle easter egg.
 * - Default visual sprites (120) on game launch are only displayed until the first "Levels" game is played.
 * - Once "Levels" is triggered, all colorful background sprites are removed and added as players win levels.
 */

export const MAX_LEVEL = 100;
export const EASTER_EGG_LEVEL = 100;
export const STORAGE_KEY = 'shapekeeper_levels_progress.v1';
export const BASE_LEVEL_TURN_DURATION_SECONDS = 7;
export const SECONDS_PER_COMPLETED_LEVEL = 2;
export const MAX_LEVEL_TURN_DURATION_SECONDS = 30;
export const MIN_SPRITES_AFTER_TRIGGER = 1;
// Last level playable without a purchase. One purchase unlocks every level after it.
export const FREE_LEVELS = 19;

/**
 * The paywall is opt-in per deployment. While `window.PAYWALL_ENABLED` is not
 * true the game keeps its free, all-levels-open behaviour, so shipping this code
 * cannot lock anyone out of a level they can already reach.
 */
export function isPaywallOn() {
    return typeof window !== 'undefined' && window.PAYWALL_ENABLED === true;
}

export function getTurnDurationForLevel(completedCountOverride) {
    const completedCount = Number.isFinite(completedCountOverride)
        ? Math.max(0, Math.floor(completedCountOverride))
        : LevelsProgress.getState().completedLevels.length;
    return Math.min(
        MAX_LEVEL_TURN_DURATION_SECONDS,
        BASE_LEVEL_TURN_DURATION_SECONDS + completedCount * SECONDS_PER_COMPLETED_LEVEL
    );
}

export function getGridSizeForLevel(level) {
    const lvl = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
    if (lvl >= 100) return { cols: 10, rows: 15 };
    if (lvl >= 90) return { cols: 10, rows: 10 };
    if (lvl >= 51) return { cols: 8, rows: 8 };
    if (lvl >= 26) return { cols: 6, rows: 8 };

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
        entitled: false,
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
            const completedLevels = Array.isArray(parsed.completedLevels)
                ? parsed.completedLevels.map(Number).filter((n) => Number.isFinite(n) && n >= 1)
                : [];
            let unlockedLevel = Math.max(1, Math.min(MAX_LEVEL, Number(parsed.unlockedLevel) || 1));

            // Legacy save migration: if level 25 was completed but unlockedLevel was capped at 25
            if (completedLevels.includes(25) && unlockedLevel === 25 && MAX_LEVEL > 25) {
                unlockedLevel = 26;
            }

            // Grandfather any save that already reached past the free tier: a player who
            // played the 2026 donation edition must not be pushed behind a paywall.
            let entitled = parsed.entitled === true;
            if (!entitled) {
                const highestCompleted = completedLevels.length ? Math.max(...completedLevels) : 0;
                entitled = unlockedLevel > FREE_LEVELS || highestCompleted > FREE_LEVELS;
            }

            return {
                levelsTriggered: Boolean(parsed.levelsTriggered),
                unlockedLevel: entitled ? unlockedLevel : Math.min(unlockedLevel, FREE_LEVELS),
                completedLevels,
                spritesObtained: Math.max(
                    parsed.levelsTriggered ? MIN_SPRITES_AFTER_TRIGGER : 0,
                    Number(parsed.spritesObtained) || 0
                ),
                entitled,
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
            if (state.spritesObtained < MIN_SPRITES_AFTER_TRIGGER) {
                state.spritesObtained = MIN_SPRITES_AFTER_TRIGGER; // Level 1 starts with 1 colorful sprite
            }
            this.saveState(state);
        }
        return state;
    }

    /**
     * Called when a player wins a game in Levels mode.
     * Unlocks the next level (up to 100) and awards +1 permanent colorful sprite.
     */
    static recordLevelWin(level) {
        const state = this.getState();
        state.levelsTriggered = true;
        if (state.spritesObtained < MIN_SPRITES_AFTER_TRIGGER) {
            state.spritesObtained = MIN_SPRITES_AFTER_TRIGGER;
        }

        // Award +1 sprite on every win
        state.spritesObtained += 1;

        const hadEasterEggBefore = state.completedLevels.includes(EASTER_EGG_LEVEL);
        const lvlNum = Number(level) || 1;
        if (!state.completedLevels.includes(lvlNum)) {
            state.completedLevels.push(lvlNum);
            state.completedLevels.sort((a, b) => a - b);
        }

        // Progress can only climb to the free ceiling until the player is entitled.
        const ceiling = state.entitled || !isPaywallOn() ? MAX_LEVEL : FREE_LEVELS;
        if (lvlNum >= state.unlockedLevel && state.unlockedLevel < ceiling) {
            state.unlockedLevel = Math.min(ceiling, lvlNum + 1);
        }

        const easterEggJustUnlocked =
            !hadEasterEggBefore && state.completedLevels.includes(EASTER_EGG_LEVEL);
        state.easterEggJustUnlocked = easterEggJustUnlocked;

        this.saveState(state);
        return state;
    }

    /**
     * Called when a player loses a match in Levels mode (defeat or tie).
     * Deducts 1 sprite, floored at 1.
     */
    static recordLevelLoss(level) {
        const state = this.getState();
        state.levelsTriggered = true;
        const before = Math.max(MIN_SPRITES_AFTER_TRIGGER, state.spritesObtained);
        state.spritesObtained = Math.max(MIN_SPRITES_AFTER_TRIGGER, before - 1);
        this.saveState(state);
        return {
            state,
            spriteLost: state.spritesObtained < before,
            level: Number(level) || 1,
        };
    }

    static isLevelUnlocked(level) {
        const lvl = Number(level);
        if (!Number.isFinite(lvl) || lvl < 1 || lvl > MAX_LEVEL) return false;
        // Paywall off: free-for-all, identical to the donation edition.
        if (!isPaywallOn()) return true;
        const state = this.getState();
        if (state.entitled) return true;
        if (lvl > FREE_LEVELS) return false;
        return lvl <= state.unlockedLevel;
    }

    static isEntitled() {
        return this.getState().entitled;
    }

    /**
     * Record a purchase. One entitlement opens every level above the free tier.
     * The caller is responsible for having verified the licence with the seller.
     */
    static setEntitled(value = true) {
        const state = this.getState();
        state.entitled = Boolean(value);
        if (state.entitled) {
            state.unlockedLevel = Math.max(state.unlockedLevel, FREE_LEVELS + 1);
        }
        this.saveState(state);
        return state;
    }

    static isLevelCompleted(level) {
        const state = this.getState();
        return state.completedLevels.includes(Number(level));
    }

    static isEasterEggUnlocked(state = this.getState()) {
        return state.completedLevels.includes(EASTER_EGG_LEVEL);
    }
}
