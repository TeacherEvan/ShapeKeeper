/**
 * Celebration and temporary turn indicator helpers.
 */

import { announceAlert, announceStatus } from '../src/ui/AccessibilityAnnouncer.js';
import { LevelsProgress, MAX_LEVEL, getTurnDurationForLevel } from '../src/ui/LevelsProgress.js';
import { showScreen } from '../src/ui/ScreenTransition.js';
import { formatHexAlpha, getPlayerColor, getPlayerName, prefersReducedMotion } from '../utils.js';

function getTurnIndicator() {
    return document.getElementById('turnIndicator');
}

function spawnDirectionalBurst(game, count, createParticle) {
    for (let i = 0; i < count; i += 1) {
        game.particleSystem.particles.push(createParticle(i));
    }
}

export function triggerBonusTurnVisual(game, refreshUI) {
    if (game?.uiManager) {
        game.uiManager.turnBannerLockUntil = Date.now() + 1500;
    }
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

    const playerColor = getPlayerColor(game, game.currentPlayer);
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
    if (game?.uiManager) {
        game.uiManager.turnBannerLockUntil = Date.now() + 2000;
    }
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
    if (game?.uiManager) {
        game.uiManager.turnBannerLockUntil = Date.now() + 1500;
    }
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
    if (game?.uiManager) {
        game.uiManager.turnBannerLockUntil = Date.now() + 2000;
    }
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

function buildWinnerScoreEntry(player, winner, isTie = false) {
    const entry = document.createElement('div');
    const isWinner = isTie || player.num === winner;
    entry.className = `final-score-entry ${isWinner ? 'winner' : ''}`.trim();

    const rank = document.createElement('span');
    rank.className = 'final-score-rank';
    // A draw gives both players the gold: nobody lost, so nobody is second.
    rank.textContent = isWinner ? '🥇' : '🥈';

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

let activeConfettiAnim = null;
let activeFireworksAnim = null;
let activeFireworksInterval = null;

export function stopCelebrationAnimations() {
    if (activeConfettiAnim) {
        cancelAnimationFrame(activeConfettiAnim);
        activeConfettiAnim = null;
    }
    if (activeFireworksAnim) {
        cancelAnimationFrame(activeFireworksAnim);
        activeFireworksAnim = null;
    }
    if (activeFireworksInterval) {
        clearInterval(activeFireworksInterval);
        activeFireworksInterval = null;
    }
    document.getElementById('confettiCanvas')?.remove();
    document.getElementById('fireworksCanvas')?.remove();
}

export function launchConfetti(accentColor) {
    if (prefersReducedMotion()) return;
    if (activeConfettiAnim) {
        cancelAnimationFrame(activeConfettiAnim);
        activeConfettiAnim = null;
    }
    document.getElementById('confettiCanvas')?.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10001;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
        ctx.scale?.(dpr, dpr);
    }

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
            x: Math.random() * width,
            y: Math.random() * height - height,
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

    let elapsedSec = 0;
    let lastTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const animate = () => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const dtSec = Math.min(Math.max((now - lastTs) / 1000, 0), 0.1);
        lastTs = now;
        const step = dtSec * 60;
        elapsedSec += dtSec;

        ctx.clearRect(0, 0, width, height);

        let activeCount = 0;
        const phaseTick = elapsedSec * 60;
        confetti.forEach((piece) => {
            if (piece.y < height + 50) {
                activeCount += 1;
                piece.y += piece.vy * step;
                piece.x =
                    piece.startX +
                    Math.sin(phaseTick * piece.oscillationSpeed) * piece.oscillationDistance;
                piece.rotation += piece.rotationSpeed * step;

                ctx.save();
                ctx.translate(piece.x + piece.w / 2, piece.y + piece.h / 2);
                ctx.rotate((piece.rotation * Math.PI) / 180);
                ctx.fillStyle = piece.color;
                ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
                ctx.restore();
            }
        });

        if (activeCount > 0 && elapsedSec < 5) {
            activeConfettiAnim = requestAnimationFrame(animate);
            return;
        }

        activeConfettiAnim = null;
        canvas.remove();
    };

    activeConfettiAnim = requestAnimationFrame(animate);
}

