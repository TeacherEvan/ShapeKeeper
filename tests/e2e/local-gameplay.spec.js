import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

async function startLocalGame(page) {
    await gotoApp(page);

    await page.locator('#localPlayBtn').click();
    await page.locator('.local-grid-btn[data-size="5"]').click();
    await page.locator('#startLocalGame').click();

    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
    await expect(page.locator('#gameCanvas')).toBeVisible();
    await expect(page.locator('#turnIndicator')).toHaveText("Player 1's Turn");
}

async function getCanvasGeometry(page) {
    return page.evaluate(() => {
        const game = window.__shapeKeeperActiveGame;
        if (!game) {
            throw new Error('Active game test hook is unavailable');
        }

        return {
            cellSize: game.cellSize,
            offsetX: game.offsetX,
            offsetY: game.offsetY,
        };
    });
}

async function drawUsingPrimaryInput(page, position, { hasTouch }) {
    const canvas = page.locator('#gameCanvas');
    if (hasTouch) {
        await canvas.tap({ position });
        return;
    }
    await canvas.click({ position });
}

test.describe('local gameplay canvas input', () => {
    test('draws a line via the primary input for the active browser profile', async ({ page }) => {
        await startLocalGame(page);

        const hasTouch = Boolean(test.info().project.use.hasTouch);
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);

        await drawUsingPrimaryInput(
            page,
            { x: offsetX, y: offsetY },
            { hasTouch }
        );

        await expect
            .poll(() =>
                page.evaluate(() => ({
                    selectedDot: window.__shapeKeeperActiveGame?.selectedDot,
                }))
            )
            .toEqual({ selectedDot: { row: 0, col: 0 } });

        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY },
            { hasTouch }
        );

        await expect(page.locator('#turnIndicator')).toHaveText("Player 2's Turn");
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                    selectedDot: window.__shapeKeeperActiveGame?.selectedDot,
                }))
            )
            .toEqual({ lineCount: 1, selectedDot: null });
    });

    test('draws a line via native touch interactions on touch-enabled profiles', async ({ page }) => {
        test.skip(!test.info().project.use.hasTouch, 'Touch-enabled project required');

        await startLocalGame(page);

        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);
        const canvas = page.locator('#gameCanvas');

        await canvas.tap({ position: { x: offsetX, y: offsetY } });
        await canvas.tap({ position: { x: offsetX + cellSize, y: offsetY } });

        await expect(page.locator('#turnIndicator')).toHaveText("Player 2's Turn");
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                }))
            )
            .toEqual({ lineCount: 1 });
    });
});
