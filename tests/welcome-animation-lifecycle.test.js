// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeAnimation } from '../src/ui/WelcomeAnimation.js';
import { SPRITE_PALETTES } from '../src/ui/sprite-palette.js';

function makeMockCtx() {
    return {
        scale: vi.fn(),
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        rect: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
    };
}

describe('WelcomeAnimation lifecycle, reduced-motion, theme re-tint, and deduplication (P1-5)', () => {
    let origGetContext;
    let origRAF;
    let origCAF;
    let origMatchMedia;
    let mockCtx;

    beforeEach(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.innerHTML =
            '<canvas id="welcomeCanvas"></canvas><canvas id="gameBackgroundCanvas"></canvas>';
        mockCtx = makeMockCtx();
        origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx);
        origRAF = window.requestAnimationFrame;
        origCAF = window.cancelAnimationFrame;
        origMatchMedia = window.matchMedia;
        let nextId = 1;
        window.requestAnimationFrame = vi.fn(() => nextId++);
        window.cancelAnimationFrame = vi.fn();
    });

    afterEach(() => {
        HTMLCanvasElement.prototype.getContext = origGetContext;
        window.requestAnimationFrame = origRAF;
        window.cancelAnimationFrame = origCAF;
        window.matchMedia = origMatchMedia;
        vi.restoreAllMocks();
    });

    it('renders 1 static frame and schedules 0 RAF loops under prefers-reduced-motion: reduce', () => {
        window.matchMedia = vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const anim = new WelcomeAnimation();
        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
        expect(mockCtx.clearRect).toHaveBeenCalledTimes(1);
        anim.destroy();
    });

    it('pauses on side screens, restores welcomeCanvas on mainMenuScreen, and removes all listeners on destroy', () => {
        window.matchMedia = vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const anim = new WelcomeAnimation();
        expect(anim._boundListeners.length).toBeGreaterThanOrEqual(11);

        // Move to gameScreen then to levelsScreen -> pauses, then back to mainMenuScreen -> restores welcomeCanvas
        anim.moveToGameScreen();
        expect(anim.canvas.id).toBe('gameBackgroundCanvas');

        window.dispatchEvent(
            new CustomEvent('shapekeeper:screenChanged', { detail: { screenId: 'levelsScreen' } })
        );
        expect(anim.isPaused).toBe(true);

        window.dispatchEvent(
            new CustomEvent('shapekeeper:screenChanged', { detail: { screenId: 'mainMenuScreen' } })
        );
        expect(anim.canvas.id).toBe('welcomeCanvas');
        expect(anim.isPaused).toBe(false);

        anim.destroy();
        expect(anim._boundListeners).toHaveLength(0);
        expect(anim.isDestroyed).toBe(true);
    });

    it('re-tints existing particles immediately on shapekeeper:themeChanged', () => {
        window.matchMedia = vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const anim = new WelcomeAnimation();
        const lightHexes = new Set(
            SPRITE_PALETTES.light.flatMap((c) => [c.primary, c.secondary, c.accent])
        );

        document.documentElement.setAttribute('data-theme', 'light');
        window.dispatchEvent(
            new CustomEvent('shapekeeper:themeChanged', { detail: { theme: 'light' } })
        );

        for (const p of anim.floatingParticles) {
            expect(lightHexes.has(p.color)).toBe(true);
        }
        anim.destroy();
    });

    it('draws each constellation edge once (p1.id < p2.id)', () => {
        window.matchMedia = vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        const anim = new WelcomeAnimation();
        // Place 3 particles close together so all 3 pairs are within connectionDistance
        anim.floatingParticles = [
            anim.createSingleParticle(),
            anim.createSingleParticle(),
            anim.createSingleParticle(),
        ];
        anim.floatingParticles[0].x = 50;
        anim.floatingParticles[0].y = 50;
        anim.floatingParticles[1].x = 60;
        anim.floatingParticles[1].y = 50;
        anim.floatingParticles[2].x = 55;
        anim.floatingParticles[2].y = 60;
        anim.updateSpatialPartitionGrid();

        mockCtx.stroke.mockClear();
        anim.drawConnections(1);
        // 3 particles -> 3 unique undirected pairs (not 6)
        expect(mockCtx.stroke).toHaveBeenCalledTimes(3);
        anim.destroy();
    });
});
