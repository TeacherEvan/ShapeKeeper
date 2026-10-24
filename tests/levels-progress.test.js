import { beforeEach, describe, expect, it } from 'vitest';
import {
    EASTER_EGG_LEVEL,
    LevelsProgress,
    MAX_LEVEL,
    MAX_LEVEL_TURN_DURATION_SECONDS,
    STORAGE_KEY,
    getGridSizeForLevel,
    getTurnDurationForLevel,
} from '../src/ui/LevelsProgress.js';

describe('LevelsProgress & Grid Progression', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('scales grid sizes across all 5 tiers up to level 100', () => {
        // Levels 1-5: 3x3
        expect(getGridSizeForLevel(1)).toEqual({ cols: 3, rows: 3 });
        expect(getGridSizeForLevel(5)).toEqual({ cols: 3, rows: 3 });

        // Levels 6-10: 4x4
        expect(getGridSizeForLevel(6)).toEqual({ cols: 4, rows: 4 });
        expect(getGridSizeForLevel(10)).toEqual({ cols: 4, rows: 4 });

        // Levels 11-15: 5x5
        expect(getGridSizeForLevel(11)).toEqual({ cols: 5, rows: 5 });
        expect(getGridSizeForLevel(15)).toEqual({ cols: 5, rows: 5 });

        // Levels 16-20: 6x5
        expect(getGridSizeForLevel(16)).toEqual({ cols: 6, rows: 5 });
        expect(getGridSizeForLevel(20)).toEqual({ cols: 6, rows: 5 });

        // Levels 21-25: 7x5
        expect(getGridSizeForLevel(21)).toEqual({ cols: 7, rows: 5 });
        expect(getGridSizeForLevel(25)).toEqual({ cols: 7, rows: 5 });

        // Levels 26-50: 6x8
        expect(getGridSizeForLevel(26)).toEqual({ cols: 6, rows: 8 });
        expect(getGridSizeForLevel(50)).toEqual({ cols: 6, rows: 8 });

        // Levels 51-89: 8x8
        expect(getGridSizeForLevel(51)).toEqual({ cols: 8, rows: 8 });
        expect(getGridSizeForLevel(89)).toEqual({ cols: 8, rows: 8 });

        // Levels 90-99: 10x10
        expect(getGridSizeForLevel(90)).toEqual({ cols: 10, rows: 10 });
        expect(getGridSizeForLevel(99)).toEqual({ cols: 10, rows: 10 });

        // Level 100: 10x15
        expect(getGridSizeForLevel(100)).toEqual({ cols: 10, rows: 15 });
    });

    it('starts with levelsTriggered: false and 0 sprites before Levels is played', () => {
        const state = LevelsProgress.getState();
        expect(state.levelsTriggered).toBe(false);
        expect(state.spritesObtained).toBe(0);
        expect(state.unlockedLevel).toBe(1);
    });

    it('triggerLevelsMode initializes 1 colorful sprite for Level 1', () => {
        const state = LevelsProgress.triggerLevelsMode();
        expect(state.levelsTriggered).toBe(true);
        expect(state.spritesObtained).toBe(1);
        expect(state.unlockedLevel).toBe(1);
    });

    it('recordLevelWin unlocks subsequent levels up to 100 and awards +1 sprite per win', () => {
        // Level 1 win
        let state = LevelsProgress.recordLevelWin(1);
        expect(state.levelsTriggered).toBe(true);
        expect(state.unlockedLevel).toBe(2);
        expect(state.completedLevels).toContain(1);
        expect(state.spritesObtained).toBe(2); // 1 initial + 1 win
        expect(state.easterEggJustUnlocked).toBe(false);

        // Level 2 win
        state = LevelsProgress.recordLevelWin(2);
        expect(state.unlockedLevel).toBe(3);
        expect(state.spritesObtained).toBe(3);

        // Win level 24 -> unlocks 25
        state = LevelsProgress.recordLevelWin(24);
        expect(state.unlockedLevel).toBe(25);

        // Win level 25 -> unlocks 26
        state = LevelsProgress.recordLevelWin(25);
        expect(state.unlockedLevel).toBe(26);

        // Win level 99 -> unlocks 100
        state = LevelsProgress.recordLevelWin(99);
        expect(state.unlockedLevel).toBe(100);
        expect(state.easterEggJustUnlocked).toBe(false);
        expect(LevelsProgress.isEasterEggUnlocked(state)).toBe(false);

        // Win level 100 -> stays at max level 100 and unlocks easter egg
        expect(EASTER_EGG_LEVEL).toBe(100);
        state = LevelsProgress.recordLevelWin(100);
        expect(state.unlockedLevel).toBe(MAX_LEVEL);
        expect(state.unlockedLevel).toBe(100);
        expect(state.easterEggJustUnlocked).toBe(true);
        expect(LevelsProgress.isEasterEggUnlocked(state)).toBe(true);

        // Replaying level 100 awards additional sprites but does not re-trigger easter egg announcement
        const spritesBefore = state.spritesObtained;
        state = LevelsProgress.recordLevelWin(100);
        expect(state.spritesObtained).toBe(spritesBefore + 1);
        expect(state.easterEggJustUnlocked).toBe(false);
    });

    it('keeps every valid level open in the donation edition', () => {
        expect(LevelsProgress.isLevelUnlocked(1)).toBe(true);
        expect(LevelsProgress.isLevelUnlocked(25)).toBe(true);
        expect(LevelsProgress.isLevelUnlocked(26)).toBe(true);
        expect(LevelsProgress.isLevelUnlocked(100)).toBe(true);
        expect(LevelsProgress.isLevelUnlocked(0)).toBe(false);
        expect(LevelsProgress.isLevelUnlocked(101)).toBe(false);
    });

    it('recordLevelLoss decrements sprite count floored at 1', () => {
        LevelsProgress.triggerLevelsMode();
        LevelsProgress.recordLevelWin(1);
        LevelsProgress.recordLevelWin(2);
        let current = LevelsProgress.getState();
        expect(current.spritesObtained).toBe(3);

        // First loss: 3 -> 2
        let result = LevelsProgress.recordLevelLoss(2);
        expect(result.spriteLost).toBe(true);
        expect(result.state.spritesObtained).toBe(2);

        // Second loss: 2 -> 1
        result = LevelsProgress.recordLevelLoss(2);
        expect(result.spriteLost).toBe(true);
        expect(result.state.spritesObtained).toBe(1);

        // Third loss: floored at 1, spriteLost is false
        result = LevelsProgress.recordLevelLoss(2);
        expect(result.spriteLost).toBe(false);
        expect(result.state.spritesObtained).toBe(1);
    });

    it('migrates legacy saves that completed level 25 but were capped at 25', () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                levelsTriggered: true,
                unlockedLevel: 25,
                completedLevels: [25],
                spritesObtained: 26,
            })
        );

        const state = LevelsProgress.getState();
        expect(state.unlockedLevel).toBe(26);
    });

    it('persists progress and sprite counts to localStorage', () => {
        LevelsProgress.triggerLevelsMode();
        LevelsProgress.recordLevelWin(1);

        const raw = localStorage.getItem(STORAGE_KEY);
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw);
        expect(parsed.levelsTriggered).toBe(true);
        expect(parsed.unlockedLevel).toBe(2);
        expect(parsed.spritesObtained).toBe(2);
    });

    it('calculates turn duration starting at 7s, adding 2s per level, capped at 30s', () => {
        expect(MAX_LEVEL_TURN_DURATION_SECONDS).toBe(30);

        // 0 completed levels -> 7s
        expect(getTurnDurationForLevel(0)).toBe(7);

        // 1 completed level -> 9s
        expect(getTurnDurationForLevel(1)).toBe(9);

        // 2 completed levels -> 11s
        expect(getTurnDurationForLevel(2)).toBe(11);

        // 5 completed levels -> 17s
        expect(getTurnDurationForLevel(5)).toBe(17);

        // 11 completed levels -> 7 + 22 = 29s
        expect(getTurnDurationForLevel(11)).toBe(29);

        // 12 completed levels -> 7 + 24 = 31s -> capped at 30s
        expect(getTurnDurationForLevel(12)).toBe(30);

        // 25 completed levels -> capped at 30s
        expect(getTurnDurationForLevel(25)).toBe(30);

        // 99 completed levels -> capped at 30s
        expect(getTurnDurationForLevel(99)).toBe(30);
    });
});
