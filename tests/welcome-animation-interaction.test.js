import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeAnimation } from '../src/ui/WelcomeAnimation.js';

describe('WelcomeAnimation sprite interactions and ripples', () => {
    let anim;
    let canvas;

    beforeEach(() => {
        document.body.innerHTML = '<canvas id="welcomeCanvas"></canvas>';
        canvas = document.getElementById('welcomeCanvas');

        // Mock getBoundingClientRect
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            right: 800,
            bottom: 600,
        });

        // Mock 2D context
        canvas.getContext = () => ({
            scale: vi.fn(),
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        });

        window.innerWidth = 800;
        window.innerHeight = 600;

        anim = new WelcomeAnimation();
    });

    afterEach(() => {
        if (anim) {
            anim.stop();
        }
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('hitTestSprite finds a particle near the cursor coordinates', () => {
        expect(anim.floatingParticles.length).toBeGreaterThan(0);
        // Move all particles away
        for (const pt of anim.floatingParticles) {
            pt.x = 9000;
            pt.y = 9000;
        }

        const p = anim.floatingParticles[0];
        p.x = 200;
        p.y = 150;

        const hit = anim.hitTestSprite(205, 152);
        expect(hit).toBe(p);

        const miss = anim.hitTestSprite(500, 500);
        expect(miss).toBeNull();
    });

    it('grabs a sprite on pointerdown and notifies interaction', () => {
        const events = [];
        anim.onInteraction((e) => events.push(e));

        for (const pt of anim.floatingParticles) {
            pt.x = 9000;
            pt.y = 9000;
        }

        const p = anim.floatingParticles[0];
        p.x = 300;
        p.y = 200;

        canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
                clientX: 300,
                clientY: 200,
                pointerId: 1,
            })
        );

        expect(p.isGrabbed).toBe(true);
        expect(anim.grabbedSprites.has(1)).toBe(true);
        expect(events).toContainEqual(
            expect.objectContaining({
                type: 'grab',
                x: 300,
                y: 200,
            })
        );
    });

    it('drags grabbed sprite on pointermove and flings with velocity on pointerup', () => {
        const events = [];
        anim.onInteraction((e) => events.push(e));

        for (const pt of anim.floatingParticles) {
            pt.x = 9000;
            pt.y = 9000;
        }

        const p = anim.floatingParticles[0];
        p.x = 300;
        p.y = 200;

        canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
                clientX: 300,
                clientY: 200,
                pointerId: 1,
            })
        );

        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 350,
                clientY: 220,
                pointerId: 1,
            })
        );

        expect(p.x).toBe(350);
        expect(p.y).toBe(220);

        window.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 360,
                clientY: 225,
                pointerId: 1,
            })
        );

        expect(p.isGrabbed).toBe(false);
        expect(anim.grabbedSprites.has(1)).toBe(false);
        expect(events).toContainEqual(
            expect.objectContaining({
                type: 'fling',
            })
        );
    });

    it('spawns a ripple on quick tap in empty space', () => {
        const events = [];
        anim.onInteraction((e) => events.push(e));

        // Move all particles away from (50, 50)
        for (const p of anim.floatingParticles) {
            p.x = 600;
            p.y = 500;
        }

        canvas.dispatchEvent(
            new PointerEvent('pointerdown', {
                clientX: 50,
                clientY: 50,
                pointerId: 2,
            })
        );

        expect(events).toContainEqual(
            expect.objectContaining({
                type: 'touch',
                x: 50,
                y: 50,
            })
        );

        window.dispatchEvent(
            new PointerEvent('pointerup', {
                clientX: 50,
                clientY: 50,
                pointerId: 2,
            })
        );

        expect(anim.ripples.length).toBe(1);
        expect(anim.ripples[0].x).toBe(50);
        expect(anim.ripples[0].y).toBe(50);
        expect(events).toContainEqual(
            expect.objectContaining({
                type: 'ripple',
                x: 50,
                y: 50,
            })
        );
    });
});
