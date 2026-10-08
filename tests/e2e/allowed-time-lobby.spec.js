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
    test('host sets the countdown, guest sees it, and 0 means no limit', async ({ browser }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'TMG456',
            startupTimeoutMs: 1500,
        });

        const { hostPage, guestPage, generatedPasscode } = session;

        try {
            await hostPage.getByTestId('create-game-button').click();
            await expect(hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            const hostTurnDuration = hostPage.getByTestId('lobby-turn-duration');
            const guestTurnDuration = guestPage.getByTestId('lobby-turn-duration');

            // Default (legacy/unset room): the control starts at 10s.
            await expect(hostTurnDuration).toHaveValue('10');

            await guestPage.getByTestId('join-game-button').click();
            await expect(guestPage.getByTestId('join-screen')).toHaveClass(/active/);
            await guestPage.getByTestId('join-room-code-input').fill('TMG456');
            await guestPage.getByTestId('join-room-passcode-input').fill(generatedPasscode);
            await guestPage.getByTestId('join-player-name-input').fill('Guest');
            await guestPage.getByTestId('join-room-button').click();
            await expect(guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            // Host sets 45 seconds. The debounced handler (300ms) fires on change.
            await hostTurnDuration.fill('45');
            await hostTurnDuration.dispatchEvent('change');
            await expect(hostTurnDuration).toHaveValue('45', { timeout: 3000 });

            // The guest's lobby view reflects the host's value via the room snapshot.
            await expect(guestTurnDuration).toHaveValue('45', { timeout: 3000 });

            // Guests cannot edit the control (host-only).
            await expect(guestTurnDuration).toBeDisabled();

            // Host sets 0 = no limit.
            await hostTurnDuration.fill('0');
            await hostTurnDuration.dispatchEvent('change');
            await expect(hostTurnDuration).toHaveValue('0', { timeout: 3000 });
            await expect(guestTurnDuration).toHaveValue('0', { timeout: 3000 });

            // Server-side validation rejects out-of-range values (0..600).
            // The mock validates too, so the server error surfaces as a toast
            // and the input keeps the raw (invalid) value until the next
            // successful update.
            await hostTurnDuration.fill('9999');
            await hostTurnDuration.dispatchEvent('change');
            await expect(hostPage.getByText(/Error:|Invalid/)).toBeVisible({
                timeout: 3000,
            });
        } finally {
            await session.cleanup();
        }
    });
});
