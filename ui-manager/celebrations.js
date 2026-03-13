/**
 * Celebration and temporary turn indicator helpers.
 */

import { announceStatus } from '../src/ui/AccessibilityAnnouncer.js';

function getTurnIndicator() {
    return document.getElementById('turnIndicator');
}

function spawnDirectionalBurst(game, count, createParticle) {
    for (let i = 0; i < count; i += 1) {
        game.particleSystem.particles.push(createParticle(i));
    }
}

export function triggerBonusTurnVisual(game, refreshUI) {
    const turnIndicator = getTurnIndicator();
    if (turnIndicator) {
        turnIndicator.textContent = '🎁 BONUS TURN! 🎁';
        turnIndicator.style.animation = 'pulse 0.5s ease-in-out 3';
        announceStatus('Bonus turn earned.');
        setTimeout(() => {
            turnIndicator.style.animation = '';
            refreshUI();
        }, 1500);
    }

    const playerColor = game.currentPlayer === 1 ? game.player1Color : game.player2Color;
    spawnDirectionalBurst(game, 20, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        return {
            x: game.logicalWidth / 2,
            y: game.logicalHeight / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: playerColor,
            size: 3 + Math.random() * 3,
            life: 1,
            decay: 0.02,
            spark: true,
        };
    });
}

export function triggerSkipTurnVisual(game, skippedPlayer, refreshUI) {
    const turnIndicator = getTurnIndicator();
    if (turnIndicator) {
        turnIndicator.textContent = `❄️ Player ${skippedPlayer} is FROZEN! Turn skipped! ❄️`;
        turnIndicator.style.color = '#03A9F4';
        announceStatus(`Player ${skippedPlayer} is frozen. Turn skipped.`);
        setTimeout(() => {
            refreshUI();
        }, 2000);
    }

    spawnDirectionalBurst(game, 25, () => ({
        x: Math.random() * game.logicalWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 2,
        vy: 3 + Math.random() * 2,
        color: '#03A9F4',
        size: 3 + Math.random() * 3,
        life: 1,
        decay: 0.015,
        spark: true,
    }));
}

export function triggerDoublePointsVisual(game, refreshUI) {
    const turnIndicator = getTurnIndicator();
    if (turnIndicator) {
        turnIndicator.textContent = '✨ DOUBLE POINTS! ✨';
        turnIndicator.style.color = '#FFD700';
        announceStatus('Double points activated.');
        setTimeout(() => {
            refreshUI();
        }, 1500);
    }

    spawnDirectionalBurst(game, 30, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        return {
            x: game.logicalWidth / 2,
            y: game.logicalHeight / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            color: '#FFD700',
            size: 3 + Math.random() * 4,
            life: 1,
            decay: 0.015,
            spark: true,
            trail: [],
        };
    });
}

export function triggerDoubleLineReminder(game, refreshUI) {
    const turnIndicator = getTurnIndicator();
    if (turnIndicator) {
        turnIndicator.textContent = '⚡ LIGHTNING! Draw another line! ⚡';
        turnIndicator.style.color = '#FFEB3B';
        announceStatus('Lightning effect active. Draw another line.');
        setTimeout(() => {
            refreshUI();
        }, 2000);
    }

    spawnDirectionalBurst(game, 25, () => ({
        x: Math.random() * game.logicalWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 3,
        vy: 4 + Math.random() * 3,
        color: '#FFEB3B',
        size: 2 + Math.random() * 3,
        life: 1,
        decay: 0.02,
        spark: true,
        trail: [],
    }));
}

function buildWinnerScoreEntry(player, rankIndex, winner) {
    const entry = document.createElement('div');
    entry.className = `final-score-entry ${player.num === winner ? 'winner' : ''}`.trim();

    const rank = document.createElement('span');
    rank.className = 'final-score-rank';
    rank.textContent = rankIndex === 0 ? '🥇' : '🥈';

    const color = document.createElement('div');
    color.className = 'final-score-color';
    color.style.backgroundColor = player.color;

    const name = document.createElement('span');
    name.className = 'final-score-name';
    name.textContent = `Player ${player.num}`;

    const points = document.createElement('span');
    points.className = 'final-score-points';
    points.style.color = player.color;
    points.textContent = `${player.score}`;

    entry.append(rank, color, name, points);
    return entry;
}

