// Layout & mobile-friendly e2e tests.
//
// Verifies that no visible interactive UI elements overlap each other on any
// screen, and that the layout stays mobile-friendly (no horizontal overflow,
// device-width viewport, 44px touch targets, canvas contained) across the
// supported browser/device matrix.
//
// Runs on every project: chromium (desktop) plus the compat projects
// (Firefox, WebKit/Safari, Pixel 7, iPhone 13, iPad Pro) via
// compatibilitySpecPatterns in playwright.config.js.

import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

// Interactive elements that must never overlap one another. #gameCanvas is
// included specifically so the board is checked against the header/footer.
const INTERACTIVE_SELECTORS =
    'button, input, select, textarea, a[href], [role="button"], [data-testid], #gameCanvas';

// Full-bleed / structural elements that legitimately cover the whole viewport
// and must be excluded from overlap detection (they sit behind content).
const FULL_BLEED_IDS = new Set([
    'gameBackgroundCanvas',
    'welcomeCanvas',
    'localSetupCanvas',
    'lobbyCanvas',
]);

const SCREENS = [
    { name: 'main menu', locator: '#mainMenuScreen', reach: (page) => page.goto('/') },
    {
        name: 'local setup',
        locator: '#localSetupScreen',
        reach: async (page) => {
            await page.locator('#localPlayBtn').click();
        },
    },
    {
        name: 'game',
        locator: '#gameScreen',
        reach: async (page) => {
            await page.locator('#localPlayBtn').click();
            await page.locator('.local-grid-btn[data-size="5"]').click();
            await page.locator('#startLocalGame').click();
        },
    },
    {
        name: 'lobby browser',
        locator: '#lobbyBrowserScreen',
        reach: async (page) => {
            await page.getByTestId('join-game-button').click();
        },
    },
];

// Wait for a screen to become active and let the CSS transition settle so
// getBoundingClientRect reflects the final layout (not a mid-transition box).
async function showScreen(page, screen) {
    await screen.reach(page);
    await expect(page.locator(screen.locator)).toHaveClass(/active/);
    await page.waitForTimeout(400);
}

// Every visible interactive element with its layout bounding box.
async function getInteractiveRects(page) {
    return page.evaluate(
        ({ selectors, fullBleedIds }) => {
            const els = Array.from(document.querySelectorAll(selectors));
            const out = [];
            for (const el of els) {
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;
                const style = getComputedStyle(el);
                if (
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    style.opacity === '0' ||
                    el.hasAttribute('hidden') ||
                    el.closest('.visually-hidden')
                ) {
                    continue;
                }
                if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;
                // Exclude the active full-bleed screen container and full-bleed
                // background canvases — they are structural layers, not colliding UI.
                if (el.classList.contains('screen')) continue;
                if (fullBleedIds.includes(el.id)) continue;
                if (rect.width >= window.innerWidth - 1 && rect.height >= window.innerHeight - 1) {
                    continue;
                }
                out.push({
                    testId: el.getAttribute('data-testid') || '',
                    id: el.id || '',
                    tag: el.tagName,
                    inputType: el.tagName === 'INPUT' ? el.getAttribute('type') || 'text' : '',
                    x: Math.round(rect.x * 100) / 100,
                    y: Math.round(rect.y * 100) / 100,
                    width: Math.round(rect.width * 100) / 100,
                    height: Math.round(rect.height * 100) / 100,
                    right: Math.round(rect.right * 100) / 100,
                    bottom: Math.round(rect.bottom * 100) / 100,
                    area: Math.round(rect.width * rect.height * 100) / 100,
                });
            }
            return out;
        },
        { selectors: INTERACTIVE_SELECTORS, fullBleedIds: Array.from(FULL_BLEED_IDS) }
    );
}

function rectsIntersect(a, b) {
    return !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
}

function intersectionArea(a, b) {
    const ix = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return ix > 0 && iy > 0 ? ix * iy : 0;
}

