/**
 * Lobby browser smoke tests.
 *
 * The code-entry join screen is gone: JOIN LOBBY shows a live list of
 * open lobbies (no room codes, no passcodes) and one click joins. Old
 * ?join= invite links still deep-link straight into that lobby.
 */
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

test.describe('lobby browser', () => {
    test('JOIN LOBBY shows the open-lobby browser with an empty state', async ({ page }) => {
        await gotoApp(page);

        await page.getByTestId('join-game-button').click();
        await expect(page.getByTestId('lobby-browser-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('browser-player-name-input')).toBeVisible();
        await expect(page.getByTestId('open-lobbies-list')).toBeVisible();
        await expect(page.getByTestId('open-lobbies-empty')).toBeVisible();

        // The name is persisted so ?join= deep links can join with it.
        await page.getByTestId('browser-player-name-input').fill('Zoe');
        expect(await page.evaluate(() => localStorage.getItem('shapekeeper.playerName'))).toBe(
            'Zoe'
        );
    });

    test('back from the browser returns to the main menu', async ({ page }) => {
        await gotoApp(page);

        await page.getByTestId('join-game-button').click();
        await expect(page.getByTestId('lobby-browser-screen')).toHaveClass(/active/);

        await page.locator('#backToMenuFromBrowser').click();
        await expect(page.getByTestId('main-menu-screen')).toHaveClass(/active/);
        await expect(page.getByTestId('lobby-browser-screen')).toBeHidden();
    });

    test('?join= deep link attempts a direct join without breaking the app', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        // gotoApp registers the convex-bundle route stub; the navigation
        // below keeps those routes active.
        await gotoApp(page);
        await page.goto('/?join=ABC123');

        // The deep-link join runs against the stub backend and fails
        // gracefully (no roomId) — the app must stay on a valid screen
        // with no uncaught errors.
        await expect(page.getByTestId('main-menu-screen')).toBeVisible();
        expect(pageErrors).toEqual([]);
    });
});