function launchConfetti(accentColor) {
    const canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10001;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confetti = [];
    const colors = [
        accentColor,
        '#FFD700',
        '#FF6B6B',
        '#4ECDC4',
        '#45B7D1',
        '#96E6A1',
        '#DDA0DD',
        '#F7DC6F',
    ];

    for (let i = 0; i < 150; i += 1) {
        const piece = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: Math.random() * 4 - 2,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5,
            oscillationSpeed: Math.random() * 0.05 + 0.02,
            oscillationDistance: Math.random() * 40 + 20,
            startX: 0,
        };
        piece.startX = piece.x;
        confetti.push(piece);
    }

    let frame = 0;
    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let activeCount = 0;
        confetti.forEach((piece) => {
            if (piece.y < canvas.height + 50) {
                activeCount += 1;
                piece.y += piece.vy;
                piece.x =
                    piece.startX +
                    Math.sin(frame * piece.oscillationSpeed) * piece.oscillationDistance;
                piece.rotation += piece.rotationSpeed;

                ctx.save();
                ctx.translate(piece.x + piece.w / 2, piece.y + piece.h / 2);
                ctx.rotate((piece.rotation * Math.PI) / 180);
                ctx.fillStyle = piece.color;
                ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
                ctx.restore();
            }
        });

        frame += 1;
        if (activeCount > 0 && frame < 300) {
            requestAnimationFrame(animate);
            return;
        }

        canvas.remove();
    };

    animate();
}

function launchFireworks(accentColor) {
    const canvas = document.createElement('canvas');
    canvas.id = 'fireworksCanvas';
    canvas.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fireworks = [];
    const particles = [];
    const colors = [accentColor, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'];

    let launchCount = 0;
    const launchInterval = setInterval(() => {
        if (launchCount >= 8) {
            clearInterval(launchInterval);
            return;
        }

        fireworks.push({
            x: canvas.width * (0.2 + Math.random() * 0.6),
            y: canvas.height,
            targetY: canvas.height * (0.2 + Math.random() * 0.3),
            vy: -12 - Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            exploded: false,
        });
        launchCount += 1;
    }, 400);

    const animate = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        fireworks.forEach((firework) => {
            if (!firework.exploded) {
                firework.y += firework.vy;
                firework.vy += 0.2;

                ctx.beginPath();
                ctx.arc(firework.x, firework.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = firework.color;
                ctx.fill();

                if (firework.y <= firework.targetY || firework.vy >= 0) {
                    firework.exploded = true;

                    for (let index = 0; index < 40; index += 1) {
                        const angle = (Math.PI * 2 * index) / 40;
                        const speed = 3 + Math.random() * 4;
                        particles.push({
                            x: firework.x,
                            y: firework.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            color: firework.color,
                            life: 1,
                            decay: 0.015 + Math.random() * 0.01,
                        });
                    }
                }
            }
        });

        for (let index = particles.length - 1; index >= 0; index -= 1) {
            const particle = particles[index];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.08;
            particle.vx *= 0.98;
            particle.life -= particle.decay;

            if (particle.life > 0) {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
                ctx.fillStyle =
                    particle.color +
                    Math.floor(particle.life * 255)
                        .toString(16)
                        .padStart(2, '0');
                ctx.fill();
                continue;
            }

            particles.splice(index, 1);
        }

        if (particles.length > 0 || fireworks.some((firework) => !firework.exploded)) {
            requestAnimationFrame(animate);
            return;
        }

        setTimeout(() => canvas.remove(), 1000);
    };

    animate();
}

export function showWinner(game) {
    const winner = game.scores[1] > game.scores[2] ? 1 : game.scores[2] > game.scores[1] ? 2 : 0;
    const winnerColor =
        winner === 1 ? game.player1Color : winner === 2 ? game.player2Color : '#FFD700';

    game.soundManager.playVictorySound();

    const winnerScreen = document.getElementById('winnerScreen');
    const winnerText = document.getElementById('winnerText');
    const finalScores = document.getElementById('finalScores');

    if (winner === 0) {
        winnerText.textContent = `🤝 It's a Tie! 🤝`;
        winnerText.style.color = '#FFD700';
    } else {
        winnerText.textContent = `🏆 Player ${winner} Wins! 🏆`;
        winnerText.style.color = winnerColor;
    }

    const players = [
        { num: 1, score: game.scores[1], color: game.player1Color },
        { num: 2, score: game.scores[2], color: game.player2Color },
    ].sort((left, right) => right.score - left.score);

    finalScores.replaceChildren(
        ...players.map((player, index) => buildWinnerScoreEntry(player, index, winner))
    );

    document.getElementById('gameScreen').classList.remove('active');
    winnerScreen.classList.add('active');

    launchConfetti(winnerColor);
    launchFireworks(winnerColor);
}