// Assert no pair of visible interactive elements overlaps by more than a
// sub-pixel noise threshold. Fails with a detailed list of the offending pairs.
async function expectNoOverlaps(page, { label, minOverlapArea = 4 } = {}) {
    const rects = await getInteractiveRects(page);
    const overlaps = [];
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            if (rectsIntersect(a, b)) {
                const area = intersectionArea(a, b);
                if (area > minOverlapArea) {
                    overlaps.push({ a, b, area });
                }
            }
        }
    }
    expect(overlaps).toEqual([]);
    if (overlaps.length > 0) {
        const detail = overlaps
            .map(
                (o) =>
                    `  - ${o.a.tag}#${o.a.id}[${
                        o.a.testId
                    }] at (${o.a.x},${o.a.y}) ${o.a.width}x${o.a.height} overlaps ` +
                    `${o.b.tag}#${o.b.id}[${o.b.testId}] at (${o.b.x},${o.b.y}) ` +
                    `${o.b.width}x${o.b.height} (overlap ~${o.area.toFixed(1)}px²)`
            )
            .join('\n');
        throw new Error(
            `Overlapping interactive elements detected${label ? ` on "${label}"` : ''}:\n${detail}`
        );
    }
}
// Assert mobile-friendly layout fundamentals for the current viewport.
async function expectMobileFriendly(page) {
    // No horizontal overflow: content must fit within the viewport width.
    const overflow = await page.evaluate(() => {
        return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            viewportMeta: Array.from(document.querySelectorAll('meta[name="viewport"]')).map((m) =>
                m.getAttribute('content')
            ),
        };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
    expect(overflow.viewportMeta.some((content) => content.includes('device-width'))).toBe(true);

    // Touch targets: every visible interactive element >= 44x44 on small viewports.
    // Elements entirely outside the viewport (e.g. off-screen skip links) and
    // structural text containers are not touch targets. User-agent-sized native
    // form controls (checkbox / radio / color) are exempt from author-enforced
    // sizing per WCAG target-size guidance.
    if (overflow.innerWidth <= 768) {
        const rects = await getInteractiveRects(page);
        const small = rects.filter((r) => {
            if (
                r.x < 0 ||
                r.y < 0 ||
                r.right > overflow.innerWidth ||
                r.bottom > overflow.innerHeight
            ) {
                return false;
            }
            if (r.tag === 'P' || r.tag === 'DIV' || r.tag === 'SPAN') return false;
            if (
                r.tag === 'INPUT' &&
                (r.inputType === 'checkbox' || r.inputType === 'radio' || r.inputType === 'color')
            ) {
                return false;
            }
            return r.width < 44 || r.height < 44;
        });
        expect(small).toEqual([]);
        if (small.length > 0) {
            throw new Error(
                `Touch targets below 44px on ${overflow.innerWidth}px viewport:\n${small
                    .map(
                        (r) =>
                            `  - ${r.tag}#${r.id}[${r.testId}] ${r.width}x${r.height} at (${r.x},${r.y})`
                    )
                    .join('\n')}`
            );
        }
    }
}

test.describe('Layout: no overlapping UI elements', () => {
    for (const screen of SCREENS) {
        test(`nothing overlaps on the ${screen.name} screen (native device viewport)`, async ({
            page,
        }) => {
            await gotoApp(page);
            await showScreen(page, screen);
            await expectNoOverlaps(page, { label: screen.name });
        });
    }
});

test.describe('Layout: mobile friendly', () => {
    test('main menu fits the viewport with no overflow on mobile', async ({ page }) => {
        await gotoApp(page);
        await expectMobileFriendly(page);
    });

    test('game canvas stays inside the viewport on mobile portrait', async ({ page }) => {
        await gotoApp(page);
        await page.setViewportSize({ width: 390, height: 844 }); // iPhone 13
        await showScreen(page, SCREENS[2]); // game
        await expectNoOverlaps(page, { label: 'game (mobile portrait)' });
        await expectMobileFriendly(page);

        // Canvas must not be covered by the footer / header on a narrow screen.
        const canvasInViewport = await page.evaluate(() => {
            const canvas = document.querySelector('#gameCanvas');
            if (!canvas) return null;
            const r = canvas.getBoundingClientRect();
            return {
                left: Math.round(r.x),
                right: Math.round(r.right),
                top: Math.round(r.y),
                bottom: Math.round(r.bottom),
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
            };
        });
        expect(canvasInViewport).not.toBeNull();
        expect(canvasInViewport.left).toBeGreaterThanOrEqual(0);
        expect(canvasInViewport.right).toBeLessThanOrEqual(canvasInViewport.innerWidth);
        expect(canvasInViewport.top).toBeGreaterThanOrEqual(0);
        expect(canvasInViewport.bottom).toBeLessThanOrEqual(canvasInViewport.innerHeight);
    });

    test('local setup grid buttons do not overlap on mobile portrait', async ({ page }) => {
        await gotoApp(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await showScreen(page, SCREENS[1]); // local setup
        await expectNoOverlaps(page, { label: 'local setup (mobile portrait)' });
        await expectMobileFriendly(page);
    });

    test('lobby browser inputs and buttons do not overlap on mobile portrait', async ({ page }) => {
        await gotoApp(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await showScreen(page, SCREENS[3]); // lobby browser
        await expectNoOverlaps(page, { label: 'lobby browser (mobile portrait)' });
        await expectMobileFriendly(page);
    });

    test('main menu stays usable when rotated to mobile landscape', async ({ page }) => {
        await gotoApp(page);
        await page.setViewportSize({ width: 844, height: 390 }); // landscape
        await expectNoOverlaps(page, { label: 'main menu (mobile landscape)' });
        await expectMobileFriendly(page);
    });

    test('local setup grid size options wrap without overlap on tablet', async ({ page }) => {
        await gotoApp(page);
        await page.setViewportSize({ width: 834, height: 1194 }); // iPad Pro
        await showScreen(page, SCREENS[1]); // local setup
        await expectNoOverlaps(page, { label: 'local setup (tablet)' });
        await expectMobileFriendly(page);
    });
});
