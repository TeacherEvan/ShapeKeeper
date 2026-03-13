function getCellCenter(squareKey, parseSquareKey) {
    const { row, col } = parseSquareKey(squareKey);
    return {
        centerX: 20 + (col + 0.5) * 20,
        centerY: 20 + (row + 0.5) * 20,
    };
}

export function createEffectParticles(system, squareKey, effectData, parseSquareKey) {
    const { centerX, centerY } = getCellCenter(squareKey, parseSquareKey);
    const color = effectData.effect.color;

    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 2 + Math.random() * 2;

        system.particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color,
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.02,
            trail: [],
            spark: effectData.type === 'powerup',
        });
    }
}

export function createLandmineParticles(system, squareKey, parseSquareKey) {
    const { centerX, centerY } = getCellCenter(squareKey, parseSquareKey);

    for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;

        system.particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: ['#FF4444', '#FF8800', '#FFDD00'][Math.floor(Math.random() * 3)],
            size: 4 + Math.random() * 6,
            life: 1.0,
            decay: 0.02,
            trail: [],
        });
    }

    for (let i = 0; i < 20; i++) {
        system.particles.push({
            x: centerX + (Math.random() - 0.5) * 20,
            y: centerY + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 2,
            vy: -2 - Math.random() * 2,
            color: '#333333',
            size: 8 + Math.random() * 8,
            life: 1.0,
            decay: 0.01,
            smoke: true,
        });
    }
}

export function createFreezeParticles(system) {
    for (let i = 0; i < 30; i++) {
        system.particles.push({
            x: Math.random() * 800,
            y: -20,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 2,
            color: '#03A9F4',
            size: 3 + Math.random() * 4,
            life: 1.0,
            decay: 0.01,
            spark: true,
        });
    }
}

export function createSwapParticles(system) {
    for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const radius = 50 + Math.random() * 50;

        system.particles.push({
            x: 400 + Math.cos(angle) * radius,
            y: 300 + Math.sin(angle) * radius,
            vx: Math.cos(angle + Math.PI / 2) * 3,
            vy: Math.sin(angle + Math.PI / 2) * 3,
            color: '#673AB7',
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.015,
            trail: [],
        });
    }
}

export function createReverseParticles(system) {
    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;

        system.particles.push({
            x: 400,
            y: 300,
            vx: Math.cos(angle) * 4,
            vy: Math.sin(angle) * 4,
            color: '#E91E63',
            size: 4,
            life: 1.0,
            decay: 0.02,
            trail: [],
        });
    }
}

export function createChaosParticles(system) {
    for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60;
        const radius = 30 + i * 2;

        system.particles.push({
            x: 400 + Math.cos(angle) * radius,
            y: 300 + Math.sin(angle) * radius,
            vx: Math.cos(angle + Math.PI / 2) * 5,
            vy: Math.sin(angle + Math.PI / 2) * 5 - 1,
            color: '#FF5722',
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.015,
            trail: [],
        });
    }
}

export function createPowerupParticles(system, squareKey, color, parseSquareKey) {
    const { centerX, centerY } = getCellCenter(squareKey, parseSquareKey);

    for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;

        system.particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            color,
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.015,
            spark: true,
            trail: [],
        });
    }
}

export function createShieldParticles(system) {
    for (let i = 0; i < 30; i++) {
        system.particles.push({
            x: 400,
            y: 300,
            vx: Math.cos(Math.random() * Math.PI * 2) * 2,
            vy: Math.sin(Math.random() * Math.PI * 2) * 2,
            color: '#3F51B5',
            size: 4,
            life: 1.0,
            decay: 0.02,
            spark: true,
        });
    }
}

export function createLightningParticles(system) {
    for (let i = 0; i < 40; i++) {
        system.particles.push({
            x: Math.random() * 800,
            y: 0,
            vx: (Math.random() - 0.5) * 4,
            vy: 5 + Math.random() * 5,
            color: '#FFEB3B',
            size: 2 + Math.random() * 3,
            life: 1.0,
            decay: 0.03,
            spark: true,
            trail: [],
        });
    }
}

export function createGiftParticles(system) {
    for (let i = 0; i < 15; i++) {
        system.particles.push({
            x: 400 + (Math.random() - 0.5) * 100,
            y: 300,
            vx: (Math.random() - 0.5) * 2,
            vy: -2 - Math.random() * 2,
            color: '#E91E63',
            size: 4,
            life: 1.0,
            decay: 0.015,
            spark: true,
        });
    }
}

export function createStealParticles(system, squareKey, parseSquareKey) {
    const { centerX, centerY } = getCellCenter(squareKey, parseSquareKey);

    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;

        system.particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: '#2196F3',
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.02,
            trail: [],
        });
    }
}

export function createWildcardParticles(system, squareKey, parseSquareKey) {
    const { centerX, centerY } = getCellCenter(squareKey, parseSquareKey);
    const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'];

    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;

        system.particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 3 + Math.random() * 4,
            life: 1.0,
            decay: 0.015,
            spark: true,
            trail: [],
        });
    }
}

export function createBonusTurnParticles(system) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;

        system.particles.push({
            x: 400,
            y: 300,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: '#FFD700',
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.02,
            spark: true,
        });
    }
}

export function createSkipTurnParticles(system) {
    for (let i = 0; i < 25; i++) {
        system.particles.push({
            x: Math.random() * 800,
            y: -10,
            vx: (Math.random() - 0.5) * 2,
            vy: 3 + Math.random() * 2,
            color: '#03A9F4',
            size: 3 + Math.random() * 3,
            life: 1.0,
            decay: 0.015,
            spark: true,
        });
    }
}

export function createDoublePointsParticles(system) {
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;

        system.particles.push({
            x: 400,
            y: 300,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            color: '#FFD700',
            size: 3 + Math.random() * 4,
            life: 1.0,
            decay: 0.015,
            spark: true,
            trail: [],
        });
    }
}

export function createDoubleLineParticles(system) {
    for (let i = 0; i < 25; i++) {
        system.particles.push({
            x: Math.random() * 800,
            y: -10,
            vx: (Math.random() - 0.5) * 3,
            vy: 4 + Math.random() * 3,
            color: '#FFEB3B',
            size: 2 + Math.random() * 3,
            life: 1.0,
            decay: 0.02,
            spark: true,
            trail: [],
        });
    }
}

export function createEpicParticles(system) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#FFD93D', '#6BCB77'];

    for (let i = 0; i < 50; i++) {
        const angle = (Math.PI * 2 * i) / 50;
        const speed = 3 + Math.random() * 4;
        const color = colors[Math.floor(Math.random() * colors.length)];

        system.particles.push({
            x: 400,
            y: 300,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            color,
            size: 2 + Math.random() * 3,
            life: 1.0,
            decay: 0.01 + Math.random() * 0.01,
            trail: [],
        });
    }
}
