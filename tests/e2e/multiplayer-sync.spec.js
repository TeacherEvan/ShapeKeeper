import { expect, test } from '@playwright/test';

import { createSharedMockMultiplayerPages } from './helpers/bootstrap.js';

function trackPageErrors(page) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(error.message);
    });

    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    return {
        consoleErrors,
        pageErrors,
    };
}

function expectNoBrowserErrors(errorState) {
    expect(errorState.pageErrors).toEqual([]);
    expect(errorState.consoleErrors).toEqual([]);
}

async function expectTurnIndicators({ hostPage, guestPage }, { hostText, guestText }) {
    await expect(hostPage.locator('#turnIndicator')).toHaveText(hostText);
    await expect(guestPage.locator('#turnIndicator')).toHaveText(guestText);
}

async function bootstrapLobby(browser, options = {}) {
    const roomCode = options.roomCode || 'SYNC42';
    const session = await createSharedMockMultiplayerPages(browser, {
        roomCode,
        startupTimeoutMs: 1500,
        ...options,
    });

    const { hostPage, guestPage } = session;
    const hostErrors = trackPageErrors(hostPage);
    const guestErrors = trackPageErrors(guestPage);

    await hostPage.getByTestId('create-game-button').click();
    await expect(hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);
    await expect(hostPage.getByTestId('room-code')).toHaveText(roomCode);

    await guestPage.getByTestId('join-game-button').click();
    await expect(guestPage.getByTestId('join-screen')).toHaveClass(/active/);
    await guestPage.getByTestId('join-room-code-input').fill(roomCode);
    await guestPage.getByTestId('join-player-name-input').fill('Guest');
    await guestPage.getByTestId('join-room-button').click();

    await expect(guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);
    await expect(guestPage.getByTestId('players-list')).toContainText('Host');
    await expect(guestPage.getByTestId('players-list')).toContainText('Guest');
    await expect(hostPage.getByTestId('players-list')).toContainText('Guest');

    return {
        ...session,
        guestErrors,
        guestPage,
        hostErrors,
        hostPage,
        roomCode,
    };
}

async function bootstrapLiveMatch(browser, options = {}) {
    const session = await bootstrapLobby(browser, options);
    const { hostPage, guestPage } = session;

    await hostPage.getByTestId('ready-button').click();
    await guestPage.getByTestId('ready-button').click();
    await expect(hostPage.getByTestId('start-multiplayer-game')).toBeEnabled();

    await hostPage.getByTestId('start-multiplayer-game').click();

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

    return session;
}

test.describe('multiplayer sync and reconnect', () => {
    test('re-synchronizes an in-match guest after a disconnect and reconnect with visible turn recovery', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, { roomCode: 'RECON1' });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            const lineKey = '0,0-0,1';

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: 'Your Turn',
                    guestText: "Opponent's Turn",
                }
            );

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('disconnected');
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'desynced'
            );

            const hostMoveResult = await hostPage.evaluate(async (nextLineKey) => {
                return await window.ShapeKeeperConvex.drawLine(nextLineKey);
            }, lineKey);

            expect(hostMoveResult).toMatchObject({ success: true, keepTurn: false });

            const disconnectedGuestSnapshot = await guestPage.evaluate(() => {
                return window.__shapeKeeperSharedTest.getSnapshot();
            });

            expect(disconnectedGuestSnapshot.lastDeliveredGameState?.lines || []).toHaveLength(0);

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('connected');
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'in_match'
            );

            await expect
                .poll(async () => {
                    const guestSnapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return {
                        currentPlayerIndex:
                            guestSnapshot.lastDeliveredGameState?.room?.currentPlayerIndex,
                        deliveredLineCount:
                            guestSnapshot.lastDeliveredGameState?.lines?.length || 0,
                        deliveredLineKey:
                            guestSnapshot.lastDeliveredGameState?.lines?.[0]?.lineKey || null,
                    };
                })
                .toEqual({
                    currentPlayerIndex: 1,
                    deliveredLineCount: 1,
                    deliveredLineKey: lineKey,
                });

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: "Opponent's Turn",
                    guestText: 'Your Turn',
                }
            );

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            await session.cleanup();
        }
    });

    test('rejects duplicate lines without corrupting synchronized turn UI', async ({ browser }) => {
        const session = await bootstrapLiveMatch(browser, { roomCode: 'SYNC42' });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            const lineKey = '0,0-0,1';

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: 'Your Turn',
                    guestText: "Opponent's Turn",
                }
            );

            const hostMoveResult = await hostPage.evaluate(async (nextLineKey) => {
                return await window.ShapeKeeperConvex.drawLine(nextLineKey);
            }, lineKey);

            expect(hostMoveResult).toMatchObject({ success: true, keepTurn: false });

            await expect
                .poll(async () => {
                    const guestSnapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return guestSnapshot.lastDeliveredGameState?.lines?.length || 0;
                })
                .toBe(1);

            const duplicateMoveResult = await guestPage.evaluate(async (nextLineKey) => {
                return await window.ShapeKeeperConvex.drawLine(nextLineKey);
            }, lineKey);

            expect(duplicateMoveResult).toEqual({ error: 'Line already drawn' });

            const [hostSnapshot, guestSnapshot] = await Promise.all([
                hostPage.evaluate(() => window.__shapeKeeperSharedTest.getSnapshot()),
                guestPage.evaluate(() => window.__shapeKeeperSharedTest.getSnapshot()),
            ]);

            expect(hostSnapshot.room.gameState.lines).toEqual([{ lineKey, playerIndex: 0 }]);
            expect(guestSnapshot.lastDeliveredGameState.lines).toEqual([
                { lineKey, playerIndex: 0 },
            ]);
            expect(hostSnapshot.room.gameState.room.currentPlayerIndex).toBe(1);
            expect(guestSnapshot.lastDeliveredGameState.room.currentPlayerIndex).toBe(1);

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: "Opponent's Turn",
                    guestText: 'Your Turn',
                }
            );

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            await session.cleanup();
        }
    });

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
});
