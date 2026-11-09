import { describe, expect, it } from 'vitest';
import { formatHexAlpha } from '../utils.js';

describe('formatHexAlpha', () => {
    it('appends clamped alpha to standard 6-digit hex color', () => {
        expect(formatHexAlpha('#ff0000', 1)).toBe('#ff0000ff');
        expect(formatHexAlpha('#4A90E2', 0.5)).toBe('#4A90E27f');
        expect(formatHexAlpha('#000000', 0)).toBe('#00000000');
    });

    it('expands 3-digit hex color to 6-digit before appending alpha', () => {
        expect(formatHexAlpha('#f00', 1)).toBe('#ff0000ff');
        expect(formatHexAlpha('#abc', 0.25)).toBe('#aabbcc3f');
    });

    it('replaces existing alpha in 8-digit hex colors', () => {
        expect(formatHexAlpha('#ff0000aa', 0.5)).toBe('#ff00007f');
        expect(formatHexAlpha('#11223344', 0)).toBe('#11223300');
    });

    it('clamps negative alpha and alpha > 1 to prevent invalid hex formatting', () => {
        // Negative alpha previously produced invalid strings like #ff0000-5
        expect(formatHexAlpha('#ff0000', -0.5)).toBe('#ff000000');
        expect(formatHexAlpha('#ff0000', -100)).toBe('#ff000000');
        expect(formatHexAlpha('#ff0000', 1.5)).toBe('#ff0000ff');
        expect(formatHexAlpha('#ff0000', 999)).toBe('#ff0000ff');
        expect(formatHexAlpha('#ff0000', NaN)).toBe('#ff000000');
        expect(formatHexAlpha('#ff0000', Infinity)).toBe('#ff000000');
    });

    it('formats rgb() colors to rgba() format', () => {
        expect(formatHexAlpha('rgb(255, 0, 0)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
        expect(formatHexAlpha('rgb(10, 20, 30)', 1)).toBe('rgba(10, 20, 30, 1)');
    });

    it('returns non-string or unknown input safely', () => {
        expect(formatHexAlpha(null, 0.5)).toBe('#00000000');
        expect(formatHexAlpha(undefined, 0.5)).toBe('#00000000');
        expect(formatHexAlpha('blue', 0.5)).toBe('blue');
    });
});
