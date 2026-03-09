import { expect, test } from '@playwright/test';

import { createSharedMockMultiplayerPages } from './helpers/bootstrap.js';

test.describe('multiplayer host-guest startup', () => {
    test('host creates, guest joins, both ready, and both receive the first authoritative state', async ({
        browser,
    }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'QAT123',
            startupTimeoutMs: 1500,
        });

        const { hostPage, guestPage } = session;
        const hostPageErrors = [];
        const guestPageErrors = [];
        const hostConsoleErrors = [];
        const guestConsoleErrors = [];

        hostPage.on('pageerror', (error) => {
            hostPageErrors.push(error.message);
        });
        guestPage.on('pageerror', (error) => {
            guestPageErrors.push(error.message);
        });
        hostPage.on('console', (message) => {
            if (message.type() === 'error') {
                hostConsoleErrors.push(message.text());
            }
        });
        guestPage.on('console', (message) => {
            if (message.type() === 'error') {
                guestConsoleErrors.push(message.text());
            }
        });

        try {
            await hostPage.getByTestId('create-game-button').click();

            await expect(hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);
            await expect(hostPage.getByTestId('room-code')).toHaveText('QAT123');
            await expect(hostPage.getByTestId('players-list')).toContainText('Host');

            await guestPage.getByTestId('join-game-button').click();
            await expect(guestPage.getByTestId('join-screen')).toHaveClass(/active/);
            await guestPage.getByTestId('join-room-code-input').fill('QAT123');
            await guestPage.getByTestId('join-player-name-input').fill('Guest');
            await guestPage.getByTestId('join-room-button').click();

            await expect(guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);
            await expect(guestPage.getByTestId('players-list')).toContainText('Host');
            await expect(guestPage.getByTestId('players-list')).toContainText('Guest');
            await expect(hostPage.getByTestId('players-list')).toContainText('Guest');

            await hostPage.getByTestId('ready-button').click();
            await guestPage.getByTestId('ready-button').click();

            await expect(hostPage.getByTestId('ready-button')).toContainText('Ready ✓');
            await expect(guestPage.getByTestId('ready-button')).toContainText('Ready ✓');
            await expect(hostPage.getByTestId('start-multiplayer-game')).toBeEnabled();
            await expect(guestPage.getByTestId('start-multiplayer-game')).toBeDisabled();

            await hostPage.getByTestId('start-multiplayer-game').click();

            await expect.poll(
                async () => ({
                    guestConsoleErrors,
                    guestPageErrors,
                    guestPhase: await guestPage
                        .getByTestId('startup-overlay')
                        .getAttribute('data-startup-phase'),
                    hostConsoleErrors,
                    hostPageErrors,
                    hostPhase: await hostPage
                        .getByTestId('startup-overlay')
                        .getAttribute('data-startup-phase'),
                }),
                {
                    timeout: 5000,
                }
            ).toEqual({
                guestConsoleErrors: [],
                guestPageErrors: [],
                guestPhase: 'in_match',
                hostConsoleErrors: [],
                hostPageErrors: [],
                hostPhase: 'in_match',
            });

            await expect(hostPage.getByTestId('game-screen')).toHaveClass(/active/);
            await expect(guestPage.getByTestId('game-screen')).toHaveClass(/active/);
            await expect(hostPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'in_match'
            );
            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'in_match'
            );

            const hostSnapshot = await hostPage.evaluate(() => window.__shapeKeeperSharedTest.getSnapshot());
            const guestSnapshot = await guestPage.evaluate(() => window.__shapeKeeperSharedTest.getSnapshot());

            expect(hostSnapshot.room.status).toBe('playing');
            expect(guestSnapshot.room.status).toBe('playing');
            expect(hostSnapshot.room.gameState.room.status).toBe('playing');
            expect(guestSnapshot.room.gameState.room.status).toBe('playing');
            expect(hostSnapshot.currentRoomId).toBe(guestSnapshot.currentRoomId);
        } finally {
            await session.cleanup();
        }
    });
});
