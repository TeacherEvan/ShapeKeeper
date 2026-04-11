import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

async function selectLocalGridSize(page, size) {
    await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
    await page.evaluate((targetSize) => {
        document
            .querySelector(`#localSetupScreen .local-grid-btn[data-size="${targetSize}"]`)
            ?.click();
    }, size);
    await expect(page.locator(`#localSetupScreen .local-grid-btn[data-size="${size}"]`)).toHaveClass(
        /selected/
    );
    await expect(page.locator('#startLocalGame')).toBeEnabled();
}

async function startLocalGame(page) {
    await gotoApp(page);

    await page.locator('#localPlayBtn').click();
    await selectLocalGridSize(page, 5);
    await page.locator('#startLocalGame').click();

    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
    await expect(page.locator('#gameCanvas')).toBeVisible();
    await expect(page.locator('#turnIndicator')).toHaveText("Player 1's Turn");
}

async function startLocalAIGame(page, { difficulty = 'medium' } = {}) {
    await gotoApp(page);
    await page.locator('#localPlayBtn').click();
    await selectLocalGridSize(page, 5);
    await page.getByTestId('local-opponent-type').selectOption('ai');
    await page.getByTestId('local-ai-difficulty').selectOption(difficulty);
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
                x: offsetX,
                y: offsetY,
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

    test('allows selecting AI opponent and difficulty in local setup', async ({ page }) => {
        await gotoApp(page);
        await page.locator('#localPlayBtn').click();

        await expect(page.getByTestId('local-opponent-type')).toHaveValue('human');
        await expect(page.getByTestId('local-ai-difficulty')).toBeDisabled();

        await page.getByTestId('local-opponent-type').selectOption('ai');
        await expect(page.getByTestId('local-ai-difficulty')).toBeEnabled();
        await page.getByTestId('local-ai-difficulty').selectOption('hard');
        await selectLocalGridSize(page, 5);
        await page.locator('#startLocalGame').click();

        await expect
            .poll(() => getInteractionDiagnostics(page))
            .toMatchObject({
                localMode: 'ai',
                aiDifficulty: 'hard',
            });
    });

    test('AI takes its turn after a human local move', async ({ page }) => {
        await startLocalAIGame(page, { difficulty: 'easy' });
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);
        const hasTouch = Boolean(test.info().project.use.hasTouch);

        await drawUsingPrimaryInput(
            page,
            { x: offsetX, y: offsetY },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY },
            { hasTouch }
        );

        await expect
            .poll(() =>
                page.evaluate(() => ({
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                }))
            )
            .toEqual({ currentPlayer: 1, lineCount: 2 });
    });

    test('supports custom grid input for local games', async ({ page }) => {
        await gotoApp(page);
        await page.locator('#localPlayBtn').click();
        await page.locator('#localCustomGridSize').fill('12');
        await page.locator('#applyLocalCustomGrid').click();
        await page.locator('#startLocalGame').click();

        await expect
            .poll(() =>
                page.evaluate(() => ({
                    gridRows: window.__shapeKeeperActiveGame?.gridRows,
                    gridCols: window.__shapeKeeperActiveGame?.gridCols,
                    gridSize: window.__shapeKeeperActiveGame?.gridSize,
                }))
            )
            .toMatchObject({
                gridSize: 12,
            });
    });

    test('supports undo and redo in local mode', async ({ page }) => {
        await startLocalGame(page);
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);
        const hasTouch = Boolean(test.info().project.use.hasTouch);

        await drawUsingPrimaryInput(
            page,
            { x: offsetX, y: offsetY },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY },
            { hasTouch }
        );

        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                }))
            )
            .toEqual({ lineCount: 1, currentPlayer: 2 });

        await page.locator('#undoBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                }))
            )
            .toEqual({ lineCount: 0, currentPlayer: 1 });

        await page.locator('#redoBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                }))
            )
            .toEqual({ lineCount: 1, currentPlayer: 2 });
    });

    test('saves local game and loads it from local setup with validated payload path', async ({
        page,
    }) => {
        await startLocalGame(page);
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);
        const hasTouch = Boolean(test.info().project.use.hasTouch);

        await drawUsingPrimaryInput(
            page,
            { x: offsetX, y: offsetY },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY },
            { hasTouch }
        );

        await page.locator('#saveLocalBtn').click();

        await expect
            .poll(() =>
                page.evaluate(() => {
                    const raw = window.localStorage.getItem('shapekeeper.local.save.v1');
                    return raw ? JSON.parse(raw).version : null;
                })
            )
            .toBe(1);

        await page.locator('#exitGame').click();
        await page.locator('#localPlayBtn').click();
        await page.locator('#loadLocalGame').click();

        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                }))
            )
            .toEqual({ currentPlayer: 2, lineCount: 1 });
    });

    test('supports deterministic local replay step controls', async ({ page }) => {
        await startLocalGame(page);
        const { offsetX, offsetY, cellSize } = await getCanvasGeometry(page);
        const hasTouch = Boolean(test.info().project.use.hasTouch);

        await drawUsingPrimaryInput(
            page,
            { x: offsetX, y: offsetY },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + cellSize, y: offsetY + cellSize },
            { hasTouch }
        );
        await drawUsingPrimaryInput(
            page,
            { x: offsetX + 2 * cellSize, y: offsetY + cellSize },
            { hasTouch }
        );

        await expect
            .poll(() => page.evaluate(() => window.__shapeKeeperActiveGame?.lines?.size ?? 0))
            .toBe(2);

        await page.locator('#replayRestartBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                }))
            )
            .toEqual({ currentPlayer: 1, lineCount: 0 });

        await page.locator('#replayForwardBtn').click();
        await expect
            .poll(() => page.evaluate(() => window.__shapeKeeperActiveGame?.lines?.size ?? 0))
            .toBe(1);

        await page.locator('#replayForwardBtn').click();
        await expect
            .poll(() => page.evaluate(() => window.__shapeKeeperActiveGame?.lines?.size ?? 0))
            .toBe(2);

        await page.locator('#replayBackBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => ({
                    currentPlayer: window.__shapeKeeperActiveGame?.currentPlayer,
                    lineCount: window.__shapeKeeperActiveGame?.lines?.size ?? 0,
                }))
            )
            .toEqual({ currentPlayer: 2, lineCount: 1 });
    });
});
