import { expect, test } from '@playwright/test';

import { gotoApp, installMockMultiplayer } from './helpers/bootstrap.js';

test.describe('multiplayer startup recovery', () => {
    test('shows timeout recovery actions, supports retry, and exits cleanly', async ({ page }) => {
        await gotoApp(page, { startupTimeoutMs: 250 });
        await installMockMultiplayer(page);

        await page.getByTestId('create-game-button').click();

        await expect(page.getByTestId('lobby-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('room-code')).toHaveText('ABC123');
        await expect(page.getByTestId('start-multiplayer-game')).toBeEnabled();

        await page.getByTestId('start-multiplayer-game').click();

        const overlay = page.getByTestId('startup-overlay');
        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
        await expect(overlay).toBeVisible();
        await expect(overlay).toHaveAttribute(
            'data-startup-phase',
            'awaiting_first_authoritative_state'
        );

        await expect(page.locator('#gameLoadingMessage')).toHaveText('Live match sync timed out.');
        await expect(overlay).toHaveAttribute('data-startup-phase', 'fatal_startup_failure');
        await expect(page.getByTestId('startup-retry-button')).toBeVisible();
        await expect(page.getByTestId('startup-leave-button')).toBeVisible();

        await page.getByTestId('startup-retry-button').click();
        await expect(overlay).toHaveAttribute(
            'data-startup-phase',
            'awaiting_first_authoritative_state'
        );
        await expect(page.locator('#gameLoadingHint')).toContainText('Retry attempt 1');

        await page.getByTestId('startup-leave-button').click();
        await expect(page.getByTestId('main-menu-screen')).toHaveClass(/active/);
        await expect(overlay).toHaveAttribute('data-startup-phase', 'idle');

        const testSnapshot = await page.evaluate(() => window.__shapeKeeperTest.getSnapshot());
        expect(testSnapshot.leaveRoomCalls).toBe(1);
        expect(testSnapshot.currentRoomId).toBeNull();
    });
});
