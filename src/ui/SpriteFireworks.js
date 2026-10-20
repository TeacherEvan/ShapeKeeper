/**
 * SpriteFireworks - Fireworks and sparkle easter egg for Level 100
 *
 * Sprites explode individually, produce fireworks that transition
 * into twinkling sparkles lasting > 3 seconds, stay hidden for 2 seconds,
 * respawn, and repeat.
 *
 * @module ui/SpriteFireworks
 */

export const FIREWORKS_CONSTANTS = {
    BURST_DURATION_MS: 1000,
    SPARKLE_DURATION_MS: 2500, // 1000 + 2500 = 3500ms (> 3 seconds)
    HIDDEN_DURATION_MS: 2000, // 2 seconds
    RESPAWN_DURATION_MS: 400,
    MAX_FIREWORK_PARTICLES: 1500,
    PARTICLES_PER_BURST: 28,
};

export function advanceSpriteLifecycle(sprite, dtMs, rng = Math.random, bounds = null) {
    if (!sprite.fireworksState) {
        sprite.fireworksState = {
            phase: 'alive',
            timer: 2000 + Math.floor(rng() * 6000), // Staggered initial burst
            alpha: 1,
            scale: 1,
        };
    }

    const state = sprite.fireworksState;
    state.timer -= dtMs;

    let triggerBurst = false;

    if (state.timer <= 0) {
        switch (state.phase) {
            case 'alive':
                state.phase = 'burst';
                state.timer = FIREWORKS_CONSTANTS.BURST_DURATION_MS;
                state.alpha = 0;
                triggerBurst = true;
                break;
            case 'burst':
                state.phase = 'sparkle';
                state.timer = FIREWORKS_CONSTANTS.SPARKLE_DURATION_MS;
                state.alpha = 0;
                break;
            case 'sparkle':
                state.phase = 'hidden';
                state.timer = FIREWORKS_CONSTANTS.HIDDEN_DURATION_MS;
                state.alpha = 0;
                break;
            case 'hidden':
                state.phase = 'respawning';
                state.timer = FIREWORKS_CONSTANTS.RESPAWN_DURATION_MS;
                state.alpha = 0;
                state.scale = 0.1;
                if (bounds && bounds.width && bounds.height) {
                    sprite.x = 20 + rng() * (bounds.width - 40);
                    sprite.y = 20 + rng() * (bounds.height - 40);
                }
                break;
            case 'respawning':
                state.phase = 'alive';
                state.timer = 4000 + Math.floor(rng() * 5000);
                state.alpha = 1;
                state.scale = 1;
                break;
        }
    }

    if (state.phase === 'respawning') {
        const progress = 1 - Math.max(0, state.timer / FIREWORKS_CONSTANTS.RESPAWN_DURATION_MS);
        state.alpha = progress;
        state.scale = 0.1 + 0.9 * progress;
    } else if (state.phase === 'alive') {
        state.alpha = 1;
        state.scale = 1;
    } else {
        state.alpha = 0;
        state.scale = 0;
    }

    return {
        phase: state.phase,
        triggerBurst,
        alpha: state.alpha,
        scale: state.scale,
    };
}

export class SpriteFireworksManager {
    constructor() {
        this.particles = [];
    }

    spawnBurst(x, y, color, rng = Math.random) {
        if (this.particles.length >= FIREWORKS_CONSTANTS.MAX_FIREWORK_PARTICLES) return;

        const count = FIREWORKS_CONSTANTS.PARTICLES_PER_BURST;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.4;
            const speed = 1.5 + rng() * 3.5;
            const isSparkle = rng() > 0.4;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: isSparkle ? '#ffd700' : color,
                secondaryColor: '#ffffff',
                size: 2 + rng() * 2.5,
                alpha: 1,
                life: 0,
                maxLife:
                    FIREWORKS_CONSTANTS.BURST_DURATION_MS + FIREWORKS_CONSTANTS.SPARKLE_DURATION_MS,
                twinklePhase: rng() * Math.PI * 2,
                twinkleSpeed: 0.15 + rng() * 0.2,
                drag: 0.965,
                gravity: 0.035,
            });
        }
    }

    update(dtMs) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dtMs;

            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }

            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;

            p.twinklePhase += p.twinkleSpeed;

            const remainingLife = 1 - p.life / p.maxLife;
            // Sparkle twinkle modulation
            const twinkle = 0.5 + 0.5 * Math.sin(p.twinklePhase);
            p.alpha = remainingLife * twinkle;
        }
    }

    render(ctx) {
        if (this.particles.length === 0) return;

        ctx.save();
        for (const p of this.particles) {
            if (p.alpha <= 0.02) continue;

            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            // Star glint center
            if (p.alpha > 0.4) {
                ctx.fillStyle = p.secondaryColor;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    reset() {
        this.particles.length = 0;
    }
}
