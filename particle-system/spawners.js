import { GAME_CONSTANTS } from '../constants.js';

export function spawnParticles(system, x, y, color, count = GAME_CONSTANTS.PARTICLE_COUNT_SQUARE) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 1 + Math.random() * 2;

        system.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color,
            size: 1.5 + Math.random() * 2,
            life: 1.0,
            decay: 0.015 + Math.random() * 0.01,
        });
    }
}

export function spawnSparkleEmojis(system, x, y, count = 3, cellSize = 20) {
    for (let i = 0; i < count; i++) {
        const offsetRange = cellSize * 1.5;
        const randomX = x + (Math.random() - 0.5) * offsetRange;
        const randomY = y + (Math.random() - 0.5) * offsetRange;
        const emojiIndex = Math.floor(Math.random() * GAME_CONSTANTS.SPARKLE_EMOJIS.length);
        const emoji = GAME_CONSTANTS.SPARKLE_EMOJIS[emojiIndex];

        system.sparkleEmojis.push({
            x: randomX,
            y: randomY,
            emoji,
            startTime: Date.now() + Math.random() * 150,
            duration: GAME_CONSTANTS.ANIMATION_KISS_DURATION + Math.random() * 300,
            scale: 0.4 + Math.random() * 0.4,
        });
    }
}

export function createMultiplierParticles(system, x, y) {
    const sparkCount = GAME_CONSTANTS.PARTICLE_COUNT_MULTIPLIER_SPARKS;
    for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount;
        const speed = 2 + Math.random() * 3;

        system.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            color: '#FFD700',
            size: 2 + Math.random() * 3,
            life: 1.0,
            decay: 0.01 + Math.random() * 0.01,
            spark: true,
        });
    }

    const smokeCount = GAME_CONSTANTS.PARTICLE_COUNT_MULTIPLIER_SMOKE;
    for (let i = 0; i < smokeCount; i++) {
        system.particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -1 - Math.random() * 1.5,
            color: '#888888',
            size: 5 + Math.random() * 5,
            life: 1.0,
            decay: 0.008,
            smoke: true,
        });
    }
}
