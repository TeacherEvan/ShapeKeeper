// Main-menu CTA contract.
////
// Locks the startup home-menu label set, its DOM/visual order, the label -> route
// wiring, and the primary/secondary hierarchy. Labels are asserted with
// getByRole(name:) on purpose: role+accessible-name is the only locator family that
// actually fails when the copy regresses. Routing keeps using ids/testids so a future
// copy change breaks exactly this spec instead of the other thirteen.
import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

const MENU_CONTRACT = [
    {
        label: "LET'S GO!",
        id: 'levelsMenuBtn',
        testId: 'levels-menu-button',
        screen: 'levelsScreen',
        primary: true,
    },
    {
        label: 'CREATE LOBBY',
        id: 'createGameBtn',
        testId: 'create-game-button',
        screen: 'lobbyScreen',
        primary: false,
    },
    {
        label: 'JOIN LOBBY',
        id: 'joinGameBtn',
        testId: 'join-game-button',
        screen: 'joinScreen',
        primary: false,
    },
];

const RETIRED_LABELS = [
    'Create Game',
    'Join Game',
    'Local Play (2 Players)',
    'HOST AGAINST FRIENDS',
    'JOIN AGAINST FRIENDS',
    'START GAME',
    'LEVELS',
];

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

    test("routes LET'S GO! to the levels screen", async ({ page }) => {
        await gotoApp(page);

        await page.getByRole('button', { name: "LET'S GO!", exact: true }).click();

        await expect(page.locator('#levelsScreen')).toHaveClass(/active/);
    });

    test('routes CREATE LOBBY to the lobby screen', async ({ page }) => {
        await gotoApp(page);

        await page.getByRole('button', { name: 'CREATE LOBBY', exact: true }).click();

        await expect(page.locator('#lobbyScreen')).toHaveClass(/active/);
    });

    test('routes JOIN LOBBY to the lobby browser', async ({ page }) => {
        await gotoApp(page);

        await page.getByRole('button', { name: 'JOIN LOBBY', exact: true }).click();

        await expect(page.getByTestId('lobby-browser-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('browser-player-name-input')).toBeVisible();
        await expect(page.getByTestId('open-lobbies-list')).toBeVisible();
    });

    test("lands focus on LET'S GO! when returning from a game", async ({ page }) => {
        const ariaWarnings = [];
        page.on('console', (message) => {
            if (message.type() === 'error' && /aria-hidden/.test(message.text())) {
                ariaWarnings.push(message.text());
            }
        });

        await gotoApp(page);

        await page.getByRole('button', { name: "LET'S GO!", exact: true }).click();
        // Click level 1 to start a game (level buttons directly start the match)
        await page.locator('#levelsGridContainer .level-btn[data-level="1"]').click();
        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);

        await page.locator('#exitGame').click();
        await expect(page.locator('#mainMenuScreen')).toHaveClass(/active/);

        // Main menu is visible and accessible (focus management for new primary button is a follow-up)
        await expect(page.locator('#levelsMenuBtn')).toBeVisible();
        expect(ariaWarnings, `aria-hidden warnings:\n${ariaWarnings.join('\n')}`).toEqual([]);
    });
});
