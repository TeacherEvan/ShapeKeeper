import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';

async function openLocalSetup(page) {
    await gotoApp(page);
    await page.locator('#localPlayBtn').click();
    await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
}

test.describe('Local setup options', () => {
    test('selecting a grid size enables Start and persists selection', async ({ page }) => {
        await openLocalSetup(page);

        const start = page.locator('#startLocalGame');
        await expect(start).toBeDisabled();

        await page.locator('.local-grid-btn[data-size="5"]').click();
        await expect(page.locator('.local-grid-btn[data-size="5"]')).toHaveClass(/selected/);
        await expect(start).toBeEnabled();
    });

    test('AI difficulty is disabled for human opponent and enabled for AI', async ({ page }) => {
        await openLocalSetup(page);

        const opponent = page.getByTestId('local-opponent-type');
        const difficulty = page.getByTestId('local-ai-difficulty');

        await expect(opponent).toHaveValue('human');
        await expect(difficulty).toBeDisabled();

        await opponent.selectOption('ai');
        await expect(difficulty).toBeEnabled();

        await opponent.selectOption('human');
        await expect(difficulty).toBeDisabled();
    });

    test('tutorial toggle is mutually exclusive with AI opponent', async ({ page }) => {
        await openLocalSetup(page);

        const opponent = page.getByTestId('local-opponent-type');
        const tutorial = page.locator('#localTutorialMode');

        await opponent.selectOption('ai');
        await expect(tutorial).toBeDisabled();

        await opponent.selectOption('human');
        await expect(tutorial).toBeEnabled();

        await tutorial.check();
        await expect(tutorial).toBeChecked();
    });
});
