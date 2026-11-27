// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    SPHERE_DRAW_SCALE,
    SPHERE_STAMP_SIZE,
    clearSphereStampCache,
    drawSphereSprite,
    getSphereStamp,
    mixRgb,
    parseRgbChannels,
} from '../src/ui/sprite-sphere.js';

function makeGradStub() {
    return { addColorStop: vi.fn() };
}

function makeOffscreenCtx() {
    return {
        createRadialGradient: vi.fn(() => makeGradStub()),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        clip: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
    };
}

describe('sprite-sphere — 3D luminous mini-sphere renderer', () => {
    const origCreateElement = document.createElement.bind(document);

    afterEach(() => {
        clearSphereStampCache();
        document.createElement = origCreateElement;
        vi.restoreAllMocks();
    });

    it('parses valid RGB channel strings and blends smoothly with mixRgb', () => {
        expect(parseRgbChannels('245, 183, 39')).toEqual([245, 183, 39]);
        expect(parseRgbChannels('invalid')).toEqual([255, 255, 255]);
        expect(mixRgb([100, 100, 100], [200, 200, 200], 0.5)).toBe('150, 150, 150');
        expect(mixRgb([10, 20, 30], [255, 255, 255], 0)).toBe('10, 20, 30');
    });

    it('caches offscreen sphere stamps per color and theme polarity', () => {
        const mockCtx = makeOffscreenCtx();
        document.createElement = vi.fn((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'canvas') el.getContext = vi.fn(() => mockCtx);
            return el;
        });

        const darkA = getSphereStamp('#f5b727', '245, 183, 39', true);
        const darkB = getSphereStamp('#f5b727', '245, 183, 39', true);
        const lightA = getSphereStamp('#f5b727', '245, 183, 39', false);

        expect(darkA).not.toBeNull();
        expect(darkA).toBe(darkB);
        expect(lightA).not.toBeNull();
        expect(lightA).not.toBe(darkA);
        expect(darkA.width).toBe(SPHERE_STAMP_SIZE);
        expect(darkA.height).toBe(SPHERE_STAMP_SIZE);
    });

    it('blits cached stamp with drawImage when canvas supports it', () => {
        const offscreenCtx = makeOffscreenCtx();
        document.createElement = vi.fn((tag) => {
            const el = origCreateElement(tag);
            if (tag === 'canvas') el.getContext = vi.fn(() => offscreenCtx);
            return el;
        });

        const drawCtx = {
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            globalAlpha: 1,
        };
        const radius = 5;
        drawSphereSprite(
            drawCtx,
            { color: '#ef4444', rgb: '239, 68, 68' },
            120,
            80,
            radius,
            0.85,
            true
        );

        const expectedSpan = radius * 2 * SPHERE_DRAW_SCALE;
        expect(drawCtx.drawImage).toHaveBeenCalledTimes(1);
        expect(drawCtx.drawImage).toHaveBeenCalledWith(
            expect.any(Object),
            120 - expectedSpan / 2,
            80 - expectedSpan / 2,
            expectedSpan,
            expectedSpan
        );
        expect(drawCtx.globalAlpha).toBe(0.85);
    });

    it('falls back cleanly to arc+fill sphere body and specular pinpoint without drawImage', () => {
        const mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            globalAlpha: 1,
            fillStyle: '',
        };

        drawSphereSprite(mockCtx, { color: '#3b82f6' }, 40, 60, 6, 1, false);
        expect(mockCtx.translate).toHaveBeenCalledWith(40, 60);
        expect(mockCtx.arc).toHaveBeenCalledTimes(2);
        expect(mockCtx.fill).toHaveBeenCalledTimes(2);
    });
});
