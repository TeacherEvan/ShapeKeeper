import { describe, it, expect } from 'vitest';

/**
 * Computes WCAG relative luminance from a hex color string.
 * @param {string} hex - e.g. '#0072B2'
 * @returns {number} Relative luminance in [0, 1]
 */
function getRelativeLuminance(hex) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Computes WCAG contrast ratio between two hex colors.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number} Contrast ratio >= 1.0
 */
function getContrastRatio(hex1, hex2) {
    const l1 = getRelativeLuminance(hex1);
    const l2 = getRelativeLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

describe('Accessibility: Color-blind-safe local palette', () => {
    const P1_COLOR = '#0072B2'; // Okabe-Ito blue
    const P2_COLOR = '#E69F00'; // Okabe-Ito orange

    it('has WCAG relative-luminance contrast ratio between players >= 2.0', () => {
        const ratio = getContrastRatio(P1_COLOR, P2_COLOR);
        expect(ratio).toBeGreaterThanOrEqual(2.0);
    });

    it('both colors are valid 6-character hex colors', () => {
        expect(P1_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(P2_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
});
