import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';
import { ACHIEVEMENT_DEFINITIONS } from '../../achievement-system.js';

async function startLocalGame(page) {
    await gotoApp(page);
    await page.locator('#localPlayBtn').click();
    await page.locator('.local-grid-btn[data-size="5"]').click();
    await page.locator('#startLocalGame').click();
    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
}

test.describe('Achievement panel', () => {
    test('badge is empty on the main menu before any game starts', async ({
        page,
    }) => {
        await gotoApp(page);
        // Panel only renders after a game initializes; menu shows the static 0/0 markup.
        await expect(page.locator('#achievementCountBadge')).toHaveText('0/0');
    });

    test('panel renders unlocked achievements via the real render path', async ({
        page,
    }) => {
        await startLocalGame(page);

        // After a game starts the badge reflects the total definition count.
        await expect(page.locator('#achievementCountBadge')).toHaveText(
            `0/${ACHIEVEMENT_DEFINITIONS.length}`
        );

        // Unlock the first two real achievements, then call the genuine renderer.
        const unlockedCount = await page.evaluate((firstIds) => {
            const game = window.__shapeKeeperActiveGame;
            firstIds.forEach((id) => game.achievementSystem.unlock(id));
            game.renderAchievementPanel();
            return game.achievementSystem.getUnlockedAchievements().length;
        }, ACHIEVEMENT_DEFINITIONS.slice(0, 2).map((d) => d.id));

        await expect(page.locator('#achievementCountBadge')).toHaveText(
            `${unlockedCount}/${ACHIEVEMENT_DEFINITIONS.length}`
        );
        const items = page.locator('.achievement-item');
        await expect(items).toHaveCount(unlockedCount);
        await expect(items.first()).toContainText(
            ACHIEVEMENT_DEFINITIONS[0].title
        );
    });
});