export function launchFireworks(accentColor) {
    if (prefersReducedMotion()) return;
    if (activeFireworksAnim) {
        cancelAnimationFrame(activeFireworksAnim);
        activeFireworksAnim = null;
    }
    if (activeFireworksInterval) {
        clearInterval(activeFireworksInterval);
        activeFireworksInterval = null;
    }
    document.getElementById('fireworksCanvas')?.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'fireworksCanvas';
    canvas.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalWidth = window.innerWidth;
    const logicalHeight = window.innerHeight;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const fireworks = [];
    const particles = [];
    const colors = [accentColor, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'];

    const spawnRocket = () => {
        fireworks.push({
            x: logicalWidth * (0.2 + Math.random() * 0.6),
            y: logicalHeight,
            targetY: logicalHeight * (0.2 + Math.random() * 0.3),
            vy: -12 - Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            exploded: false,
        });
    };

    let launchCount = 0;
    let spawnerActive = true;
    spawnRocket();
    launchCount += 1;

    activeFireworksInterval = setInterval(() => {
        if (launchCount >= 8) {
            clearInterval(activeFireworksInterval);
            activeFireworksInterval = null;
            spawnerActive = false;
            return;
        }

        spawnRocket();
        launchCount += 1;
    }, 400);

    let lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const animate = (nowArg) => {
        const now =
            typeof nowArg === 'number'
                ? nowArg
                : typeof performance !== 'undefined'
                  ? performance.now()
                  : Date.now();
        const dtScale = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000)) * 60;
        lastTime = now;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        fireworks.forEach((firework) => {
            if (!firework.exploded) {
                firework.y += firework.vy * dtScale;
                firework.vy += 0.2 * dtScale;

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
            particle.x += particle.vx * dtScale;
            particle.y += particle.vy * dtScale;
            particle.vy += 0.08 * dtScale;
            particle.vx *= Math.pow(0.98, dtScale);
            particle.life -= particle.decay * dtScale;

            if (particle.life > 0) {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = formatHexAlpha(particle.color, particle.life);
                ctx.fill();
                continue;
            }

            particles.splice(index, 1);
        }

        if (
            spawnerActive ||
            particles.length > 0 ||
            fireworks.some((firework) => !firework.exploded)
        ) {
            activeFireworksAnim = requestAnimationFrame(animate);
            return;
        }

        activeFireworksAnim = null;
        setTimeout(() => canvas.remove(), 1000);
    };

    activeFireworksAnim = requestAnimationFrame(animate);
}

export function hideGameOverSplash() {
    stopCelebrationAnimations();
    const overlay = document.getElementById('gameOverSplashOverlay');
    if (overlay) {
        overlay.hidden = true;
    }
}

export function showGameOverSplash(game) {
    const overlay = document.getElementById('gameOverSplashOverlay');
    if (!overlay) return;

    if (game.soundManager?.playGameOverSound) {
        game.soundManager.playGameOverSound();
    } else {
        game.soundManager?.playInvalidSound?.();
    }
    announceAlert(`Time's up! Game Over. Level ${game.currentLevel} failed.`);

    const subtitleEl = document.getElementById('gameOverSplashSubtitle');
    const scoresEl = document.getElementById('gameOverSplashScores');
    const retryBtn = document.getElementById('splashRetryLevelBtn');

    if (subtitleEl) {
        subtitleEl.textContent = `Level ${game.currentLevel} Failed — Your ${game.turnDurationSeconds}s turn timer ran out!`;
    }

    if (scoresEl) {
        scoresEl.replaceChildren();

        const p1Row = document.createElement('div');
        p1Row.className = 'final-score-entry';
        const p1Name = document.createElement('span');
        p1Name.className = 'final-score-name';
        p1Name.textContent = 'Player 1';
        const p1Pts = document.createElement('span');
        p1Pts.className = 'final-score-points';
        p1Pts.style.color = /^#[0-9a-fA-F]{6}$/.test(game.player1Color)
            ? game.player1Color
            : '#2563eb';
        p1Pts.textContent = String(game.scores[1] ?? 0);
        p1Row.append(p1Name, p1Pts);

        const aiRow = document.createElement('div');
        aiRow.className = 'final-score-entry';
        const aiName = document.createElement('span');
        aiName.className = 'final-score-name';
        aiName.textContent = 'AI';
        const aiPts = document.createElement('span');
        aiPts.className = 'final-score-points';
        aiPts.style.color = /^#[0-9a-fA-F]{6}$/.test(game.player2Color)
            ? game.player2Color
            : '#dc2626';
        aiPts.textContent = String(game.scores[2] ?? 0);
        aiRow.append(aiName, aiPts);

        scoresEl.append(p1Row, aiRow);
    }

    if (retryBtn) {
        retryBtn.textContent = `Retry Level ${game.currentLevel} ↺`;
        game._nextLevelToPlay = game.currentLevel;
        retryBtn.focus?.({ preventScroll: true });
    }

    overlay.hidden = false;
}

export function showWinner(game) {
    if (typeof document === 'undefined') return;
    if (game.isLevelsMode && game.timedOut) {
        showGameOverSplash(game);
        return;
    }

    const playerCount = Math.max(2, game.playerCount || 2);
    const players = [];
    for (let num = 1; num <= playerCount; num += 1) {
        players.push({
            num,
            name: getPlayerName(game, num),
            score: game.scores[num] ?? 0,
            color: getPlayerColor(game, num),
        });
    }
    players.sort((left, right) => right.score - left.score);

    const topScore = players[0]?.score ?? 0;
    const leaders = players.filter((p) => p.score === topScore);
    const isTie = leaders.length > 1;
    const winner = isTie ? 0 : players[0].num;
    const winnerColor = isTie ? '#FFD700' : players[0].color;

    // A draw counts as a win in Levels mode (owner decision 2026-10-30): the AI
    // has to actually out-score the player to take a sprite. A tie clears the
    // level, pays the sprite and offers the next one.
    const isLevelsDefeat = Boolean(game.isLevelsMode && winner === 2);

    // The heading used to read "Game Over!" even on a cleared level. Match it
    // to the result so a win or draw never looks like a loss.
    const titleEl = document.getElementById('winnerScreenTitle');
    if (titleEl) {
        if (game.isLevelsMode && !isLevelsDefeat) {
            titleEl.textContent = isTie ? 'Draw!' : 'Level Complete!';
        } else {
            titleEl.textContent = 'Game Over!';
        }
    }

    if (isLevelsDefeat) {
        game.soundManager?.playInvalidSound?.();
    } else {
        game.soundManager?.playVictorySound?.();
    }

    const winnerText = document.getElementById('winnerText');
    const finalScores = document.getElementById('finalScores');
    const playAgainBtn = document.getElementById('playAgain');
    const winnerLevelsBtn = document.getElementById('winnerLevelsBtn');

    if (winnerLevelsBtn) {
        winnerLevelsBtn.hidden = !game.isLevelsMode;
    }

    if (winnerText) {
        if (game.isLevelsMode) {
            if (winner === 1 || isTie) {
                const state = !game._levelResultRecorded
                    ? LevelsProgress.recordLevelWin(game.currentLevel)
                    : LevelsProgress.getState();
                game._levelResultRecorded = true;
                if (window.welcomeAnimation) {
                    window.welcomeAnimation.syncWithLevelsProgress();
                }
                const updatedTurnDuration = getTurnDurationForLevel(state.completedLevels.length);
                const durationSuffix = updatedTurnDuration >= 30 ? ' (max 30s)' : ' (+2s/lvl)';
                const headline = isTie
                    ? `🤝 Level ${game.currentLevel} Complete — Draw! 🤝`
                    : `🏆 Level ${game.currentLevel} Complete! 🏆`;
                const drawNote = isTie
                    ? '<br><span style="font-size: 0.55em; color: #ffd700;">🤝 A draw counts as a win — level cleared.</span>'
                    : '';
                let winHtml = `${headline}${drawNote}<br><span style="font-size: 0.6em; color: #00f0ff;">✨ +1 Sprite (Total: ${state.spritesObtained}) · ⏱️ Turn Timer: ${updatedTurnDuration}s${durationSuffix} ✨</span>`;
                if (state.easterEggJustUnlocked) {
                    winHtml += `<br><span style="font-size: 0.55em; color: #ffd700;">🎆 You beat level 100! Secret unlocked — check the home screen! 🎆</span>`;
                }
                winnerText.innerHTML = winHtml;
                winnerText.style.color = winnerColor;
                if (playAgainBtn) {
                    if (game.currentLevel < MAX_LEVEL) {
                        const nextLevel = game.currentLevel + 1;
                        // Never promise a level the player cannot enter: above
                        // the free tier the button opens the unlock gate instead.
                        playAgainBtn.textContent = LevelsProgress.isLevelUnlocked(nextLevel)
                            ? `Next Level (${nextLevel}) →`
                            : `Unlock Level ${nextLevel} →`;
                        game._nextLevelToPlay = nextLevel;
                    } else {
                        playAgainBtn.textContent = `Replay Level ${MAX_LEVEL} ★`;
                        game._nextLevelToPlay = MAX_LEVEL;
                    }
                }
            } else {
                let lossResult;
                if (!game._levelResultRecorded) {
                    lossResult = LevelsProgress.recordLevelLoss(game.currentLevel);
                    game._levelResultRecorded = true;
                } else {
                    const s = LevelsProgress.getState();
                    lossResult = { state: s, spriteLost: false, level: game.currentLevel };
                }
                if (window.welcomeAnimation) {
                    window.welcomeAnimation.syncWithLevelsProgress();
                }
                const spriteMsg = lossResult.spriteLost
                    ? `💔 −1 Sprite (Total: ${lossResult.state.spritesObtained})`
                    : `🛡️ Your last sprite is safe (Total: 1)`;
                winnerText.innerHTML = `Level ${game.currentLevel} Failed<br><span style="font-size: 0.6em; color: #FFB088;">${spriteMsg} · Try again to unlock the next level!</span>`;
                winnerText.style.color = '#FFB088';
                if (playAgainBtn) {
                    playAgainBtn.textContent = `Retry Level ${game.currentLevel} ↺`;
                    game._nextLevelToPlay = game.currentLevel;
                }
            }
        } else {
            if (playAgainBtn) {
                playAgainBtn.textContent = 'Play Again';
            }
            if (winner === 0) {
                winnerText.textContent = `🤝 It's a Tie! 🤝`;
                winnerText.style.color = '#FFD700';
            } else {
                const winnerLabel = game.isMultiplayer
                    ? getPlayerName(game, winner)
                    : `Player ${winner}`;
                winnerText.textContent = `🏆 ${winnerLabel} Wins! 🏆`;
                winnerText.style.color = winnerColor;
            }
        }
    }

    if (finalScores) {
        finalScores.replaceChildren(
            ...players.map((player) => buildWinnerScoreEntry(player, winner, isTie))
        );
    }

    document.getElementById('gameScreen')?.classList.remove('active');
    showScreen('winnerScreen');

    if (!isLevelsDefeat) {
        launchConfetti(winnerColor);
        launchFireworks(winnerColor);
    }
}
