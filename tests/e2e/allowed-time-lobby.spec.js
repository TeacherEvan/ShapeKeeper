import { expect, test } from '@playwright/test';

import { createSharedMockMultiplayerPages } from './helpers/bootstrap.js';

/**
 * Allowed Time (lava-timer countdown) lobby control.
 *
 * The host sets a per-turn countdown in seconds via a free-form number
 * input in the lobby; the value round-trips through the (mocked) Convex
 * room and is reflected on the guest's lobby view. A value of 0 means
 * "no limit" — the turn clock is never armed.
 */
test.describe('Allowed Time lobby control', () => {
    test('host sets the countdown preset, guest sees it, and 0 means no limit', async ({
        browser,
    }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'TMG456',
            startupTimeoutMs: 1500,
        });

        const { hostPage, guestPage } = session;

        try {
            await hostPage.getByTestId('create-game-button').click();
            await expect(hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            const hostTurnTimer = hostPage.getByTestId('lobby-turn-timer');
            const guestTurnTimer = guestPage.getByTestId('lobby-turn-timer');

            // Default: 15 seconds (15000 ms).
            await expect(hostTurnTimer).toHaveValue('15000');

            await guestPage.getByTestId('join-game-button').click();
            await expect(guestPage.getByTestId('lobby-browser-screen')).toHaveClass(/active/);
            await guestPage.getByTestId('browser-player-name-input').fill('Guest');
            await guestPage.getByTestId('open-lobby-entry').first().click();
            await expect(guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            // Host sets 30 seconds (30000 ms).
            await hostTurnTimer.selectOption('30000');
            await expect(hostTurnTimer).toHaveValue('30000', { timeout: 3000 });
            await expect(guestTurnTimer).toHaveValue('30000', { timeout: 3000 });

            // Guests cannot edit the control (host-only).
            await expect(guestTurnTimer).toBeDisabled();

            // Host sets 0 = Off (no limit).
            await hostTurnTimer.selectOption('0');
            await expect(hostTurnTimer).toHaveValue('0', { timeout: 3000 });
            await expect(guestTurnTimer).toHaveValue('0', { timeout: 3000 });
        } finally {
            await session.cleanup();
        }
    });
});
