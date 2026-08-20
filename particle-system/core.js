import { GAME_CONSTANTS } from '../constants.js';

export function initializeAmbientParticles(system) {
    system.ambientParticles = [];
    // Spread ambient particles across the real board dimensions so they cover
    // the canvas instead of a hardcoded 800x600 box (AUD-3).
    const width = system.logicalWidth || 800;
    const height = system.logicalHeight || 600;
    for (let i = 0; i < GAME_CONSTANTS.AMBIENT_PARTICLE_COUNT; i++) {
        system.ambientParticles.push(createAmbientParticle(false, width, height));
    }
}

export function createAmbientParticle(atEdge = false, width = 800, height = 600) {
    return {
        x: atEdge ? (Math.random() < 0.5 ? 0 : width) : Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
    };
}

/**
 * Particle object pool (ported from Sqaure's particlePool pattern).
 * Reuses dead particle objects instead of allocating fresh ones each burst,
 * eliminating GC churn on large grids (20x20, 30x30) and combo chains.
 */
export function createParticlePool(maxPoolSize = 200) {
    const free = [];
    const active = new Set();
    return {
        acquire() {
            const p = free.pop() || { x: 0, y: 0, vx: 0, vy: 0, life: 1, decay: 0.02, trail: [] };
            active.add(p);
            return p;
        },
        release(p) {
            active.delete(p);
            if (free.length < maxPoolSize) free.push(p);
        },
        poolSize: () => free.length + active.size,
        activeCount: () => active.size,
        active,
    };
}

export function spawnParticlesFromPool(pool, x, y, color, count) {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 1 + Math.random() * 2;
        const p = pool.acquire();
        if (!p) break;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.color = color;
        p.size = 1.5 + Math.random() * 2;
        p.life = 1.0;
        p.decay = 0.015 + Math.random() * 0.01;
        p.trail = [];
        spawned++;
    }
    return spawned;
}

export function updateParticlesFromPool(pool, logicalWidth, logicalHeight) {
    for (const particle of pool.active) {
        if (!particle.trail) particle.trail = [];
        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > GAME_CONSTANTS.PARTICLE_TRAIL_LENGTH) {
            particle.trail.shift();
        }
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.15;
        if (particle.y > logicalHeight - 10 && !particle.smoke) {
            particle.y = logicalHeight - 10;
            particle.vy *= -0.5;
            particle.vx *= 0.8;
        }
        particle.life -= particle.decay;
        if (particle.life <= 0) {
            pool.release(particle);
        }
    }
}

export function updateParticles(system, logicalWidth, logicalHeight) {
    for (let i = 0; i < system.ambientParticles.length; i++) {
        const particle = system.ambientParticles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -10) particle.x = logicalWidth + 10;
        else if (particle.x > logicalWidth + 10) particle.x = -10;
        if (particle.y < -10) particle.y = logicalHeight + 10;
        else if (particle.y > logicalHeight + 10) particle.y = -10;
    }

    let writeIndex = 0;
    for (let i = 0; i < system.particles.length; i++) {
        const particle = system.particles[i];

        if (!particle.trail) particle.trail = [];
        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > GAME_CONSTANTS.PARTICLE_TRAIL_LENGTH) {
            particle.trail.shift();
        }

        particle.vx *= 0.98;
        particle.vy *= 0.98;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.15;

        if (particle.y > logicalHeight - 10 && !particle.smoke) {
            particle.y = logicalHeight - 10;
            particle.vy *= -0.5;
            particle.vx *= 0.8;
        }

        particle.life -= particle.decay;

        if (particle.life > 0) {
            system.particles[writeIndex++] = particle;
        } else if (system.pool) {
            system.pool.release(particle);
        }
    }
    system.particles.length = writeIndex;
}
