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

    test('re-synchronizes multiple missed scoring moves after a longer reconnect outage', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, { roomCode: 'RECON2', gridSize: 3 });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            const seededLines = [
                { lineKey: '0,0-0,1', playerIndex: 1 },
                { lineKey: '0,0-1,0', playerIndex: 1 },
                { lineKey: '1,0-1,1', playerIndex: 1 },
                { lineKey: '1,0-2,0', playerIndex: 1 },
                { lineKey: '1,1-2,1', playerIndex: 1 },
            ];

            await hostPage.evaluate(
                (payload) => {
                    window.__shapeKeeperSharedTest.seedActiveMatchState(payload);
                },
                {
                    lines: seededLines,
                    playerScores: [0, 0],
                    currentPlayerIndex: 0,
                    squares: [],
                }
            );

            await expect
                .poll(async () => {
                    const guestSnapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return {
                        deliveredLineCount:
                            guestSnapshot.lastDeliveredGameState?.lines?.length || 0,
                        deliveredSquareCount:
                            guestSnapshot.lastDeliveredGameState?.squares?.length || 0,
                        hostScore:
                            guestSnapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    deliveredLineCount: 5,
                    deliveredSquareCount: 0,
                    hostScore: 0,
                });

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

            const firstMoveResult = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('0,1-1,1');
            });
            const secondMoveResult = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('2,0-2,1');
            });

            expect(firstMoveResult).toMatchObject({
                success: true,
                completedSquares: 1,
                keepTurn: true,
            });
            expect(secondMoveResult).toMatchObject({
                success: true,
                completedSquares: 1,
                keepTurn: true,
            });

            const disconnectedGuestSnapshot = await guestPage.evaluate(() => {
                return window.__shapeKeeperSharedTest.getSnapshot();
            });

            expect(disconnectedGuestSnapshot.lastDeliveredGameState?.lines || []).toHaveLength(5);
            expect(disconnectedGuestSnapshot.lastDeliveredGameState?.squares || []).toHaveLength(0);

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
                            guestSnapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        deliveredLineCount:
                            guestSnapshot.lastDeliveredGameState?.lines?.length || 0,
                        deliveredSquareKeys: (guestSnapshot.lastDeliveredGameState?.squares || [])
                            .map((square) => square.squareKey)
                            .sort(),
                        hostScore:
                            guestSnapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    currentPlayerIndex: 0,
                    deliveredLineCount: 7,
                    deliveredSquareKeys: ['0,0', '1,0'],
                    hostScore: 2,
                });

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: 'Your Turn',
                    guestText: "Opponent's Turn",
                }
            );

            expectNoBrowserErrors(hostErrors);
            expectNoBrowserErrors(guestErrors);
        } finally {
            await session.cleanup();
        }
    });

    test('recovers cleanly across repeated reconnect cycles without losing authoritative match state', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, { roomCode: 'RECON3', gridSize: 3 });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            const seededLines = [
                { lineKey: '0,0-0,1', playerIndex: 1 },
                { lineKey: '0,0-1,0', playerIndex: 1 },
                { lineKey: '1,0-1,1', playerIndex: 1 },
                { lineKey: '1,0-2,0', playerIndex: 1 },
                { lineKey: '1,1-2,1', playerIndex: 1 },
            ];

            await hostPage.evaluate(
                (payload) => {
                    window.__shapeKeeperSharedTest.seedActiveMatchState(payload);
                },
                {
                    lines: seededLines,
                    playerScores: [0, 0],
                    currentPlayerIndex: 0,
                    squares: [],
                }
            );

            await expect
                .poll(async () => {
                    const guestSnapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return guestSnapshot.lastDeliveredGameState?.lines?.length || 0;
                })
                .toBe(5);

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

            const firstRecoveryMove = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('0,1-1,1');
            });

            expect(firstRecoveryMove).toMatchObject({
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
                'in_match'
            );

            await expect
                .poll(async () => {
                    const guestSnapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return {
                        currentPlayerIndex:
                            guestSnapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        lineCount: guestSnapshot.lastDeliveredGameState?.lines?.length || 0,
                        squareKeys: (guestSnapshot.lastDeliveredGameState?.squares || [])
                            .map((square) => square.squareKey)
                            .sort(),
                        hostScore:
                            guestSnapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    currentPlayerIndex: 0,
                    lineCount: 6,
                    squareKeys: ['0,0'],
                    hostScore: 1,
                });

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('disconnected');
            });

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'desynced'
            );

            const secondRecoveryMove = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('2,0-2,1');
            });

            expect(secondRecoveryMove).toMatchObject({
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
                'in_match'
            );

            await expect
                .poll(async () => {
                    const guestSnapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });

                    return {
                        connectionTransitions: guestSnapshot.connectionTransitions.map(
                            ({ from, to }) => `${from}->${to}`
                        ),
                        currentPlayerIndex:
                            guestSnapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        uniqueGameDeliveryLineCounts: [
                            ...new Set(
                                guestSnapshot.gameDeliveries.map((entry) => entry.lineCount)
                            ),
                        ],
                        lineCount: guestSnapshot.lastDeliveredGameState?.lines?.length || 0,
                        squareKeys: (guestSnapshot.lastDeliveredGameState?.squares || [])
                            .map((square) => square.squareKey)
                            .sort(),
                        hostScore:
                            guestSnapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    connectionTransitions: [
                        'connected->disconnected',
                        'disconnected->reconnecting',
                        'reconnecting->connected',
                        'connected->disconnected',
                        'disconnected->reconnecting',
                        'reconnecting->connected',
                    ],
                    currentPlayerIndex: 0,
                    uniqueGameDeliveryLineCounts: [0, 5, 6, 7],
                    lineCount: 7,
                    squareKeys: ['0,0', '1,0'],
                    hostScore: 2,
                });

            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: 'Your Turn',
                    guestText: "Opponent's Turn",
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
