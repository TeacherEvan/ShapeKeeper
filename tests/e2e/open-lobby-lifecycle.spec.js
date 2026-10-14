import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';
import {
    createSharedMockMultiplayerPages,
    installSharedMockMultiplayer,
} from './helpers/bootstrap.js';

/**
 * Open lobby lifecycle.
 *
 * Closing the host's tab must not strand a zombie lobby in everyone's
 * JOIN LOBBY browser. convex-client.js fires a best-effort leaveRoom on
 * beforeunload (gated to lobby status, so mid-match reloads keep their
 * host); the sweepStaleLobbies cron backstops whatever the fire-and-forget
 * drops. These specs prove the client half end-to-end against the shared
 * mock backend.
 */
test.describe('open lobby lifecycle', () => {
    test('host closing the tab removes the lobby from the guest browser', async ({ browser }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'GHST99',
            startupTimeoutMs: 1500,
        });

        try {
            await session.hostPage.getByTestId('create-game-button').click();
            await expect(session.hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            await session.guestPage.getByTestId('join-game-button').click();
            await expect(session.guestPage.getByTestId('lobby-browser-screen')).toHaveClass(
                /active/
            );
            await expect(session.guestPage.getByTestId('open-lobby-entry')).toHaveCount(1);

            // Host closes the tab: beforeunload fires the lobby leave, the
            // room is deleted, and the guest's live list updates.
            // (runBeforeUnload: real browser closes fire it; Playwright's
            // page.close() skips it by default.)
            await session.hostPage.close({ runBeforeUnload: true });

            await expect(session.guestPage.getByTestId('open-lobby-entry')).toHaveCount(0);
            await expect(session.guestPage.getByTestId('open-lobbies-empty')).toBeVisible();
        } finally {
            await session.cleanup();
        }
    });

    test('multiple open lobbies are listed and join the right one', async ({ browser }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'MULTI1',
            startupTimeoutMs: 1500,
        });

        try {
            await session.hostPage.getByTestId('create-game-button').click();
            await expect(session.hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            // A second host opens another lobby on the same shared backend.
            const secondHost = await session.context.newPage();
            await gotoApp(secondHost, { startupTimeoutMs: 1500 });
            await installSharedMockMultiplayer(secondHost, {
                sessionId: 'session_host2',
                defaultPlayerName: 'Host2',
                roomCode: 'MULTI2',
            });
            await secondHost.evaluate(() => {
                document.getElementById('playerName').value = 'Host2';
            });
            await secondHost.getByTestId('create-game-button').click();
            await expect(secondHost.getByTestId('lobby-screen')).toHaveClass(/active/);

            // The guest browser lists both lobbies.
            await session.guestPage.getByTestId('join-game-button').click();
            await expect(session.guestPage.getByTestId('lobby-browser-screen')).toHaveClass(
                /active/
            );
            await expect(session.guestPage.getByTestId('open-lobby-entry')).toHaveCount(2);

            // Joining by the second lobby's code lands in THAT lobby.
            await session.guestPage.getByTestId('browser-player-name-input').fill('Guest');
            await session.guestPage
                .locator('[data-testid="open-lobby-entry"][data-room-code="MULTI2"]')
                .click();
            await expect(session.guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);
            await expect(session.guestPage.getByTestId('players-list')).toContainText('Host2');
            await expect(session.guestPage.getByTestId('players-list')).toContainText('Guest');
        } finally {
            await session.cleanup();
        }
    });
});
