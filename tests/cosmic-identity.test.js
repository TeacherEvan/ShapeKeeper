import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WelcomeAnimation } from '../src/ui/WelcomeAnimation.js';
import { getCurrentTheme, initializeTheme, toggleTheme } from '../src/ui/ThemeManager.js';

/**
 * Cosmic "Shape Keeper" identity contract.
 *
 * The identity is delivered as CSS (styles/cosmic-identity.css, imported LAST by
 * styles.css) plus the canvas palette in WelcomeAnimation. Neither is executable
 * in jsdom, so this suite asserts the SHIPPED VALUES: it parses the real
 * stylesheet tokens, proves the inverse-text contrast ratios by the WCAG
 * formula, proves the substrate is a nebula wash with no grid lines, and proves
 * the live canvas ink resolves to the same values the CSS declares.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const IDENTITY_CSS = read('styles/cosmic-identity.css');
const SHELL_CSS = read('styles.css');
const INDEX_HTML = read('index.html');

/** Pull every `--token: value` out of the `:root` / `[data-theme='dark']` blocks. */
function parseThemeTokens(css) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const themes = { light: {}, dark: {} };
    const blockRe = /(:root|\[data-theme='dark'\])\s*\{([^}]*)\}/g;
    let block;
    while ((block = blockRe.exec(stripped)) !== null) {
        const bucket = block[1] === ':root' ? themes.light : themes.dark;
        const declRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
        let decl;
        while ((decl = declRe.exec(block[2])) !== null) {
            bucket[decl[1]] = decl[2].trim();
        }
    }
    return themes;
}

/** Extract one rule body by selector so the substrate can be checked in isolation. */
function ruleBody(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    return match ? match[1] : null;
}

