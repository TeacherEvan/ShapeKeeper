// Main-menu CTA contract.
//
// Locks the startup home-menu label set, its DOM/visual order, the label -> route
// wiring, and the primary/secondary hierarchy. Labels are asserted with
// getByRole(name:) on purpose: role+accessible-name is the only locator family that
// actually fails when the copy regresses. Routing keeps using ids/testids so a future
// copy change breaks exactly this spec instead of the other thirteen.
import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

const MENU_CONTRACT = [
    {
        label: 'START GAME',
        id: 'localPlayBtn',
        testId: 'local-play-button',
        screen: 'localSetupScreen',
        primary: true,
    },
    {
        label: 'HOST AGAINST FRIENDS',
        id: 'createGameBtn',
        testId: 'create-game-button',
        screen: 'lobbyScreen',
        primary: false,
    },
    {
        label: 'JOIN AGAINST FRIENDS',
        id: 'joinGameBtn',
        testId: 'join-game-button',
        screen: 'joinScreen',
        primary: false,
    },
];

const RETIRED_LABELS = ['Create Game', 'Join Game', 'Local Play (2 Players)'];

test.describe('main menu CTA contract', () => {
    test('exposes the three renamed calls to action', async ({ page }) => {
        await gotoApp(page);

        await expect(page.getByTestId('main-menu-screen')).toBeVisible();

        for (const { label } of MENU_CONTRACT) {
            await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
        }
    });

    test('retires the previous menu labels', async ({ page }) => {
        await gotoApp(page);

        for (const label of RETIRED_LABELS) {
            await expect(
                page.locator('#mainMenuScreen').getByRole('button', { name: label, exact: true })
            ).toHaveCount(0);
        }
    });

    test('paints the calls to action in contract order', async ({ page }) => {
        await gotoApp(page);

        const buttons = page.locator('#mainMenuScreen .menu-options .menu-btn');
        await expect(buttons).toHaveCount(MENU_CONTRACT.length);

        for (const [index, { label, id }] of MENU_CONTRACT.entries()) {
            const button = buttons.nth(index);
            await expect(button).toHaveAttribute('id', id);
            await expect(button).toHaveText(label);
        }
    });

    test('keeps one primary action and two secondary actions', async ({ page }) => {
        await gotoApp(page);

        for (const { id, primary } of MENU_CONTRACT) {
            const button = page.locator(`#${id}`);
            if (primary) {
                await expect(button).not.toHaveClass(/\bsecondary\b/);
            } else {
                await expect(button).toHaveClass(/\bsecondary\b/);
            }
        }
    });

    test('keeps every call to action at or above the 44px target size', async ({ page }) => {
        await gotoApp(page);

        for (const { id } of MENU_CONTRACT) {
            const bounds = await page.locator(`#${id}`).boundingBox();
            expect(bounds, `missing bounding box for #${id}`).not.toBeNull();
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(bounds.width).toBeGreaterThanOrEqual(44);
        }
    });

    test('routes START GAME to the local setup screen', async ({ page }) => {
        await gotoApp(page);

        await page.getByRole('button', { name: 'START GAME', exact: true }).click();

        await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
        await expect(page.locator('#localOpponentType')).toHaveValue('human');
    });

    test('routes HOST AGAINST FRIENDS to the lobby screen', async ({ page }) => {
        await gotoApp(page);

        await page.getByRole('button', { name: 'HOST AGAINST FRIENDS', exact: true }).click();

        await expect(page.locator('#lobbyScreen')).toHaveClass(/active/);
    });

    test('routes JOIN AGAINST FRIENDS to the join screen', async ({ page }) => {
        await gotoApp(page);

        await page.getByRole('button', { name: 'JOIN AGAINST FRIENDS', exact: true }).click();

        await expect(page.getByTestId('join-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('join-room-code-input')).toBeVisible();
    });

    test('lands focus on START GAME when returning from a game', async ({ page }) => {
        const ariaWarnings = [];
        page.on('console', (message) => {
            if (message.type() === 'error' && /aria-hidden/.test(message.text())) {
                ariaWarnings.push(message.text());
            }
        });

        await gotoApp(page);

        await page.getByRole('button', { name: 'START GAME', exact: true }).click();
        await page.locator('#localSetupScreen .local-grid-btn[data-size="5"]').click();
        await page.locator('#startLocalGame').click();
        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);

        await page.locator('#exitGame').click();
        await expect(page.locator('#mainMenuScreen')).toHaveClass(/active/);

        await expect(page.locator('#localPlayBtn')).toBeFocused();
        expect(ariaWarnings, `aria-hidden warnings:\n${ariaWarnings.join('\n')}`).toEqual([]);
    });
});
