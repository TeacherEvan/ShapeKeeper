import { expect, test } from '@playwright/test';

import {
    bootstrapLiveMatch,
    expectNoBrowserErrors,
    expectTurnIndicators,
} from './helpers/multiplayer-sync.js';

test.describe('multiplayer triangle sync', () => {
    test('keeps host/guest triangle state and score consistent when triangle mode is enabled', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, {
            roomCode: 'TRISYN',
            gridSize: 3,
            trianglesEnabled: true,
        });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            await expectTurnIndicators(
                { hostPage, guestPage },
                {
                    hostText: 'Your Turn',
                    guestText: "Opponent's Turn",
                }
            );

            await hostPage.evaluate(async () => {
                await window.ShapeKeeperConvex.updateTrianglesEnabled(true);
                window.__shapeKeeperSharedTest.seedActiveMatchState({
                    lines: [
                        { lineKey: '0,0-0,1', playerIndex: 0 },
                        { lineKey: '0,0-1,0', playerIndex: 0 },
                    ],
                    playerScores: [0, 0],
                    currentPlayerIndex: 0,
                    squares: [],
                    triangles: [],
                });
            });

            await expect
                .poll(async () => {
                    const snapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });
                    return {
                        lineCount: snapshot.lastDeliveredGameState?.lines?.length || 0,
                        triangleCount: snapshot.lastDeliveredGameState?.triangles?.length || 0,
                        hostScore:
                            snapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    lineCount: 2,
                    triangleCount: 0,
                    hostScore: 0,
                });

            const closingMoveResult = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('0,1-1,0');
            });

            expect(closingMoveResult).toMatchObject({
                success: true,
                completedSquares: 0,
                completedTriangles: 1,
                keepTurn: true,
            });

            await expect
                .poll(async () => {
                    const [hostSnapshot, guestSnapshot] = await Promise.all([
                        hostPage.evaluate(() => window.__shapeKeeperSharedTest.getSnapshot()),
                        guestPage.evaluate(() => window.__shapeKeeperSharedTest.getSnapshot()),
                    ]);
                    return {
                        hostTriangles: hostSnapshot.lastDeliveredGameState?.triangles || [],
                        guestTriangles: guestSnapshot.lastDeliveredGameState?.triangles || [],
                        hostCurrentPlayer:
                            hostSnapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        guestCurrentPlayer:
                            guestSnapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        hostScore:
                            hostSnapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                        guestObservedHostScore:
                            guestSnapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    hostTriangles: [{ triangleKey: 'tri-0,0-0,1-1,0', playerIndex: 0 }],
                    guestTriangles: [{ triangleKey: 'tri-0,0-0,1-1,0', playerIndex: 0 }],
                    hostCurrentPlayer: 0,
                    guestCurrentPlayer: 0,
                    hostScore: 1,
                    guestObservedHostScore: 1,
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

    test('reconnects without triangle desync after host scores triangle while guest is disconnected', async ({
        browser,
    }) => {
        const session = await bootstrapLiveMatch(browser, {
            roomCode: 'TRIREC',
            gridSize: 3,
            trianglesEnabled: true,
        });
        const { hostPage, guestPage, hostErrors, guestErrors } = session;

        try {
            await hostPage.evaluate(async () => {
                await window.ShapeKeeperConvex.updateTrianglesEnabled(true);
                window.__shapeKeeperSharedTest.seedActiveMatchState({
                    lines: [
                        { lineKey: '0,0-0,1', playerIndex: 0 },
                        { lineKey: '0,0-1,0', playerIndex: 0 },
                    ],
                    playerScores: [0, 0],
                    currentPlayerIndex: 0,
                    squares: [],
                    triangles: [],
                });
            });

            await expect
                .poll(async () => {
                    const snapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });
                    return snapshot.lastDeliveredGameState?.lines?.length || 0;
                })
                .toBe(2);

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('disconnected');
            });
            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'desynced'
            );

            const hostMoveResult = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.drawLine('0,1-1,0');
            });
            expect(hostMoveResult).toMatchObject({
                success: true,
                completedSquares: 0,
                completedTriangles: 1,
                keepTurn: true,
            });

            const disconnectedGuestSnapshot = await guestPage.evaluate(() => {
                return window.__shapeKeeperSharedTest.getSnapshot();
            });
            expect(disconnectedGuestSnapshot.lastDeliveredGameState?.triangles || []).toHaveLength(0);

            await guestPage.evaluate(() => {
                window.__shapeKeeperSharedTest.setConnectionState('connected');
            });

            const phaseAfterReconnect = await guestPage
                .getByTestId('startup-overlay')
                .getAttribute('data-startup-phase');
            if (phaseAfterReconnect === 'awaiting_first_authoritative_state') {
                await guestPage.waitForTimeout(250);
                await guestPage.evaluate(() => {
                    window.__shapeKeeperSharedTest.rebroadcastCurrentState('reconnect');
                });
            }

            await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
                'data-startup-phase',
                'in_match',
                { timeout: 10000 }
            );

            await expect
                .poll(async () => {
                    const snapshot = await guestPage.evaluate(() => {
                        return window.__shapeKeeperSharedTest.getSnapshot();
                    });
                    return {
                        currentPlayerIndex:
                            snapshot.lastDeliveredGameState?.room?.currentPlayerIndex ?? null,
                        triangleKeys:
                            (snapshot.lastDeliveredGameState?.triangles || []).map(
                                (triangle) => triangle.triangleKey
                            ),
                        hostScore:
                            snapshot.lastDeliveredGameState?.players?.find(
                                (player) => player.playerIndex === 0
                            )?.score || 0,
                    };
                })
                .toEqual({
                    currentPlayerIndex: 0,
                    triangleKeys: ['tri-0,0-0,1-1,0'],
                    hostScore: 1,
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
});
