import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

/**
 * Local Allowed Time — the lava-timer countdown for hot-seat (friends on one
 * device) play, selected on the local setup screen. Mirrors the online
 * lobby control (tests/e2e/allowed-time-lobby.spec.js) for the local path.
 */

async function openLocalSetup(page) {
    await gotoApp(page);
    await page.locator('#localPlayBtn').click();
    await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
}

async function startLocalGameWithTimer(page, seconds) {
    await openLocalSetup(page);
    await page.getByTestId('local-turn-duration').fill(String(seconds));
    await page.locator('#localSetupScreen .local-grid-btn[data-size="5"]').click();
    await page.locator('#startLocalGame').click();
    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
}

test.describe('Local Allowed Time', () => {
    test('timer control is present, defaults to no limit, and accepts a value', async ({
        page,
    }) => {
        await openLocalSetup(page);

        const timer = page.getByTestId('local-turn-duration');
        await expect(timer).toBeVisible();
        await expect(timer).toHaveValue('0');

        await timer.fill('30');
        await expect(timer).toHaveValue('30');
    });

    test('selected seconds arm a countdown that skips the expired turn', async ({ page }) => {
        await startLocalGameWithTimer(page, 3);

        // The clock is armed shortly after the game starts.
        await expect
            .poll(() =>
                page.evaluate(() => window.__shapeKeeperActiveGame?.turnRemainingMs ?? null)
            )
            .toBeGreaterThan(0);

        // Without any move, the expired turn auto-skips to Player 2.
        await expect(page.locator('#turnIndicator')).toHaveText("Player 2's Turn", {
            timeout: 8000,
        });

        // Freeze the clock so the alternating skips don't race the assertion.
        await page.evaluate(() => {
            const game = window.__shapeKeeperActiveGame;
            if (game) game.turnDurationSeconds = 0;
        });

        await expect(page.locator('#turnIndicator')).toHaveText("Player 2's Turn");
        expect(await page.evaluate(() => window.__shapeKeeperActiveGame.currentPlayer)).toBe(2);
    });

    test('no limit (0) leaves the turn running indefinitely', async ({ page }) => {
        await startLocalGameWithTimer(page, 0);

        await page.waitForTimeout(2500);
        await expect(page.locator('#turnIndicator')).toHaveText("Player 1's Turn");
        expect(
            await page.evaluate(() => window.__shapeKeeperActiveGame?.turnRemainingMs ?? null)
        ).toBeNull();
    });
});
