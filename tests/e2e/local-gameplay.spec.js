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

async function getInteractionDiagnostics(page) {
    return page.evaluate(() => {
        const game = window.__shapeKeeperActiveGame;
        if (!game?.getInteractionDiagnostics) {
            throw new Error('Interaction diagnostics hook is unavailable');
        }

        return game.getInteractionDiagnostics();
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

    test('does not allow diagonal triangle lines while triangles are disabled', async ({ page }) => {
        await startLocalGame(page);

        const hasTouch = Boolean(test.info().project.use.hasTouch);
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);

        await drawUsingPrimaryInput(
            page,
            { x: offsetX, y: offsetY },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY + cellSize },
            { hasTouch }
        );

        await expect
            .poll(() => getInteractionDiagnostics(page))
            .toMatchObject({
                selectedDot: { row: 0, col: 0 },
                trianglesCount: 0,
                disableTriangles: true,
            });

        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                    turnText: document.getElementById('turnIndicator')?.textContent,
                }))
            )
            .toEqual({
                lineCount: 0,
                turnText: "Player 1's Turn",
            });
    });

    test('exposes stronger mobile interaction affordances and disables triangles/party mode', async ({
        page,
    }) => {
        test.skip(!test.info().project.use.hasTouch, 'Touch-enabled project required');

        await startLocalGame(page);

        const { offsetX, offsetY } = await getCanvasGeometry(page);
        const diagnostics = await getInteractionDiagnostics(page);

        expect(diagnostics.isTouchDevice).toBe(true);
        expect(diagnostics.selectionRadiusMultiplier).toBeGreaterThan(0.5);
        expect(diagnostics.staticDotRadiusPx).toBeGreaterThanOrEqual(4);
        expect(diagnostics.disableTriangles).toBe(true);
        expect(diagnostics.partyModeEnabled).toBe(false);
        expect(diagnostics.trianglesCount).toBe(0);

        const canvas = page.locator('#gameCanvas');
        await canvas.tap({
            position: {
                x: offsetX + 16,
                y: offsetY + 16,
            },
        });

        await expect
            .poll(() => getInteractionDiagnostics(page))
            .toMatchObject({
                selectedDot: { row: 0, col: 0 },
                disableTriangles: true,
                partyModeEnabled: false,
            });
    });
});
