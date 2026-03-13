import { expect, test } from '@playwright/test';

import {
    bootstrapLiveMatch,
    expectNoBrowserErrors,
    expectTurnIndicators,
} from './helpers/multiplayer-sync.js';

test.describe('multiplayer reconnect cycles', () => {
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
});
