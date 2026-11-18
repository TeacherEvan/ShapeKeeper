import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';

const PROGRESS_KEY = 'shapekeeper_levels_progress.v1';

async function bootWithProgress(page) {
    await gotoApp(page);
    await page.evaluate((key) => {
        localStorage.setItem(
            key,
            JSON.stringify({
                levelsTriggered: true,
                unlockedLevel: 100,
                completedLevels: [],
                spritesObtained: 5,
                entitled: true,
            })
        );
    }, PROGRESS_KEY);
    await page.reload();
    await expect(page.locator('#levelsMenuBtn')).toBeVisible();
}

async function openLevels(page) {
    await page.locator('#levelsMenuBtn').click();
    await expect(page.locator('#levelsScreen')).toBeVisible();
}

async function startLevel(page, level) {
    await openLevels(page);
    await page.locator(`[data-level="${level}"]`).click();
    await expect(page.locator('#gameScreen')).toBeVisible();
}

test.describe('Mine penalties', () => {
    test('the level grid warns about mines from level 15 only', async ({ page }) => {
        await bootWithProgress(page);
        await openLevels(page);

        await expect(page.locator('[data-level="14"] .level-grid-label')).not.toContainText('💣');
        await expect(page.locator('[data-level="15"] .level-grid-label')).toContainText('💣 2');
        await expect(page.locator('[data-level="25"] .level-grid-label')).toContainText('💣 4');
        await expect(page.locator('[data-level="100"] .level-grid-label')).toContainText('💣 5');
        await expect(page.locator('[data-level="35"] .level-grid-label')).toContainText('💣 5');
    });

    test('level 14 seeds no mines and hides the chip', async ({ page }) => {
        await bootWithProgress(page);
        await startLevel(page, 14);

        await expect(page.getByTestId('mine-counter')).toBeHidden();

        const info = await page.evaluate(() => {
            const game = window.__shapeKeeperActiveGame;
            return {
                mineCount: game.mineCount,
                seeded: Object.keys(game.squareMultipliers).length,
            };
        });
        expect(info).toEqual({ mineCount: 0, seeded: 0 });
    });

    test('a capped board seeds five mines and counts them down', async ({ page }) => {
        await bootWithProgress(page);
        await startLevel(page, 35);

        await expect(page.locator('.toast-notification .toast-message')).toContainText(
            '5 hidden mines'
        );
        await expect(page.locator('#mineCounterCount')).toHaveText('5 hidden');

        const seeded = await page.evaluate(() => ({
            mineCount: window.__shapeKeeperActiveGame?.mineCount,
            entries: Object.keys(window.__shapeKeeperActiveGame?.squareMultipliers ?? {}).length,
        }));
        expect(seeded).toEqual({ mineCount: 5, entries: 5 });

        // Fire the first mine through the real move loop.
        const fired = await page.evaluate(async () => {
            const game = window.__shapeKeeperActiveGame;
            game.localMode = 'human';
            game.localTurnTimer?.pause?.();
            const key = Object.keys(game.squareMultipliers)[0];
            const [row, col] = key.split(',').map(Number);
            const edges = [
                [
                    { row, col },
                    { row, col: col + 1 },
                ],
                [
                    { row: row + 1, col },
                    { row: row + 1, col: col + 1 },
                ],
                [
                    { row, col },
                    { row: row + 1, col },
                ],
                [
                    { row, col: col + 1 },
                    { row: row + 1, col: col + 1 },
                ],
            ];
            for (const [a, b] of edges) await game.drawLine(a, b, { source: 'ai' });
            return {
                revealed: game.revealedMultipliers.size,
                chip: document.getElementById('mineCounterCount').textContent,
            };
        });

        const remaining = 5 - fired.revealed;
        expect(fired.chip).toBe(remaining === 0 ? 'board clear' : `${remaining} hidden`);
    });

    test('level 15 warns, marks a fired box with 💣 and counts the mines down', async ({
        page,
    }) => {
        await bootWithProgress(page);
        await startLevel(page, 15);

        await expect(page.locator('.toast-notification .toast-message')).toContainText(
            '2 hidden mines'
        );
        await expect(page.getByTestId('mine-counter')).toBeVisible();
        await expect(page.locator('#mineCounterCount')).toHaveText('2 hidden');

        // Claim the first seeded mine through the real move loop.
        const result = await page.evaluate(async () => {
            const game = window.__shapeKeeperActiveGame;
            game.localMode = 'human';
            game.localTurnTimer?.pause?.();

            const key = Object.keys(game.squareMultipliers)[0];
            const [row, col] = key.split(',').map(Number);
            const edges = [
                [
                    { row, col },
                    { row, col: col + 1 },
                ],
                [
                    { row: row + 1, col },
                    { row: row + 1, col: col + 1 },
                ],
                [
                    { row, col },
                    { row: row + 1, col },
                ],
                [
                    { row, col: col + 1 },
                    { row: row + 1, col: col + 1 },
                ],
            ];

            for (const [a, b] of edges) {
                await game.drawLine(a, b, { source: 'ai' });
            }

            return {
                key,
                revealed: [...game.revealedMultipliers],
                chip: document.getElementById('mineCounterCount').textContent,
            };
        });

        expect(result.revealed).toContain(result.key);

        const remaining = 2 - result.revealed.length;
        expect(result.chip).toBe(remaining === 0 ? 'board clear' : `${remaining} hidden`);
        await expect(page.locator('.penalty-stamp')).toHaveText('💣 −80%');

        // The renderer needs the mine flag to keep drawing the bomb marker.
        const marker = await page.evaluate((key) => {
            const game = window.__shapeKeeperActiveGame;
            const data = game.squareMultipliers[key];
            return {
                isMine: data?.isMine,
                value: data?.value,
                revealed: game.revealedMultipliers.has(key),
            };
        }, result.key);
        expect(marker).toEqual({ isMine: true, value: 0.2, revealed: true });
    });
});
