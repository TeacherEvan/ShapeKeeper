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
    // Warm Ivory Paper backdrop (#f7f4ec): mid-tone saturated inks.
    light: [
        { primary: '#c81e32', secondary: '#9f1239', accent: '#dc2626' }, // crimson red
        { primary: '#1d4ed8', secondary: '#1e40af', accent: '#2563eb' }, // cobalt blue
        { primary: '#a67c00', secondary: '#8f6f00', accent: '#b07d00' }, // solar gold / amber
        { primary: '#0f8a3d', secondary: '#0b6e31', accent: '#169044' }, // emerald green
        { primary: '#c05600', secondary: '#9c4500', accent: '#d4700a' }, // orange
        { primary: '#0a7a8c', secondary: '#08606e', accent: '#0e8ea3' }, // deep teal
        { primary: '#6d28d9', secondary: '#571fb0', accent: '#8547e8' }, // purple
        { primary: '#a21caf', secondary: '#86198f', accent: '#c026d3' }, // berry
        { primary: '#c2185b', secondary: '#9e1349', accent: '#d92b6f' }, // rose
    ],
    // Obsidian Slate backdrop (#0b0e14): Arcade Classic inks.
    dark: [
        { primary: '#ef4444', secondary: '#dc2626', accent: '#fca5a5' }, // crimson red
        { primary: '#3b82f6', secondary: '#2563eb', accent: '#93c5fd' }, // cobalt blue
        { primary: '#f5b727', secondary: '#d97706', accent: '#fde68a' }, // solar gold
        { primary: '#22c55e', secondary: '#16a34a', accent: '#86efac' }, // emerald green
        { primary: '#f97316', secondary: '#ea580c', accent: '#fdba74' }, // orange
        { primary: '#06b6d4', secondary: '#0891b2', accent: '#67e8f9' }, // ocean teal
        { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#c4b5fd' }, // violet
        { primary: '#c026d3', secondary: '#a21caf', accent: '#e879f9' }, // berry
        { primary: '#fb7185', secondary: '#f43f5e', accent: '#fda4af' }, // coral-rose
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
