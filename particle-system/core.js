import { GAME_CONSTANTS } from '../constants.js';

export function initializeAmbientParticles(system) {
    system.ambientParticles = [];
    for (let i = 0; i < GAME_CONSTANTS.AMBIENT_PARTICLE_COUNT; i++) {
        system.ambientParticles.push(createAmbientParticle());
    }
}

export function createAmbientParticle(atEdge = false) {
    const width = 800;
    const height = 600;

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
        }
    }
    system.particles.length = writeIndex;
}
