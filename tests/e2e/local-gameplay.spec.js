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

test.describe('local gameplay canvas input', () => {
    test('draws a line via mouse clicks on adjacent dots', async ({ page }) => {
        await startLocalGame(page);

        const canvas = page.locator('#gameCanvas');
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);

        await canvas.click({ position: { x: offsetX, y: offsetY } });

        await expect
            .poll(() =>
                page.evaluate(() => ({
                    selectedDot: window.__shapeKeeperActiveGame?.selectedDot,
                }))
            )
            .toEqual({ selectedDot: { row: 0, col: 0 } });

        await canvas.click({ position: { x: offsetX + cellSize, y: offsetY } });

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

    test('draws a line via touch interactions on adjacent dots', async ({ page }) => {
        await startLocalGame(page);

        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);

        await page.evaluate(
            async ({ firstDot, secondDot }) => {
                const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                const canvas = document.getElementById('gameCanvas');
                const rect = canvas.getBoundingClientRect();

                const dispatchTouch = async (point, identifier) => {
                    const startEvent = new Event('touchstart', {
                        bubbles: true,
                        cancelable: true,
                    });
                    Object.defineProperty(startEvent, 'changedTouches', {
                        configurable: true,
                        value: [
                            {
                                clientX: rect.left + point.x,
                                clientY: rect.top + point.y,
                                identifier,
                            },
                        ],
                    });
                    canvas.dispatchEvent(startEvent);

                    await wait(60);

                    const endEvent = new Event('touchend', {
                        bubbles: true,
                        cancelable: true,
                    });
                    Object.defineProperty(endEvent, 'changedTouches', {
                        configurable: true,
                        value: [
                            {
                                clientX: rect.left + point.x,
                                clientY: rect.top + point.y,
                                identifier,
                            },
                        ],
                    });
                    canvas.dispatchEvent(endEvent);
                };

                await dispatchTouch(firstDot, 1);
                await wait(60);
                await dispatchTouch(secondDot, 2);
            },
            {
                firstDot: { x: offsetX, y: offsetY },
                secondDot: { x: offsetX + cellSize, y: offsetY },
            }
        );

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