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

function getReconnectGameDeliveries(snapshot) {
    return (snapshot.gameDeliveries || []).filter((entry) => entry.source === 'reconnect');
}

async function bootstrapLiveMatch(browser, options = {}) {
    const roomCode = options.roomCode || 'NETSLO';
    const session = await createSharedMockMultiplayerPages(browser, {
        roomCode,
        startupTimeoutMs: 6000,
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

    return {
        ...session,
        guestErrors,
        hostErrors,
    };
}

async function emulateSlowNetwork(page) {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 400,
        downloadThroughput: (50 * 1024) / 8,
        uploadThroughput: (20 * 1024) / 8,
        connectionType: 'cellular3g',
    });
    return client;
}

test.describe('degraded reconnect recovery', () => {
    test('keeps recovery UI visible until delayed authoritative state arrives after a degraded reconnect', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, { roomCode: 'SLOWRC' });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;
        let guestNetworkClient = null;

        try {
            guestNetworkClient = await emulateSlowNetwork(guestPage);

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.configureTransport({
                    roomDeliveryDelayMs: 150,
                    gameDeliveryDelayMs: 700,
                    snapshotDelayMs: 700,
                });
            });

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('disconnected');
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'desynced'
            );

            const hostMoveResult = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('0,0-0,1');
            });

            expect(hostMoveResult).toMatchObject({ success: true, keepTurn: false });

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('reconnecting');
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'reconnecting'
            );

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('connected');
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'awaiting_first_authoritative_state'
            );

            await guestPage.waitForTimeout(250);

            const preRecoverySnapshot = await guestPage.evaluate(() => {
                return window.__shapeKeeperSharedTest.getSnapshot();
            });

            expect(preRecoverySnapshot.lastDeliveredGameState?.lines || []).toHaveLength(0);
            expect(preRecoverySnapshot.transportConfig).toEqual({
                roomDeliveryDelayMs: 150,
                gameDeliveryDelayMs: 700,
                snapshotDelayMs: 700,
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'in_match',
                { timeout: 8000 }
            );

            await expect
                .poll(async () => {
                    const snapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return {
                        connectionTransitions: snapshot.connectionTransitions.map(
                            ({ from, to }) => `${from}->${to}`
                        ),
                        currentPlayerIndex:
                            snapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        deliveredLineCount:
                            snapshot.lastDeliveredGameState?.lines?.length || 0,
                        deliveredLineKey:
                            snapshot.lastDeliveredGameState?.lines?.[0]?.lineKey || null,
                    };
                })
                .toEqual({
                    connectionTransitions: [
                        'connected->disconnected',
                        'disconnected->reconnecting',
                        'reconnecting->connected',
                    ],
                    currentPlayerIndex: 1,
                    deliveredLineCount: 1,
                    deliveredLineKey: '0,0-0,1',
                });

            await expect(guestPage.locator('#turnIndicator')).toHaveText('Your Turn');

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            if (guestNetworkClient) {
                await guestNetworkClient.send('Network.disable');
            }

            await session.cleanup();
        }
    });

    test('records ordered delayed recovery artifacts across repeated degraded reconnect cycles', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, {
            roomCode: 'SLOMO2',
            gridSize: 3,
        });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;
        let guestNetworkClient = null;

        try {
            guestNetworkClient = await emulateSlowNetwork(guestPage);

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.configureTransport({
                    roomDeliveryDelayMs: 120,
                    gameDeliveryDelayMs: 650,
                    snapshotDelayMs: 650,
                });
            });

            const seededLines = [
                { lineKey: '0,0-0,1', playerIndex: 1 },
                { lineKey: '0,0-1,0', playerIndex: 1 },
                { lineKey: '1,0-1,1', playerIndex: 1 },
                { lineKey: '1,0-2,0', playerIndex: 1 },
                { lineKey: '1,1-2,1', playerIndex: 1 },
            ];

            await hostPage.evaluate((payload) => {
                window.__shapeKeeperSharedTest.seedActiveMatchState(payload);
            }, {
                lines: seededLines,
                playerScores: [0, 0],
                currentPlayerIndex: 0,
                squares: [],
            });

            await expect
                .poll(async () => {
                    const snapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return snapshot.lastDeliveredGameState?.lines?.length || 0;
                })
                .toBe(5);

            for (const lineKey of ['0,1-1,1', '2,0-2,1']) {
                await guestPage.evaluate(() => {
                    window.__shapeKeeperSharedTest.setConnectionState('disconnected');
                });

                await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                    'data-startup-phase',
                    'desynced'
                );

                const moveResult = await hostPage.evaluate(async (nextLineKey) => {
                    return await window.ShapeKeeperConvex.drawLine(nextLineKey);
                }, lineKey);

                expect(moveResult).toMatchObject({
                    success: true,
                    completedSquares: 1,
                    keepTurn: true,
                });

                await guestPage.evaluate(() => {
                    window.__shapeKeeperSharedTest.setConnectionState('reconnecting');
                });

                await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                    'data-startup-phase',
                    'reconnecting'
                );

                await guestPage.evaluate(() => {
                    window.__shapeKeeperSharedTest.setConnectionState('connected');
                });

                await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                    'data-startup-phase',
                    'awaiting_first_authoritative_state'
                );

                await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                    'data-startup-phase',
                    'in_match',
                    { timeout: 8000 }
                );
            }

            const snapshot = await guestPage.evaluate(() => {
                return window.__shapeKeeperSharedTest.getSnapshot();
            });

            const reconnectGameDeliveries = getReconnectGameDeliveries(snapshot);
            const reconnectTransitions = snapshot.connectionTransitions.map(
                ({ from, to }) => `${from}->${to}`
            );

            expect(reconnectTransitions).toEqual([
                'connected->disconnected',
                'disconnected->reconnecting',
                'reconnecting->connected',
                'connected->disconnected',
                'disconnected->reconnecting',
                'reconnecting->connected',
            ]);

            expect(reconnectGameDeliveries).toHaveLength(2);
            expect(reconnectGameDeliveries.map((entry) => entry.lineCount)).toEqual([6, 7]);
            expect(
                reconnectGameDeliveries.every(
                    (entry) =>
                        entry.configuredDelayMs === 650 &&
                        entry.deliveredAt - entry.scheduledAt >= 600
                )
            ).toBe(true);

            expect(snapshot.lastDeliveredGameState?.lines).toEqual([
                ...seededLines,
                { lineKey: '0,1-1,1', playerIndex: 0 },
                { lineKey: '2,0-2,1', playerIndex: 0 },
            ]);

            await expect(guestPage.locator('#turnIndicator')).toHaveText("Opponent's Turn");

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            if (guestNetworkClient) {
                await guestNetworkClient.send('Network.disable');
            }

            await session.cleanup();
        }
    });
});