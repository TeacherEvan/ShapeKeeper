import { expect, test } from '@playwright/test';

import {
    bootstrapLiveMatch,
    expectNoBrowserErrors,
    expectTurnIndicators,
} from './helpers/multiplayer-sync.js';

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
});