function channel(v) {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
    const h = hex.replace('#', '');
    const full =
        h.length === 3
            ? h
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : h;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fgHex, bgHex) {
    const [a, b] = [luminance(fgHex), luminance(bgHex)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
}

const tokens = parseThemeTokens(IDENTITY_CSS);

describe('cosmic identity — stylesheet contract', () => {
    it('is imported LAST so it repaints the token system', () => {
        const imports = [...SHELL_CSS.matchAll(/@import\s+'([^']+)'/g)].map((m) => m[1]);
        expect(imports.at(-1)).toBe('./styles/cosmic-identity.css');
        expect(imports).toContain('./styles/blueprint.css');
    });

    it('declares both themes with the promo-art ink', () => {
        expect(tokens.dark['--bg-primary']).toBe('#030611'); // cosmic void
        expect(tokens.dark['--accent-primary']).toBe('#00f0ff'); // electric cyan
        expect(tokens.dark['--accent-secondary']).toBe('#e000ff'); // neon magenta
        expect(tokens.dark['--accent-warning']).toBe('#ffc700'); // solar amber
        expect(tokens.light['--bg-primary']).toBe('#f4f1ff'); // daylight nebula
        expect(tokens.light['--accent-primary']).not.toBe(tokens.dark['--accent-primary']);
    });

    it('keeps inverse text legible on every action ink (WCAG AA, 4.5:1)', () => {
        for (const theme of ['light', 'dark']) {
            const t = tokens[theme];
            for (const ink of ['--accent-primary', '--accent-secondary', '--accent-danger']) {
                expect(
                    contrast(t['--text-inverse'], t[ink]),
                    `${theme} ${ink} vs inverse text`
                ).toBeGreaterThanOrEqual(4.5);
            }
            for (const text of ['--text-primary', '--text-secondary', '--text-tertiary']) {
                expect(
                    contrast(t[text], t['--bg-primary']),
                    `${theme} ${text} vs backdrop`
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('paints a nebula wash, not a grid (product owner: "Remove colour gridlines!!!")', () => {
        const screen = ruleBody(IDENTITY_CSS, '.screen,\n#gameScreen');
        expect(screen).not.toBeNull();
        expect(screen).toContain('radial-gradient');
        expect(screen).not.toContain('linear-gradient');

        const game = ruleBody(IDENTITY_CSS, '#gameScreen') || screen;
        expect(game).not.toContain('linear-gradient');
        // The removed sheet of grid lines must not come back.
        expect(IDENTITY_CSS).not.toContain('28px 28px');
    });

    it('splits the wordmark into two gradients (SHAPE / KEEPER)', () => {
        for (const theme of ['light', 'dark']) {
            const t = tokens[theme];
            expect(t['--wordmark-a-from']).toBeTruthy();
            expect(t['--wordmark-b-from']).toBeTruthy();
            expect(t['--wordmark-a-from']).not.toBe(t['--wordmark-b-from']);
        }
        expect(IDENTITY_CSS).toContain('background-clip: text');
    });
});

describe('cosmic identity — shell contract', () => {
    it('ships the void theme as the document default (no flash before JS)', () => {
        expect(INDEX_HTML).toMatch(/<html lang="en" data-theme="dark">/);
        expect(INDEX_HTML).toContain('content="#030611"');
    });

    it('ships the supplied promo art in-repo and uses it on the menu + social cards', () => {
        expect(INDEX_HTML).toContain('src="assets/branding/shape-keeper-plate.jpg"');
        expect(INDEX_HTML).toContain('assets/branding/shape-keeper-hero.jpg');
        expect(INDEX_HTML).toContain('assets/branding/shape-keeper-mark.svg');
        expect(INDEX_HTML).toContain(
            'https://shape-keeper.vercel.app/assets/branding/shape-keeper-hero.jpg'
        );
    });

    it('renders the name as one accessible word with a visual break', () => {
        expect(INDEX_HTML).toMatch(/<span class="wordmark-shape">Shape<\/span>/);
        expect(INDEX_HTML).toMatch(/class="wordmark-keeper"/);
        // No whitespace text node between the spans, so the accessible name is
        // still the single word "ShapeKeeper".
        expect(INDEX_HTML).toMatch(
            /class="wordmark-shape">Shape<\/span><span class="wordmark-keeper"/
        );
    });
});

function stubContext() {
    const noop = () => {};
    return {
        scale: noop,
        fillRect: noop,
        beginPath: noop,
        arc: noop,
        fill: noop,
        moveTo: noop,
        lineTo: noop,
        stroke: noop,
        closePath: noop,
        save: noop,
        restore: noop,
    };
}

describe('cosmic identity — live canvas ink matches the stylesheet', () => {
    let animation;
    let realGetContext;

    beforeEach(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.innerHTML = '<canvas id="welcomeCanvas"></canvas>';
        realGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = () => stubContext();
        animation = new WelcomeAnimation();
    });

    afterEach(() => {
        animation?.stop();
        HTMLCanvasElement.prototype.getContext = realGetContext;
        document.documentElement.removeAttribute('data-theme');
        document.body.innerHTML = '';
    });

    it('paints the promo palette (cyan, magenta, amber, lime)', () => {
        const darkInk = animation.colorPalette.dark.map((set) => set.primary);
        expect(darkInk).toEqual(['#00f0ff', '#e000ff', '#ffc700', '#22ff00']);
        expect(animation.colorPalette.light[0].primary).toBe('#0a86ad');
    });

    it('resolves the canvas clear colour to the CSS backdrop for each theme', () => {
        const voidRgb = tokens.dark['--bg-primary']
            .replace('#', '')
            .match(/../g)
            .map((h) => parseInt(h, 16))
            .join(', ');
        const dawnRgb = tokens.light['--bg-primary']
            .replace('#', '')
            .match(/../g)
            .map((h) => parseInt(h, 16))
            .join(', ');

        expect(animation.themedInk(animation.canvasTint)).toBe(voidRgb);
        document.documentElement.setAttribute('data-theme', 'light');
        expect(animation.themedInk(animation.canvasTint)).toBe(dawnRgb);
    });

    it('links constellation particles in cyan, not grey', () => {
        expect(animation.themedInk(animation.constellationInk)).toBe('0, 240, 255');
        expect(animation.themedInk(animation.constellationInk)).not.toBe('100, 100, 120');
    });
});

describe('cosmic identity — theme default', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('boots into the void theme and persists a toggle to dawn', () => {
        initializeTheme();
        expect(getCurrentTheme()).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        toggleTheme();
        expect(getCurrentTheme()).toBe('light');
        expect(localStorage.getItem('shapekeeper_theme')).toBe('light');

        // The toggle button advertises the NEXT theme, not the current one.
        const label = document.getElementById('themeToggle')?.getAttribute('aria-label');
        if (label) expect(label).toBe('Switch to dark mode');
    });
});
