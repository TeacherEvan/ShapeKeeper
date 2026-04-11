import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

async function startTutorial(page) {
    await gotoApp(page);
    await page.getByTestId('local-play-button').click();
    await page.locator('.local-grid-btn[data-size="5"]').click();
    await page.getByTestId('local-tutorial-toggle').check();
    await page.locator('#startLocalGame').click();
    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
    await expect(page.getByTestId('tutorial-overlay')).toBeVisible();
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

test.describe('tutorial mode', () => {
    test('progresses through guided steps and resets into normal local play', async ({ page }) => {
        await startTutorial(page);
        const overlay = page.getByTestId('tutorial-overlay');
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);
        const canvas = page.locator('#gameCanvas');

        await expect(overlay).toHaveAttribute('data-tutorial-step', 'select-first-dot');
        await canvas.click({ position: { x: offsetX + cellSize, y: offsetY + cellSize } });
        await expect(overlay).toHaveAttribute('data-tutorial-step', 'select-first-dot');

        await canvas.click({ position: { x: offsetX, y: offsetY } });
        await expect(overlay).toHaveAttribute('data-tutorial-step', 'draw-first-line');

        await page.evaluate(async () => {
            await window.__shapeKeeperActiveGame?.drawLine(
                { row: 0, col: 0 },
                { row: 0, col: 1 }
            );
        });
        await expect(overlay).toHaveAttribute('data-tutorial-step', 'complete-square');

        await page.evaluate(async () => {
            await window.__shapeKeeperActiveGame?.drawLine(
                { row: 0, col: 1 },
                { row: 1, col: 1 }
            );
        });
        await expect(overlay).toHaveAttribute('data-tutorial-step', 'bonus-turn');
        await expect(page.getByTestId('tutorial-continue-button')).toBeVisible();

        await page.getByTestId('tutorial-continue-button').click();
        await expect(overlay).toBeHidden();
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? -1,
                    scoreOne: window.__shapeKeeperActiveGame?.scores?.[1] ?? -1,
                    tutorialActive:
                        window.__shapeKeeperActiveGame?.getInteractionDiagnostics?.()?.tutorial?.active ??
                        true,
                }))
            )
            .toEqual({ lineCount: 0, scoreOne: 0, tutorialActive: false });
    });

    test('supports tutorial skip and safe reset back to normal mode', async ({ page }) => {
        await startTutorial(page);
        const overlay = page.getByTestId('tutorial-overlay');
        await expect(overlay).toHaveAttribute('data-tutorial-step', 'select-first-dot');
        await page.getByTestId('tutorial-skip-button').click();

        await expect(overlay).toBeHidden();
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? -1,
                    tutorialActive:
                        window.__shapeKeeperTutorial?.getSnapshot?.()?.active ??
                        window.__shapeKeeperActiveGame?.getInteractionDiagnostics?.()?.tutorial?.active ??
                        true,
                }))
            )
            .toEqual({ lineCount: 0, tutorialActive: false });
    });

    test('supports exit tutorial and returns to main menu', async ({ page }) => {
        await startTutorial(page);
        await page.getByTestId('tutorial-exit-button').click();
        await expect(page.getByTestId('main-menu-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('tutorial-overlay')).toBeHidden();
    });
});
