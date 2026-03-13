import { expect, test } from '@playwright/test';

import {
    bootstrapLiveMatch,
    bootstrapLobby,
    expectNoBrowserErrors,
    expectTurnIndicators,
} from './helpers/multiplayer-sync.js';

test.describe('multiplayer sync host transfer', () => {
    test('transfers lobby host controls to the guest when the original host leaves', async ({
        browser,
    }) => {
        const session = await bootstrapLobby(browser, { roomCode: 'HOSTX1' });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            await expect(hostPage.locator('#playersList .player-entry')).toHaveCount(2);
            await expect(guestPage.locator('#playersList .player-entry')).toHaveCount(2);

            await hostPage.locator('#leaveLobby').click();

            await expect(hostPage.getByTestId('main-menu-screen')).toHaveClass(/active/);

            await expect
                .poll(async () => {
                    return await guestPage.evaluate(() => {
                        const snapshot = window.__shapeKeeperSharedTest.getSnapshot();
                        return {
                            currentRoomId: snapshot.currentRoomId,
                            hostPlayerId: snapshot.room?.hostPlayerId || null,
                            playerCount: snapshot.room?.players?.length || 0,
                            playerNames: (snapshot.room?.players || []).map(
                                (player) => player.name
                            ),
                        };
                    });
                })
                .toEqual({
                    currentRoomId: 'room_HOSTX1',
                    hostPlayerId: 'session_guest',
                    playerCount: 1,
                    playerNames: ['Guest'],
                });

            await expect(guestPage.locator('#playersList .player-entry')).toHaveCount(1);
            await expect(guestPage.locator('#playersList .player-entry-name')).toHaveText('Guest');
            await expect(guestPage.locator('#playersList .host-badge')).toHaveText('Host');
            await expect(guestPage.locator('#lobbyPartyModeToggle')).toBeEnabled();
            await expect(guestPage.getByTestId('start-multiplayer-game')).toBeDisabled();

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            await session.cleanup();
        }
    });

    test('keeps the guest in-match and recovers host plus turn ownership when the host exits mid-turn', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, { roomCode: 'HOSTGM' });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            await expect(hostPage.locator('#populateBtn')).not.toHaveClass(/hidden/);
            await expect(guestPage.locator('#populateBtn')).toHaveClass(/hidden/);

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: 'Your Turn',
                    guestText: "Opponent's Turn",
                }
            );

            await hostPage.locator('#exitGame').click();

            await expect(hostPage.getByTestId('main-menu-screen')).toHaveClass(/active/);
            await expect(guestPage.getByTestId('game-screen')).toHaveClass(/active/);
            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'in_match'
            );

            await expect
                .poll(async () => {
                    return await guestPage.evaluate(() => {
                        const snapshot = window.__shapeKeeperSharedTest.getSnapshot();
                        const hostPlayer = snapshot.room?.players?.find(
                            (player) => player.sessionId === 'session_host'
                        );
                        const guestPlayer = snapshot.room?.players?.find(
                            (player) => player.sessionId === 'session_guest'
                        );

                        return {
                            currentPlayerIndex:
                                snapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                            hostPlayerId: snapshot.room?.hostPlayerId || null,
                            hostStillTracked: Boolean(hostPlayer),
                            hostIsConnected: hostPlayer?.isConnected ?? null,
                            guestIsConnected: guestPlayer?.isConnected ?? null,
                            playerCount: snapshot.room?.players?.length || 0,
                        };
                    });
                })
                .toEqual({
                    currentPlayerIndex: 1,
                    hostPlayerId: 'session_guest',
                    hostStillTracked: true,
                    hostIsConnected: false,
                    guestIsConnected: true,
                    playerCount: 2,
                });

            await expect(guestPage.locator('#turnIndicator')).toHaveText('Your Turn');
            await expect(guestPage.locator('#populateBtn')).not.toHaveClass(/hidden/);

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            await session.cleanup();
        }
    });
});
