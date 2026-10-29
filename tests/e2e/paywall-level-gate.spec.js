import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';

const PROGRESS_KEY = 'shapekeeper_levels_progress.v1';

async function bootNotEntitledAtLevel19(page) {
    await gotoApp(page);
    await page.evaluate(
        ({ key }) => {
            localStorage.setItem(
                key,
                JSON.stringify({
                    levelsTriggered: true,
                    unlockedLevel: 19,
                    completedLevels: [],
                    spritesObtained: 5,
                    entitled: false,
                })
            );
        },
        { key: PROGRESS_KEY }
    );
    await page.reload();
    await expect(page.locator('#levelsMenuBtn')).toBeVisible();
}

test.describe('Paywall gate on level entry', () => {
    test('a draw on the last free level opens the unlock gate instead of level 20', async ({
        page,
    }) => {
        await bootNotEntitledAtLevel19(page);

        // The paywall is on in the deployed config; the gate only exists then.
        expect(await page.evaluate(() => window.PAYWALL_ENABLED)).toBe(true);

        await page.locator('#levelsMenuBtn').click();
        await expect(page.locator('#levelsScreen')).toBeVisible();
        await expect(page.locator('[data-level="19"]')).toHaveClass(/level-btn unlocked/);
        await expect(page.locator('[data-level="20"]')).toHaveClass(/level-btn locked/);

        await page.locator('[data-level="19"]').click();
        await expect(page.locator('#gameScreen')).toBeVisible();

        // Force the 2-2 draw that the owner ruled a win.
        const result = await page.evaluate(async () => {
            const game = window.__shapeKeeperActiveGame;
            game.localTurnTimer?.pause?.();
            game.scores = { 1: 2, 2: 2 };
            game.uiManager.showWinner();
            await new Promise((resolve) => setTimeout(resolve, 200));
            return {
                level: game.currentLevel,
                next: game._nextLevelToPlay,
                button: document.getElementById('playAgain')?.textContent,
            };
        });

        expect(result.level).toBe(19);
        expect(result.next).toBe(20);
        // The button must not promise a level the player cannot enter.
        expect(result.button).toContain('Unlock Level 20');

        await page.locator('#playAgain').click();

        await expect(page.getByTestId('unlock-gate')).toBeVisible();
        const stillPlaying = await page.evaluate(
            () => window.__shapeKeeperActiveGame?.currentLevel ?? null
        );
        expect(stillPlaying).toBe(19);
    });
});
