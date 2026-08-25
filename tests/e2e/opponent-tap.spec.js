/**
 * E2E for the opponent-tap mechanic (multiplayer).
 *
 * Flow under test:
 *   1. Both players reach the game screen.
 *   2. A completed square exists (we pre-populate it via the shared mock so
 *      the test doesn't have to draw lines through the UI).
 *   3. The non-owner (guest) calls `game.tapSquare(squareKey)` from their
 *      browser context.
 *   4. The mock Convex layer records the tap, increments the counter, and
 *      collapses the effective multiplier to 0.5x.
 *   5. The subscription delivers the updated square to BOTH players; the
 *      ✋ indicator appears on both renders and the local `squareTaps`
 *      cache reflects the new count.
 *
 * Why not a full UI flow (drag-a-line-completes-a-square-then-tap)?
 *   The drawing UI is complex; the input handler is unit-tested separately.
 *   This E2E exercises the actual server-validated mutation path (mocked)
 *   and the cross-client broadcast.
 */
import { expect, test } from '@playwright/test';

import { createSharedMockMultiplayerPages } from './helpers/bootstrap.js';

test.describe('opponent tap mechanic (multiplayer)', () => {
    test("guest tapping the host's square records the tap and updates both clients", async ({
        browser,
    }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'TAP123',
            startupTimeoutMs: 1500,
        });

        const { hostPage, guestPage } = session;

        try {
            // Navigate both players to the game screen via the existing
            // host-creates / guest-joins / ready / start flow.
            await hostPage.getByTestId('create-game-button').click();
            await expect(hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            await guestPage.getByTestId('join-game-button').click();
            await expect(guestPage.getByTestId('join-screen')).toHaveClass(/active/);
            await guestPage.getByTestId('join-room-code-input').fill('TAP123');
            await guestPage.getByTestId('join-player-name-input').fill('Guest');
            await guestPage.getByTestId('join-room-button').click();
            await expect(guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);

            await hostPage.getByTestId('ready-button').click();
            await guestPage.getByTestId('ready-button').click();
            await expect(hostPage.getByTestId('start-multiplayer-game')).toBeEnabled();
            await hostPage.getByTestId('start-multiplayer-game').click();

            // Wait until both players are in-match.
            await expect
                .poll(
                    async () =>
                        guestPage.getByTestId('startup-overlay').getAttribute('data-startup-phase'),
                    {
                        timeout: 5000,
                    }
                )
                .toBe('in_match');
            await expect
                .poll(
                    async () =>
                        hostPage.getByTestId('startup-overlay').getAttribute('data-startup-phase'),
                    {
                        timeout: 5000,
                    }
                )
                .toBe('in_match');

            // Pre-populate a completed square owned by the host (playerIndex 0)
            // with a 2x multiplier via the shared mock's seed helper. The
            // subscription broadcasts the new square to both clients.
            await hostPage.evaluate(() => {
                const seeded = window.__shapeKeeperSharedTest?.seedActiveMatchState({
                    squares: [
                        {
                            squareKey: '0,0',
                            playerIndex: 0,
                            multiplier: { type: 'multiplier', value: 2 },
                            effectiveMultiplier: { type: 'multiplier', value: 2 },
                            taps: 0,
                        },
                    ],
                });
                if (!seeded) {
                    throw new Error('seedActiveMatchState returned null');
                }
                return seeded;
            });

            // Wait until BOTH clients have seen the new square in their
            // local game state.
            await expect
                .poll(async () =>
                    hostPage.evaluate(() => window.__shapeKeeperActiveGame?.squares?.['0,0'])
                )
                .toBe(1);
            await expect
                .poll(async () =>
                    guestPage.evaluate(() => window.__shapeKeeperActiveGame?.squares?.['0,0'])
                )
                .toBe(1);

            // Guest taps the host's square via the public Convex API.
            const tapResult = await guestPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.tapSquare('0,0');
            });
            expect(tapResult).toMatchObject({ success: true, squareKey: '0,0', taps: 1 });
            // Server collapses the multiplier to 0.5x for any non-truthOrDare
            // multiplier square after the first tap.
            expect(tapResult.effectiveMultiplier).toEqual({ type: 'multiplier', value: 0.5 });

            // Both clients receive the broadcast — squareTaps[0,0] === 1
            // on each. We use a small poll because the subscription is
            // async via localStorage events.
            await expect
                .poll(
                    async () =>
                        guestPage.evaluate(
                            () => window.__shapeKeeperActiveGame?.squareTaps?.['0,0']
                        ),
                    {
                        timeout: 2000,
                    }
                )
                .toBe(1);
            await expect
                .poll(
                    async () =>
                        hostPage.evaluate(
                            () => window.__shapeKeeperActiveGame?.squareTaps?.['0,0']
                        ),
                    {
                        timeout: 2000,
                    }
                )
                .toBe(1);

            // The local multiplier cache is also updated to the post-tap
            // effective value, so the owner's next reveal will use 0.5x.
            await expect
                .poll(
                    async () =>
                        guestPage.evaluate(
                            () => window.__shapeKeeperActiveGame?.squareMultipliers?.['0,0']
                        ),
                    { timeout: 2000 }
                )
                .toEqual({ type: 'multiplier', value: 0.5 });
        } finally {
            await session.cleanup();
        }
    });

    test('the owner cannot tap their own square (server returns an error)', async ({ browser }) => {
        const session = await createSharedMockMultiplayerPages(browser, {
            roomCode: 'OWN901',
            startupTimeoutMs: 1500,
        });

        const { hostPage, guestPage } = session;

        try {
            await hostPage.getByTestId('create-game-button').click();
            await guestPage.getByTestId('join-game-button').click();
            await guestPage.getByTestId('join-room-code-input').fill('OWN901');
            await guestPage.getByTestId('join-player-name-input').fill('Guest');
            await guestPage.getByTestId('join-room-button').click();
            await hostPage.getByTestId('ready-button').click();
            await guestPage.getByTestId('ready-button').click();
            await hostPage.getByTestId('start-multiplayer-game').click();
            await expect
                .poll(
                    async () =>
                        guestPage.getByTestId('startup-overlay').getAttribute('data-startup-phase'),
                    {
                        timeout: 5000,
                    }
                )
                .toBe('in_match');

            // Inject a square owned by the host via the seed helper.
            await hostPage.evaluate(() => {
                const seeded = window.__shapeKeeperSharedTest?.seedActiveMatchState({
                    squares: [
                        {
                            squareKey: '0,0',
                            playerIndex: 0,
                            multiplier: { type: 'multiplier', value: 2 },
                            effectiveMultiplier: { type: 'multiplier', value: 2 },
                            taps: 0,
                        },
                    ],
                });
                if (!seeded) {
                    throw new Error('seedActiveMatchState returned null');
                }
            });
            await expect
                .poll(
                    async () =>
                        hostPage.evaluate(() => window.__shapeKeeperActiveGame?.squares?.['0,0']),
                    {
                        timeout: 3000,
                    }
                )
                .toBe(1);

            // Host tries to tap their own square — should be rejected.
            const selfTapResult = await hostPage.evaluate(async () => {
                return await window.ShapeKeeperConvex.tapSquare('0,0');
            });
            expect(selfTapResult).toMatchObject({
                error: 'You cannot tap your own square',
            });
        } finally {
            await session.cleanup();
        }
    });
});
