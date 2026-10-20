import { describe, expect, it, vi } from 'vitest';
import {
    FIREWORKS_CONSTANTS,
    SpriteFireworksManager,
    advanceSpriteLifecycle,
} from './SpriteFireworks.js';

describe('SpriteFireworks Easter Egg State Machine', () => {
    it('progresses through alive -> burst -> sparkle -> hidden -> respawning -> alive', () => {
        const sprite = { x: 50, y: 50, color: '#00f0ff' };
        const bounds = { width: 800, height: 600 };
        const fixedRng = vi.fn().mockReturnValue(0.5);

        // Step 1: Initial state initialization
        let res = advanceSpriteLifecycle(sprite, 0, fixedRng, bounds);
        expect(res.phase).toBe('alive');
        expect(res.alpha).toBe(1);
        expect(res.scale).toBe(1);
        expect(sprite.fireworksState.timer).toBe(5000); // 2000 + 0.5 * 6000

        // Step 2: Time runs down on alive -> triggers burst
        res = advanceSpriteLifecycle(sprite, 5000, fixedRng, bounds);
        expect(res.phase).toBe('burst');
        expect(res.triggerBurst).toBe(true);
        expect(res.alpha).toBe(0);
        expect(sprite.fireworksState.timer).toBe(FIREWORKS_CONSTANTS.BURST_DURATION_MS); // 1000ms

        // Step 3: Burst finishes -> transitions to sparkle
        res = advanceSpriteLifecycle(sprite, 1000, fixedRng, bounds);
        expect(res.phase).toBe('sparkle');
        expect(res.triggerBurst).toBe(false);
        expect(res.alpha).toBe(0);
        expect(sprite.fireworksState.timer).toBe(FIREWORKS_CONSTANTS.SPARKLE_DURATION_MS); // 2500ms
        // Total explosion time = 1000 + 2500 = 3500ms > 3 seconds
        expect(
            FIREWORKS_CONSTANTS.BURST_DURATION_MS + FIREWORKS_CONSTANTS.SPARKLE_DURATION_MS
        ).toBeGreaterThan(3000);

        // Step 4: Sparkle finishes -> transitions to hidden for 2000ms
        res = advanceSpriteLifecycle(sprite, 2500, fixedRng, bounds);
        expect(res.phase).toBe('hidden');
        expect(res.alpha).toBe(0);
        expect(sprite.fireworksState.timer).toBe(FIREWORKS_CONSTANTS.HIDDEN_DURATION_MS); // 2000ms
        expect(FIREWORKS_CONSTANTS.HIDDEN_DURATION_MS).toBe(2000);

        // Step 5: Hidden finishes -> transitions to respawning and repositions within bounds
        res = advanceSpriteLifecycle(sprite, 2000, fixedRng, bounds);
        expect(res.phase).toBe('respawning');
        expect(sprite.fireworksState.timer).toBe(FIREWORKS_CONSTANTS.RESPAWN_DURATION_MS); // 400ms
        // Repositioned in bounds: 20 + 0.5 * (800 - 40) = 400
        expect(sprite.x).toBe(400);
        expect(sprite.y).toBe(300);

        // Mid-respawn interpolation
        res = advanceSpriteLifecycle(sprite, 200, fixedRng, bounds);
        expect(res.phase).toBe('respawning');
        expect(res.alpha).toBeCloseTo(0.5, 1);

        // Step 6: Respawn finishes -> alive again to repeat!
        res = advanceSpriteLifecycle(sprite, 200, fixedRng, bounds);
        expect(res.phase).toBe('alive');
        expect(res.alpha).toBe(1);
        expect(res.scale).toBe(1);
    });

    it('SpriteFireworksManager spawns, updates and renders burst particles', () => {
        const manager = new SpriteFireworksManager();
        expect(manager.particles.length).toBe(0);

        manager.spawnBurst(100, 150, '#ff00ea');
        expect(manager.particles.length).toBe(FIREWORKS_CONSTANTS.PARTICLES_PER_BURST);

        // Update advances position and age
        const pBefore = { ...manager.particles[0] };
        manager.update(50);
        expect(manager.particles[0].life).toBe(50);
        expect(manager.particles[0].x).not.toBe(pBefore.x);

        // Render to canvas context
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
        };
        manager.render(ctx);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();

        // Particles pruned after total life expires
        manager.update(4000);
        expect(manager.particles.length).toBe(0);
    });
});
