import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

test.describe('Local turn timer', () => {
    test('configurable turn timer counts down and advances turn on expiry', async ({ page }) => {
        await page.clock.install();
        await gotoApp(page);

        await page.locator('#localPlayBtn').click();
        await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);

        const timerSection = page.locator('#localTurnTimerSection');
        await expect(timerSection).toBeVisible();

        const timerSelect = page.getByTestId('local-turn-timer');
        await expect(timerSelect).toHaveValue('15000');

        await timerSelect.selectOption('10000');

        await page.locator('#localSetupScreen .local-grid-btn[data-size="5"]').click();
        await page.locator('#startLocalGame').click();

        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
        await expect(page.locator('#turnIndicator')).toHaveText("Player 1's Turn");

        await page.clock.fastForward(11000);

        await expect(page.locator('#turnIndicator')).toHaveText("Player 2's Turn");
    });

    test('Off setting does not advance turn on idle', async ({ page }) => {
        await page.clock.install();
        await gotoApp(page);

        await page.locator('#localPlayBtn').click();
        await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);

        const timerSelect = page.getByTestId('local-turn-timer');
        await timerSelect.selectOption('0');

        await page.locator('#localSetupScreen .local-grid-btn[data-size="5"]').click();
        await page.locator('#startLocalGame').click();

        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
        await expect(page.locator('#turnIndicator')).toHaveText("Player 1's Turn");

        await page.clock.fastForward(120000);

        await expect(page.locator('#turnIndicator')).toHaveText("Player 1's Turn");
    });
});
