/**
 * ShapeKeeper — Background Sprite Ink
 *
 * The floating "friendly shape" sprites that drift behind the menu and the board
 * draw from this palette. One colour family per hue band, so the background
 * reads as a full spectrum (red, orange, amber, green, cyan, blue, purple,
 * magenta, pink) instead of a cyan haze.
 *
 * Two rules, both enforced by `tests/cosmic-identity.test.js`:
 *  1. Every ink is saturated (HSL S >= 60%) — pastel washes disappear at the
 *     2–7 px sprite size and at trail opacity.
 *  2. Every ink clears WCAG 1.4.11 non-text contrast (>= 3:1) against its own
 *     theme backdrop (`--bg-primary`), so no sprite is invisible on the canvas.
 *
 * The four original families keep the exact cosmic brand tokens from
 * `styles/cosmic-identity.css` (`--cosmic-cyan`, `--cosmic-magenta`,
 * `--cosmic-amber`, `--cosmic-lime`) plus their azure/violet secondaries.
 *
 * @module ui/sprite-palette
 */

/**
 * @typedef {{ primary: string, secondary: string, accent: string }} SpriteInkSet
 */

/** @type {{ light: SpriteInkSet[], dark: SpriteInkSet[] }} */
export const SPRITE_PALETTES = {
    // Dawn nebula backdrop (#f4f1ff): mid-tone saturated inks.
    light: [
        { primary: '#0a86ad', secondary: '#096b8c', accent: '#0a8fb0' }, // cyan
        { primary: '#b3129e', secondary: '#8f0d7f', accent: '#cf1f8f' }, // magenta
        { primary: '#a67c00', secondary: '#8f6f00', accent: '#b07d00' }, // amber
        { primary: '#0f8a3d', secondary: '#0b6e31', accent: '#169044' }, // green
        { primary: '#c81e3a', secondary: '#a5162e', accent: '#e02444' }, // red
        { primary: '#c05600', secondary: '#9c4500', accent: '#d4700a' }, // orange
        { primary: '#1f4fd8', secondary: '#1840b0', accent: '#2f66e8' }, // blue
        { primary: '#6d28d9', secondary: '#571fb0', accent: '#8547e8' }, // purple
        { primary: '#c2185b', secondary: '#9e1349', accent: '#d92b6f' }, // pink
    ],
    // Cosmic void backdrop (#030611): the neon promo-art inks.
    dark: [
        { primary: '#00f0ff', secondary: '#0088ff', accent: '#7ffcff' }, // cyan
        { primary: '#e000ff', secondary: '#8a00ff', accent: '#ff8cff' }, // magenta
        { primary: '#ffc700', secondary: '#ff8c00', accent: '#ffe680' }, // amber
        { primary: '#22ff00', secondary: '#7dff5c', accent: '#c8ffb0' }, // lime
        { primary: '#ff4d6d', secondary: '#ff2e4d', accent: '#ff9aa2' }, // red
        { primary: '#ff8a1f', secondary: '#ff6a00', accent: '#ffc28a' }, // orange
        { primary: '#3d7bff', secondary: '#6ea8ff', accent: '#b6d0ff' }, // blue
        { primary: '#a855f7', secondary: '#8b5cf6', accent: '#d8b4fe' }, // purple
        { primary: '#ff5fa2', secondary: '#ff8dc2', accent: '#ffc2dd' }, // pink
    ],
};

/**
 * Convert `#rrggbb` (or `#rgb`) to the `r, g, b` channel list used by canvas
 * `rgba(...)` strings. Computed once per sprite at spawn time so the draw loop
 * never parses colours on the hot path.
 *
 * @param {string} hex
 * @returns {string} e.g. `'0, 240, 255'`; falls back to white on bad input.
 */
export function hexToRgbChannels(hex) {
    if (typeof hex !== 'string') return '255, 255, 255';
    let value = hex.trim().replace('#', '');
    if (value.length === 3) {
        value = value
            .split('')
            .map((c) => c + c)
            .join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return '255, 255, 255';
    const num = parseInt(value, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}
