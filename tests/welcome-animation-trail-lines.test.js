import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeAnimation } from '../src/ui/WelcomeAnimation.js';

/**
 * Regression contract: the background sprites must never paint a straight
 * full-span streak across the canvas.
 *
 * Root cause under test: the flock wraps a sprite by teleporting it from one
 * edge to the opposite one (WelcomeAnimation.updateParticlePositions). The
 * sprite's motion trail kept the pre-teleport point, so drawTrails() stroked a
 * line the full width (or height) of the canvas in the sprite's colour. At 120
 * sprites the board reads as a grid of horizontal/vertical colour lines.
 *
 * Live pre-fix evidence (1440x900, 9 s on the menu): 28 trail segments longer
 * than 300 px, 14 horizontal spans > 500 px, 14 vertical spans > 400 px,
 * longest = 1439.7 px.
 */

const CANVAS_SPAN = 800; // stubbed viewport width
const MAX_ALLOWED_SEGMENT = 200; // far above a real 1.8 px/frame drift, far below a teleport

function createRecordingContext() {
    const segments = [];
    const ctx = {
        segments,
        currentStrokeStyle: '#000000',
        currentAlpha: 1,
        strokeStyle: '#000000',
        fillStyle: '#000000',
        globalAlpha: 1,
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        scale: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        _cursor: null,
        moveTo(x, y) {
            this._cursor = { x, y };
        },
        lineTo(x, y) {
            if (this._cursor) {
                segments.push({
                    x0: this._cursor.x,
                    y0: this._cursor.y,
                    x1: x,
                    y1: y,
                    style: this.strokeStyle,
                });
            }
            this._cursor = { x, y };
        },
        stroke: vi.fn(),
    };
    return ctx;
}

describe('WelcomeAnimation — sprite trails never span the canvas', () => {
    let anim;
    let ctx;

    beforeEach(() => {
        document.body.innerHTML = '<canvas id="welcomeCanvas"></canvas>';
        const canvas = document.getElementById('welcomeCanvas');
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: CANVAS_SPAN,
            height: 600,
            right: CANVAS_SPAN,
            bottom: 600,
        });

        ctx = createRecordingContext();
        canvas.getContext = () => ctx;

        window.innerWidth = CANVAS_SPAN;
        window.innerHeight = 600;

        anim = new WelcomeAnimation();
        // Drive the loop by hand so the assertion is deterministic.
        anim.stop();
    });

    afterEach(() => {
        anim?.stop();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('draws no segment longer than MAX_ALLOWED_SEGMENT while sprites wrap edges', () => {
        // One fast sprite marching right, guaranteed to wrap many times.
        const sprite = anim.floatingParticles[0];
        anim.floatingParticles.length = 0;
        anim.floatingParticles.push(sprite);

        sprite.x = 10;
        sprite.y = 300;
        sprite.vx = 90;
        sprite.vy = 0;
        sprite.maxSpeed = 500; // defeat the flock clamp so the sprite really wraps

        ctx.segments.length = 0;
        for (let frame = 0; frame < 40; frame++) {
            anim.updateParticlePositions();
            anim.drawTrails(0.85);
        }

        const longest = ctx.segments.reduce(
            (max, s) => Math.max(max, Math.hypot(s.x1 - s.x0, s.y1 - s.y0)),
            0
        );

        expect(ctx.segments.length).toBeGreaterThan(0);
        expect(longest).toBeLessThanOrEqual(MAX_ALLOWED_SEGMENT);
    });

    it('draws no full-height streak while a sprite wraps vertically', () => {
        const sprite = anim.floatingParticles[0];
        anim.floatingParticles.length = 0;
        anim.floatingParticles.push(sprite);

        sprite.x = 400;
        sprite.y = 10;
        sprite.vx = 0;
        sprite.vy = 120;
        sprite.maxSpeed = 500; // defeat the flock clamp so the sprite really wraps

        ctx.segments.length = 0;
        for (let frame = 0; frame < 40; frame++) {
            anim.updateParticlePositions();
            anim.drawTrails(0.85);
        }

        const tallest = ctx.segments.reduce((max, s) => Math.max(max, Math.abs(s.y1 - s.y0)), 0);

        expect(ctx.segments.length).toBeGreaterThan(0);
        expect(tallest).toBeLessThanOrEqual(MAX_ALLOWED_SEGMENT);
    });

    it('does not smear a trail across the canvas when a sprite is dragged and released', () => {
        const sprite = anim.floatingParticles[0];
        anim.floatingParticles.length = 0;
        anim.floatingParticles.push(sprite);
        sprite.x = 100;
        sprite.y = 100;
        sprite.vx = 0;
        sprite.vy = 0;

        for (let frame = 0; frame < 5; frame++) {
            anim.updateParticlePositions();
        }

        // Grab, teleport the pointer to the far corner, release.
        anim.grabbedSprites.set(7, {
            particle: sprite,
            lastX: 100,
            lastY: 100,
            vx: 0,
            vy: 0,
            lastTime: 0,
        });
        sprite.isGrabbed = true;
        window.innerWidth = CANVAS_SPAN;
        sprite.x = 750;
        sprite.y = 550;
        anim.handlePointerUp({ pointerId: 7, clientX: 750, clientY: 550 });

        ctx.segments.length = 0;
        anim.updateParticlePositions();
        anim.drawTrails(0.85);

        const longest = ctx.segments.reduce(
            (max, s) => Math.max(max, Math.hypot(s.x1 - s.x0, s.y1 - s.y0)),
            0
        );
        expect(longest).toBeLessThanOrEqual(MAX_ALLOWED_SEGMENT);
    });
});
