import { describe, it, expect } from 'vitest';
import {
    computeBoardBounds,
    initializeLavaParticles,
    updateLavaParticles,
    allParticlesInBounds,
} from '../particle-system/lava-particles.js';
import { GAME_CONSTANTS } from '../constants.js';

function makeGame() {
    return {
        offsetX: 20,
        offsetY: 20,
        cellSize: 40,
        gridCols: 10,
        gridRows: 10,
    };
}

describe('computeBoardBounds', () => {
    it('matches the plan board-bbox definition', () => {
        const game = makeGame();
        const b = computeBoardBounds(game);
        expect(b.minX).toBe(20);
        expect(b.minY).toBe(20);
        // maxX = offsetX + (cols-1)*cellSize = 20 + 9*40
        expect(b.maxX).toBe(20 + 9 * 40);
        expect(b.maxY).toBe(20 + 9 * 40);
    });
});

describe('initializeLavaParticles', () => {
    it('spawns the configured count inside the board', () => {
        const game = makeGame();
        const particles = initializeLavaParticles(game);
        expect(particles.length).toBe(GAME_CONSTANTS.LAVA_PARTICLE_COUNT);
        expect(allParticlesInBounds(particles, game)).toBe(true);
    });

    it('respects a custom count', () => {
        const particles = initializeLavaParticles(makeGame(), 5);
        expect(particles.length).toBe(5);
    });
});

describe('updateLavaParticles boundary clamping (NFR-1)', () => {
    it('keeps particles inside the board after many ticks', () => {
        const game = makeGame();
        const particles = initializeLavaParticles(game);
        for (let i = 0; i < 5000; i++) {
            updateLavaParticles(particles, game, 9000);
        }
        expect(allParticlesInBounds(particles, game)).toBe(true);
    });

    it('never leaks even under urgency escalation', () => {
        const game = makeGame();
        const particles = initializeLavaParticles(game);
        for (let i = 0; i < 3000; i++) {
            updateLavaParticles(particles, game, 1000); // <=5s -> urgent
        }
        expect(allParticlesInBounds(particles, game)).toBe(true);
    });

    it('clamps a deliberately out-of-bounds particle back inside', () => {
        const game = makeGame();
        const { minX, minY, maxX, maxY } = computeBoardBounds(game);
        const particles = [
            { x: minX - 50, y: minY - 50, vx: -5, vy: -5, r: 8 },
            { x: maxX + 50, y: maxY + 50, vx: 5, vy: 5, r: 8 },
        ];
        updateLavaParticles(particles, game, 9000);
        expect(allParticlesInBounds(particles, game)).toBe(true);
    });
});

describe('updateLavaParticles urgency escalation', () => {
    it('applies upward buoyancy when remaining <= threshold', () => {
        const game = makeGame();
        const particles = [{ x: 200, y: 200, vx: 0, vy: 0, r: 8 }];
        updateLavaParticles(particles, game, 1000); // urgent
        // buoyancy subtracts from y movement -> particle drifts upward (y decreases)
        expect(particles[0].y).toBeLessThan(200);
    });

    it('does not apply buoyancy when remaining > threshold', () => {
        const game = makeGame();
        const particles = [{ x: 200, y: 200, vx: 0, vy: 0, r: 8 }];
        updateLavaParticles(particles, game, 9000); // not urgent
        expect(particles[0].y).toBeCloseTo(200, 5);
    });
});
