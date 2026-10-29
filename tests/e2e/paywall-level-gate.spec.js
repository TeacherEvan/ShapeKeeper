import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';

const PROGRESS_KEY = 'shapekeeper_levels_progress.v1';

async function seedProgress(page, overrides = {}) {
    await page.evaluate(
        ({ key, progress }) => {
            localStorage.setItem(key, JSON.stringify(progress));
        },
        {
            key: PROGRESS_KEY,
            progress: {
                levelsTriggered: true,
                unlockedLevel: 19,
                completedLevels: [],
                spritesObtained: 5,
                entitled: false,
                ...overrides,
            },
        }
    );
    await page.reload();
    await expect(page.locator('#levelsMenuBtn')).toBeVisible();
}

async function openLevel19(page) {
    await expect(page.locator('#levelsScreen')).toBeVisible();
    await page.locator('[data-level="19"]').click();
    await expect(page.locator('#gameScreen')).toBeVisible();
}

/** Force the 2-2 draw that the owner ruled a win, and report the result screen. */
async function forceDraw(page) {
    return page.evaluate(async () => {
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
}

test.describe('Paywall gate on level entry', () => {
    test('a draw on the last free level opens the unlock gate instead of level 20', async ({
        page,
    }) => {
        await gotoApp(page);
        await seedProgress(page);

        // The paywall is on in the deployed config; the gate only exists then.
        expect(await page.evaluate(() => window.PAYWALL_ENABLED)).toBe(true);

        await page.locator('#levelsMenuBtn').click();
        await expect(page.locator('#levelsScreen')).toBeVisible();
        await expect(page.locator('[data-level="19"]')).toHaveClass(/level-btn unlocked/);
        await expect(page.locator('[data-level="20"]')).toHaveClass(/level-btn locked/);

        await openLevel19(page);
        const draw = await forceDraw(page);
        expect(draw.level).toBe(19);
        expect(draw.next).toBe(20);
        // The button must not promise a level the player cannot enter.
        expect(draw.button).toContain('Unlock Level 20');

        await page.locator('#playAgain').click();

        await expect(page.getByTestId('unlock-gate')).toBeVisible();
        const stillPlaying = await page.evaluate(
            () => window.__shapeKeeperActiveGame?.currentLevel ?? null
        );
        expect(stillPlaying).toBe(19);
    });

    test('an entitled player gets Next Level (20) and starts it', async ({ page }) => {
        await gotoApp(page);
        await seedProgress(page, { entitled: true });

        await page.locator('#levelsMenuBtn').click();
        await expect(page.locator('#levelsScreen')).toBeVisible();

        await openLevel19(page);
        const draw = await forceDraw(page);
        expect(draw.button).toContain('Next Level (20)');

        await page.locator('#playAgain').click();
        await expect
            .poll(() => page.evaluate(() => window.__shapeKeeperActiveGame?.currentLevel ?? null))
            .toBe(20);
        await expect(page.getByTestId('unlock-gate')).toBeHidden();
    });

    test('with the paywall off every level is enterable', async ({ page }) => {
        await page.addInitScript(() => {
            window.PAYWALL_ENABLED = false;
        });
        await gotoApp(page);
        await seedProgress(page);

        expect(await page.evaluate(() => window.PAYWALL_ENABLED)).toBe(false);

        await page.locator('#levelsMenuBtn').click();
        await expect(page.locator('#levelsScreen')).toBeVisible();
        await expect(page.locator('[data-level="20"]')).toHaveClass(/level-btn unlocked/);

        await openLevel19(page);
        const draw = await forceDraw(page);
        expect(draw.button).toContain('Next Level (20)');
    });
});
