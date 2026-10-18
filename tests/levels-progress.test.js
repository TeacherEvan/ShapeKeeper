import { beforeEach, describe, expect, it } from 'vitest';
import {
    LevelsProgress,
    MAX_LEVEL,
    STORAGE_KEY,
    getGridSizeForLevel,
} from '../src/ui/LevelsProgress.js';

describe('LevelsProgress & Grid Progression', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('scales grid sizes every 5 levels from 3x3 up to 7x5', () => {
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

        // Levels 21-25: 7x5 (max grid size)
        expect(getGridSizeForLevel(21)).toEqual({ cols: 7, rows: 5 });
        expect(getGridSizeForLevel(25)).toEqual({ cols: 7, rows: 5 });
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

    it('recordLevelWin unlocks subsequent levels up to 25 and awards +1 sprite per win', () => {
        // Level 1 win
        let state = LevelsProgress.recordLevelWin(1);
        expect(state.levelsTriggered).toBe(true);
        expect(state.unlockedLevel).toBe(2);
        expect(state.completedLevels).toContain(1);
        expect(state.spritesObtained).toBe(2); // 1 initial + 1 win

        // Level 2 win
        state = LevelsProgress.recordLevelWin(2);
        expect(state.unlockedLevel).toBe(3);
        expect(state.spritesObtained).toBe(3);

        // Win level 24 -> unlocks 25
        state = LevelsProgress.recordLevelWin(24);
        expect(state.unlockedLevel).toBe(25);

        // Win level 25 -> stays at max level 25
        state = LevelsProgress.recordLevelWin(25);
        expect(state.unlockedLevel).toBe(MAX_LEVEL);
        expect(state.unlockedLevel).toBe(25);

        // Even after completing level 25, replaying awards additional sprites
        const spritesBefore = state.spritesObtained;
        state = LevelsProgress.recordLevelWin(25);
        expect(state.spritesObtained).toBe(spritesBefore + 1);
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
});
