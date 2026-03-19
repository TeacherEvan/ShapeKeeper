import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

const MAIN_MENU_BUTTON_TEST_IDS = [
    'create-game-button',
    'join-game-button',
];

test.describe('browser compatibility matrix', () => {
    test('boots to the main menu with stable core controls for the active profile', async ({
        page,
    }) => {
        await gotoApp(page);

        await expect(page.getByTestId('main-menu-screen')).toBeVisible();

        for (const testId of MAIN_MENU_BUTTON_TEST_IDS) {
            await expect(page.getByTestId(testId)).toBeVisible();
        }

        await expect(page.locator('#localPlayBtn')).toBeVisible();
        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
            'content',
            /viewport-fit=cover/
        );
    });

    test('keeps primary menu actions touch-friendly on touch-enabled profiles', async ({ page }) => {
        test.skip(!test.info().project.use.hasTouch, 'Touch-enabled project required');

        await gotoApp(page);

        const controls = [
            page.getByTestId('create-game-button'),
            page.getByTestId('join-game-button'),
            page.locator('#localPlayBtn'),
        ];

        for (const control of controls) {
            const bounds = await control.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(bounds.width).toBeGreaterThanOrEqual(44);
        }
    });

    test('supports joining and leaving the multiplayer join flow on narrow viewports', async ({
        page,
    }) => {
        await gotoApp(page);

        await page.getByTestId('join-game-button').click();

        await expect(page.getByTestId('join-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('join-room-code-input')).toBeVisible();
        await expect(page.getByTestId('join-player-name-input')).toBeVisible();
        await expect(page.getByTestId('join-room-button')).toBeVisible();

        await page.locator('#backToMenuFromJoin').click();

        await expect(page.getByTestId('main-menu-screen')).toHaveClass(/active/);
    });

    test('keeps Party Mode hidden in local and lobby setup flows', async ({ page }) => {
        await gotoApp(page);

        await page.locator('#localPlayBtn').click();
        await expect(page.locator('#partyModeToggle')).toHaveCount(0);

        await page.locator('#backToMenuFromLocal').click();
        await page.getByTestId('create-game-button').click();
        await expect(page.locator('#lobbyPartyModeToggle')).toHaveCount(0);
    });
});
