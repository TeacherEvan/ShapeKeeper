import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

const STORAGE_KEY = 'shapekeeper_donation_prompt.v1';
const DONATE_URL = 'https://example.com/donate';

/**
 * Open the real dialog through the real module, bypassing the level cadence
 * (which would otherwise require playing five levels). The DOM, the event
 * wiring, the storage writes and the focus handling are all genuine.
 */
async function openPrompt(page, { force = true } = {}) {
    // Deliberately do NOT return the module promise: it resolves only after the
    // player acts, and awaiting it here would deadlock the evaluate call.
    await page.evaluate(
        async ({ url, forcePrompt }) => {
            window.DONATION_URL = url;
            window.open = (...args) => {
                window.__opened = args;
                return null;
            };
            const mod = await import('/src/ui/DonationPrompt.js');
            void mod.maybeShowDonationPrompt({ level: 5, force: forcePrompt });
        },
        { url: DONATE_URL, forcePrompt: force }
    );
}

test.describe('donation prompt', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript((key) => localStorage.removeItem(key), STORAGE_KEY);
        await gotoApp(page);
    });

    test('asks, thanks, and records a donor only on explicit confirmation', async ({ page }) => {
        await openPrompt(page);

        const overlay = page.locator('#donationPromptOverlay');
        await expect(overlay).toBeVisible();
        await expect(overlay).toHaveAttribute('role', 'dialog');

        const askCard = page.locator('#donationAskCard');
        await expect(askCard).toBeVisible();
        await expect(askCard).toContainText('Consider donating ❤️');
        await expect(page.locator('#donationLaterBtn')).toHaveText('🐷');
        // The ask must not advertise the gratitude badge.
        await expect(askCard).not.toContainText('🧚');

        await page.locator('#donationSureBtn').click();

        const thanksCard = page.locator('#donationThanksCard');
        await expect(thanksCard).toBeVisible();
        await expect(thanksCard).toContainText('🧚');
        await expect(askCard).toBeHidden();

        const opened = await page.evaluate(() => window.__opened);
        expect(opened[0]).toBe(DONATE_URL);
        expect(opened[1]).toBe('_blank');

        // Not a donor until they say so.
        let stored = await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)),
            STORAGE_KEY
        );
        expect(stored.donor).not.toBe(true);

        await page.locator('#donationConfirmBtn').click();
        await expect(overlay).toBeHidden();

        stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
        expect(stored.donor).toBe(true);
        expect(stored.donatedAt).toBeTruthy();
    });

    test('shows gratitude, not the ask, to a returning donor', async ({ page }) => {
        await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
            key: STORAGE_KEY,
            state: { lastPromptLevel: 0, donor: true, donatedAt: '2026-10-25' },
        });

        await openPrompt(page);

        await expect(page.locator('#donationAskCard')).toBeHidden();
        const thanksCard = page.locator('#donationThanksCard');
        await expect(thanksCard).toBeVisible();
        await expect(thanksCard).toContainText('You already support ShapeKeeper');
        await expect(page.locator('#donationConfirmBtn')).toBeHidden();

        await page.locator('#donationThanksCloseBtn').click();
        await expect(page.locator('#donationPromptOverlay')).toBeHidden();
    });

    test('stays silent when no donation URL is configured', async ({ page }) => {
        const result = await page.evaluate(async () => {
            window.DONATION_URL = '';
            const mod = await import('/src/ui/DonationPrompt.js');
            return mod.maybeShowDonationPrompt({ level: 5, force: true });
        });

        expect(result).toBe('skipped');
        await expect(page.locator('#donationPromptOverlay')).toBeHidden();
    });
});
