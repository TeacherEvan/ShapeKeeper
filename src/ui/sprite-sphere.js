/**
 * ShapeKeeper — 3D Luminous Mini-Sphere Renderer
 *
 * Pre-renders each sprite's volumetric sphere + atmospheric corona onto a small
 * cached offscreen canvas so the 60 Hz animation loop blits crisp 3D orbs at
 * minimal GPU/CPU cost instead of stroking flat polygons.
 *
 * @module ui/sprite-sphere
 */

export const SPHERE_STAMP_SIZE = 64;
export const SPHERE_STAMP_CORE_R = 12;
export const SPHERE_DRAW_SCALE = SPHERE_STAMP_SIZE / (SPHERE_STAMP_CORE_R * 2);

const stampCache = new Map();

/**
 * Parse a comma-separated `'r, g, b'` channel string into a 3-element numeric array.
 *
 * @param {string} rgb
 * @returns {[number, number, number]}
 */
export function parseRgbChannels(rgb) {
    if (typeof rgb !== 'string') return [255, 255, 255];
    const parts = rgb.split(',').map((n) => Number(n.trim()));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
        return [Math.round(parts[0]), Math.round(parts[1]), Math.round(parts[2])];
    }
    return [255, 255, 255];
}

/**
 * Linearly blend an `[r, g, b]` tuple toward a target `[r, g, b]` colour.
 *
 * @param {[number, number, number]} channels
 * @param {[number, number, number]} target
 * @param {number} amount
 * @returns {string} `'r, g, b'` formatted string
 */
export function mixRgb(channels, target, amount) {
    const t = Math.max(0, Math.min(1, amount));
    const r = Math.round(channels[0] + (target[0] - channels[0]) * t);
    const g = Math.round(channels[1] + (target[1] - channels[1]) * t);
    const b = Math.round(channels[2] + (target[2] - channels[2]) * t);
    return `${r}, ${g}, ${b}`;
}

/** Clear all cached mini-sphere offscreen stamps. */
export function clearSphereStampCache() {
    stampCache.clear();
}

/**
 * Return (and lazily cache) a 64x64 volumetric 3D sphere canvas stamp for the given
 * sprite ink and theme polarity. Returns `null` when Canvas 2D is unavailable.
 *
 * @param {string} color
 * @param {string} rgb
 * @param {boolean} isDark
 * @returns {HTMLCanvasElement|null}
 */
export function getSphereStamp(color, rgb, isDark) {
    const key = `${isDark ? 'd' : 'l'}:${color}:${rgb || ''}`;
    if (stampCache.has(key)) return stampCache.get(key);

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = SPHERE_STAMP_SIZE;
    canvas.height = SPHERE_STAMP_SIZE;
    const ctx = canvas.getContext?.('2d');
    if (!ctx || typeof ctx.createRadialGradient !== 'function') {
        return null;
    }

    const ch = parseRgbChannels(rgb);
    const rgbStr = `${ch[0]}, ${ch[1]}, ${ch[2]}`;
    const cx = SPHERE_STAMP_SIZE / 2;
    const cy = SPHERE_STAMP_SIZE / 2;
    const r = SPHERE_STAMP_CORE_R;

    // 1. Atmospheric corona bloom
    const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    corona.addColorStop(0, `rgba(${rgbStr}, ${isDark ? 0.34 : 0.2})`);
    corona.addColorStop(0.4, `rgba(${rgbStr}, ${isDark ? 0.34 : 0.2})`);
    corona.addColorStop(0.68, `rgba(${rgbStr}, ${isDark ? 0.11 : 0.05})`);
    corona.addColorStop(1, `rgba(${rgbStr}, 0)`);
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, SPHERE_STAMP_SIZE, SPHERE_STAMP_SIZE);

    // 2. 3D volumetric sphere body
    const bodyGrad = ctx.createRadialGradient(cx - 4.1, cy - 4.3, 1.0, cx, cy, 12.2);
    bodyGrad.addColorStop(0, `rgb(${mixRgb(ch, [255, 255, 255], isDark ? 0.84 : 0.72)})`);
    bodyGrad.addColorStop(0.28, `rgb(${mixRgb(ch, [255, 255, 255], 0.18)})`);
    bodyGrad.addColorStop(0.62, `rgb(${rgbStr})`);
    bodyGrad.addColorStop(0.9, `rgb(${mixRgb(ch, [8, 12, 20], isDark ? 0.56 : 0.38)})`);
    bodyGrad.addColorStop(1, `rgb(${mixRgb(ch, [4, 8, 14], isDark ? 0.72 : 0.52)})`);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 3. Subsurface / Fresnel rim bounce clipped inside the sphere
    ctx.save?.();
    ctx.beginPath();
    ctx.arc(cx, cy, 11.8, 0, Math.PI * 2);
    ctx.clip?.();
    const bounce = ctx.createRadialGradient(cx + 4.4, cy + 4.6, 0.5, cx + 4.4, cy + 4.6, 7.5);
    bounce.addColorStop(0, `rgba(${mixRgb(ch, [255, 255, 255], 0.5)}, ${isDark ? 0.44 : 0.28})`);
    bounce.addColorStop(1, `rgba(${rgbStr}, 0)`);
    ctx.fillStyle = bounce;
    ctx.fillRect(0, 0, SPHERE_STAMP_SIZE, SPHERE_STAMP_SIZE);
    ctx.restore?.();

    // 4. Crisp glass specular pinpoint
    ctx.fillStyle = `rgba(255, 255, 255, ${isDark ? 0.92 : 0.86})`;
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(cx - 4.2, cy - 4.3, 2.6, 1.7, -0.65, 0, Math.PI * 2);
    } else {
        ctx.arc(cx - 4.2, cy - 4.3, 2.1, 0, Math.PI * 2);
    }
    ctx.fill();

    // 5. Hairline rim definition
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(15, 23, 42, 0.16)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.arc(cx, cy, 11.75, 0, Math.PI * 2);
    ctx.stroke();

    stampCache.set(key, canvas);
    return canvas;
}

/**
 * Draw a 3D luminous static mini sphere centered at `(x, y)`.
 * Uses a cached offscreen stamp when available and falls back to crisp
 * two-pass vector fills for headless test mocks.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{color: string, rgb?: string}} particle
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {number} alpha
 * @param {boolean} isDark
 */
export function drawSphereSprite(ctx, particle, x, y, radius, alpha, isDark) {
    if (!ctx || !(radius > 0) || !(alpha > 0.005)) return;

    const stamp =
        typeof ctx.drawImage === 'function'
            ? getSphereStamp(particle.color, particle.rgb, Boolean(isDark))
            : null;

    if (stamp && typeof ctx.drawImage === 'function') {
        const span = radius * 2 * SPHERE_DRAW_SCALE;
        ctx.save?.();
        ctx.globalAlpha = alpha;
        ctx.drawImage(stamp, x - span / 2, y - span / 2, span, span);
        ctx.restore?.();
        return;
    }

    ctx.save?.();
    ctx.translate?.(x, y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath?.();
    ctx.arc?.(0, 0, radius, 0, Math.PI * 2);
    ctx.fill?.();

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha * 0.82;
    ctx.beginPath?.();
    ctx.arc?.(-radius * 0.34, -radius * 0.34, radius * 0.28, 0, Math.PI * 2);
    ctx.fill?.();
    ctx.restore?.();
}
