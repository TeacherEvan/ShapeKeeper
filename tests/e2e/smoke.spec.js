import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

test.describe('runtime smoke', () => {
    test('boots to the main menu without page errors', async ({ page }) => {
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

        await gotoApp(page);

        await expect(page.getByTestId('main-menu-screen')).toBeVisible();
        await expect(page.getByTestId('create-game-button')).toBeVisible();
        await expect(page.getByTestId('join-game-button')).toBeVisible();

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
});
