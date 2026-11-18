import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PHYSICS_STEP_MS,
    TAP_SLOP_PX,
    WelcomeAnimation,
    hueForX,
} from '../src/ui/WelcomeAnimation.js';

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
            translate: vi.fn(),
            rotate: vi.fn(),
            rect: vi.fn(),
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

    it('reflects strictly collected sprites on both home and side screens without 120 default', () => {
        // Defaults to 1 for new players
        expect(anim.floatingParticles.length).toBe(1);

        // Side screen active maintains the collected count (still 1)
        anim.setSideScreenActive(true);
        expect(anim.floatingParticles.length).toBe(1);

        anim.setSideScreenActive(false);
        expect(anim.floatingParticles.length).toBe(1);

        // Seed higher collected count in localStorage
        window.localStorage.setItem(
            'shapekeeper_levels_progress.v1',
            JSON.stringify({ levelsTriggered: true, spritesObtained: 7 })
        );
        anim.syncWithLevelsProgress();
        expect(anim.floatingParticles.length).toBe(7);

        // Retains 7 on side screen
        anim.setSideScreenActive(true);
        expect(anim.floatingParticles.length).toBe(7);

        // Seed 1000 collected sprites -> caps at 300
        window.localStorage.setItem(
            'shapekeeper_levels_progress.v1',
            JSON.stringify({ levelsTriggered: true, spritesObtained: 1000 })
        );
        anim.syncWithLevelsProgress();
        expect(anim.floatingParticles.length).toBe(300);
    });
    it('does not ripple (or chime) when a quick press travels as a page swipe', () => {
        const events = [];
        anim.onInteraction((e) => events.push(e));
        for (const p of anim.floatingParticles) {
            p.x = 600;
            p.y = 500;
        }
        canvas.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 50, clientY: 50, pointerId: 3 })
        );
        window.dispatchEvent(
            new PointerEvent('pointermove', {
                clientX: 50 + TAP_SLOP_PX + 40,
                clientY: 52,
                pointerId: 3,
            })
        );
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 120, clientY: 52, pointerId: 3 })
        );
        expect(anim.ripples.length).toBe(0);
        expect(events.some((e) => e.type === 'ripple')).toBe(false);
    });

    it('does not ripple when the pointer is cancelled', () => {
        for (const p of anim.floatingParticles) {
            p.x = 600;
            p.y = 500;
        }
        canvas.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 50, clientY: 50, pointerId: 4 })
        );
        window.dispatchEvent(
            new PointerEvent('pointercancel', { clientX: 50, clientY: 50, pointerId: 4 })
        );
        expect(anim.ripples.length).toBe(0);
    });

    it('ripples expand with ease-out, fade and expire; taps emit sparks', () => {
        for (const p of anim.floatingParticles) {
            p.x = 600;
            p.y = 500;
        }
        canvas.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 400, clientY: 50, pointerId: 5 })
        );
        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 400, clientY: 50, pointerId: 5 })
        );
        const ripple = anim.ripples[0];
        expect(ripple.hue).toBe(hueForX(400, 800));
        expect(anim.sparks.length).toBeGreaterThan(0);

        anim.updateParticlePositions();
        const firstGrowth = ripple.radius - 2;
        anim.updateParticlePositions();
        const secondGrowth = ripple.radius - 2 - firstGrowth;
        expect(firstGrowth).toBeGreaterThan(secondGrowth); // decelerating
        expect(ripple.alpha).toBeLessThan(0.85);

        for (let i = 0; i < 60; i++) anim.updateParticlePositions();
        expect(anim.ripples.length).toBe(0);
        expect(anim.sparks.length).toBe(0);
    });

    it('swells a grabbed sprite and pops newly spawned sprites in from zero', () => {
        const p = anim.floatingParticles[0];
        p.isGrabbed = true;
        for (let i = 0; i < 40; i++) anim.advancePop(p);
        expect(p.pop).toBeGreaterThan(1.4);

        p.isGrabbed = false;
        for (let i = 0; i < 80; i++) anim.advancePop(p);
        expect(p.pop).toBeCloseTo(1, 1);

        const spawned = anim.createSingleParticle({ spawn: true });
        expect(spawned.pop).toBe(0);
        for (let i = 0; i < 80; i++) anim.advancePop(spawned);
        expect(spawned.pop).toBeCloseTo(1, 1);
    });

    it('runs physics on a fixed 60 Hz clock regardless of display refresh rate', () => {
        const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
        const update = vi.spyOn(anim, 'updateParticlePositions');
        const now = vi.spyOn(performance, 'now');
        anim.stop();
        anim.stepAccumulator = 0;

        // One simulated second at 120 Hz -> ~60 physics steps, not 120.
        let t = 5000;
        anim.lastFrameTime = t;
        for (let i = 0; i < 120; i++) {
            t += 1000 / 120;
            now.mockReturnValue(t);
            anim.startAnimationLoop();
            anim.stop();
        }
        expect(update.mock.calls.length).toBeGreaterThanOrEqual(58);
        expect(update.mock.calls.length).toBeLessThanOrEqual(61);
        expect(PHYSICS_STEP_MS).toBeCloseTo(16.667, 2);
        rafSpy.mockRestore();
    }, 10000);

    it('activates gravitational singularity on touch-and-hold and releases supernova bloom', () => {
        const events = [];
        anim.onInteraction((e) => events.push(e));

        for (const pt of anim.floatingParticles) {
            pt.x = 9000;
            pt.y = 9000;
        }

        const p = anim.floatingParticles[0];
        p.x = 200;
        p.y = 200;

        canvas.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 300, clientY: 300, pointerId: 10 })
        );

        const ptr = anim.activePointers.get(10);
        ptr.startTime -= 300;

        anim.updateParticlePositions();
        expect(ptr.isSingularity).toBe(true);
        expect(events).toContainEqual(
            expect.objectContaining({ type: 'singularity_start', x: 300, y: 300 })
        );

        window.dispatchEvent(
            new PointerEvent('pointerup', { clientX: 300, clientY: 300, pointerId: 10 })
        );

        expect(events).toContainEqual(
            expect.objectContaining({ type: 'supernova', x: 300, y: 300, speed: 5 })
        );
        expect(anim.sparks.length).toBeGreaterThanOrEqual(20);
    });

    it('emits stardust wake on pointermove across empty space', () => {
        for (const pt of anim.floatingParticles) {
            pt.x = 9000;
            pt.y = 9000;
        }

        canvas.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 11 })
        );
        anim.sparks.clear();

        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 140, clientY: 140, pointerId: 11 })
        );

        expect(anim.sparks.length).toBeGreaterThan(0);
    });

    it('drawParticleShape applies squash & stretch and draws celestial core', () => {
        const p = anim.floatingParticles[0];
        p.vx = 5;
        p.vy = 0;
        const mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            scale: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
        };
        anim.drawParticleShape(mockCtx, p, 100, 100, 10, 1);
        expect(mockCtx.translate).toHaveBeenCalledWith(100, 100);
        expect(mockCtx.scale).toHaveBeenCalled();
        expect(mockCtx.fill).toHaveBeenCalledTimes(2);
    });
});
