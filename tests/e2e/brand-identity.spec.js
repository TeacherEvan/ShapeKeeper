// Cosmic "Shape Keeper" identity — rendered proof.
//
// The identity ships as CSS tokens + a canvas palette; neither is provable by
// reading source, so every assertion here reads the COMPUTED style of the live
// page: the void backdrop, the hero art plate (real pixels + the 16:9 crop), the
// split SHAPE / KEEPER wordmark gradients, the nebula substrate with no grid
// lines, and the dawn variant after a toggle.
import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

const VOID = { bg: '#030611', accent: '#00f0ff', secondary: '#e000ff', inverse: '#030611' };
const DAWN = { bg: '#f4f1ff', accent: '#0a6d95', secondary: '#7a12d6' };

function readTokens(page) {
    return page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const get = (name) => cs.getPropertyValue(name).trim();
        return {
            bg: get('--bg-primary'),
            accent: get('--accent-primary'),
            secondary: get('--accent-secondary'),
            inverse: get('--text-inverse'),
        };
    });
}

function readSurface(page, selector) {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { image: cs.backgroundImage, color: cs.backgroundColor };
    }, selector);
}

test.describe('cosmic brand identity', () => {
    test('renders the void identity, hero art and split wordmark without page errors', async ({
        page,
    }) => {
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await gotoApp(page);

        await expect(page.getByTestId('main-menu-screen')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

        // 1. Void tokens are live, sourced from styles/cosmic-identity.css.
        expect(await readTokens(page)).toEqual(VOID);

        // 2. The supplied promo art is the menu hero, cropped to the artwork so it
        //    does not repeat the baked-in title in the lower third of the file.
        const plate = page.locator('#mainMenuScreen .brand-plate');
        await expect(plate).toBeVisible();
        await expect(plate).toHaveAttribute('src', 'assets/branding/shape-keeper-plate.jpg');
        // The shipped plate is the promo art's artwork band (figures + shapes);
        // its baked-in title/lockup (y>=225 in the source file) is cropped away.
        expect(await plate.evaluate((img) => [img.naturalWidth, img.naturalHeight])).toEqual([
            384, 216,
        ]);
        const box = await plate.boundingBox();
        expect(box.width / box.height).toBeCloseTo(16 / 9, 1);

        // 3. Wordmark: the accessible name is still the single word, and the two
        //    halves carry the cyan and magenta brand gradients.
        const heading = page.getByTestId('main-menu-screen').getByRole('heading');
        const name = (await heading.textContent()).replace(/\s+/g, '');
        expect(name).toBe('ShapeKeeper');

        const wordmark = await page.evaluate(() => {
            const grab = (selector) => {
                const cs = getComputedStyle(document.querySelector(selector));
                return { image: cs.backgroundImage, color: cs.color };
            };
            return { shape: grab('.wordmark-shape'), keeper: grab('.wordmark-keeper') };
        });
        expect(wordmark.shape.image).toContain('rgb(0, 240, 255)');
        expect(wordmark.keeper.image).toContain('rgb(255, 92, 255)');
        expect(wordmark.shape.color).toBe('rgba(0, 0, 0, 0)');

        // 4. Substrate is a nebula wash — no reintroduced grid lines.
        const menuSurface = await readSurface(page, '#mainMenuScreen');
        expect(menuSurface.image).toContain('radial-gradient');
        expect(menuSurface.image).not.toContain('linear-gradient');

        const gameSurface = await readSurface(page, '#gameScreen');
        expect(gameSurface.image).toContain('radial-gradient');
        expect(gameSurface.image).not.toContain('linear-gradient');

        expect(pageErrors).toEqual([]);
    });

    test('toggles to the dawn nebula variant and back', async ({ page }) => {
        await gotoApp(page);
        const root = page.locator('html');

        await page.locator('#themeToggle').click();
        await expect(root).toHaveAttribute('data-theme', 'light');
        const dawnTokens = await readTokens(page);
        expect(dawnTokens.bg).toBe(DAWN.bg);
        expect(dawnTokens.accent).toBe(DAWN.accent);
        expect(dawnTokens.secondary).toBe(DAWN.secondary);

        // The wordmark repaints with the dawn gradients (deeper ink on pale paper).
        const keeper = await page.evaluate(
            () => getComputedStyle(document.querySelector('.wordmark-keeper')).backgroundImage
        );
        expect(keeper).toContain('rgb(160, 26, 214)');

        await page.locator('#themeToggle').click();
        await expect(root).toHaveAttribute('data-theme', 'dark');
        expect(await readTokens(page)).toEqual(VOID);
    });

    test('hides the art plate on short viewports so the menu stays above the fold', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await gotoApp(page);

        await expect(page.getByTestId('main-menu-screen')).toBeVisible();
        await expect(page.locator('#mainMenuScreen .brand-plate')).toBeHidden();

        // The wordmark carries the brand when the art steps aside.
        await expect(page.locator('.wordmark-shape')).toBeVisible();
    });
});
