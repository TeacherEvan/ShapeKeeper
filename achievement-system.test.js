import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { AchievementSystem } from './achievement-system.js';

describe('AchievementSystem', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('unlocks achievements from local move events and remains idempotent', () => {
        const system = new AchievementSystem(localStorage);

        const unlocked = system.onMoveResolved({
            isMultiplayer: false,
            scores: { 1: 15, 2: 0 },
            completedSquaresCount: 1,
            comboCount: 3,
        });

        expect(unlocked.map((entry) => entry.id).sort()).toEqual([
            'combo_3',
            'first_square',
            'score_15',
        ]);

        const secondPass = system.onMoveResolved({
            isMultiplayer: false,
            scores: { 1: 20, 2: 0 },
            completedSquaresCount: 2,
            comboCount: 5,
        });
        expect(secondPass).toEqual([]);
    });

    it('persists unlocked achievements to localStorage across instances', () => {
        const first = new AchievementSystem(localStorage);
        first.onMoveResolved({
            isMultiplayer: false,
            scores: { 1: 15, 2: 0 },
            completedSquaresCount: 1,
            comboCount: 3,
        });

        const reloaded = new AchievementSystem(localStorage);
        const unlockedIds = reloaded.getUnlockedAchievements().map((entry) => entry.id);
        expect(unlockedIds).toEqual(
            expect.arrayContaining(['first_square', 'combo_3', 'score_15'])
        );
    });

    it('tracks comeback wins deterministically', () => {
        const system = new AchievementSystem(localStorage);

        system.onMoveResolved({
            isMultiplayer: false,
            scores: { 1: 0, 2: 4 },
            completedSquaresCount: 0,
            comboCount: 0,
        });

        const unlocked = system.onGameOver({
            isMultiplayer: false,
            scores: { 1: 7, 2: 6 },
        });

        expect(unlocked.map((entry) => entry.id).sort()).toEqual(['comeback_win', 'first_win']);
    });

    it('surfaces invalid persisted payloads via load issue', () => {
        localStorage.setItem(
            AchievementSystem.STORAGE_KEY,
            '{"version":1,"unlocked":{"first_win":42}}'
        );
        const system = new AchievementSystem(localStorage);
        expect(system.getLoadIssue()).toEqual({
            type: 'invalid',
            message: 'Achievement unlock entry is malformed.',
        });
        expect(system.getUnlockedAchievements()).toEqual([]);
    });
});
