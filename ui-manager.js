/**
 * ShapeKeeper - UI Manager
 * User interface updates and DOM manipulation
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

export class UIManager {
    constructor(game) {
        this.game = game;
        this.domCache = {
            player1Score: document.getElementById('player1Score'),
            player2Score: document.getElementById('player2Score'),
            player1Info: document.getElementById('player1Info'),
            player2Info: document.getElementById('player2Info'),
            turnIndicator: document.getElementById('turnIndicator'),
            populateBtn: document.getElementById('populateBtn'),
            loadingSkeleton: document.getElementById('gameLoadingSkeleton'),
        };
    }

    /**
     * Display or hide the loading skeleton
     */
    displayLoadingSkeleton(isLoading) {
        const skeleton = this.domCache.loadingSkeleton;
        if (skeleton) {
            skeleton.classList.toggle('hidden', !isLoading);
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        const now = Date.now();
        if (now - this.game.lastUIUpdate < this.game.uiUpdateInterval) {
            return;
        }
        this.game.lastUIUpdate = now;

        const { player1Score, player2Score, player1Info, player2Info, turnIndicator } = this.domCache;

        // Animate score counting
        const player1ScoreDiff = this.game.scores[1] - this.game.displayedScores[1];
        const player2ScoreDiff = this.game.scores[2] - this.game.displayedScores[2];

        if (Math.abs(player1ScoreDiff) > 0.1) {
            this.game.displayedScores[1] += player1ScoreDiff * this.game.scoreAnimationSpeed;
        } else {
            this.game.displayedScores[1] = this.game.scores[1];
        }

        if (Math.abs(player2ScoreDiff) > 0.1) {
            this.game.displayedScores[2] += player2ScoreDiff * this.game.scoreAnimationSpeed;
        } else {
            this.game.displayedScores[2] = this.game.scores[2];
        }

        player1Score.textContent = Math.floor(this.game.displayedScores[1]);
        player2Score.textContent = Math.floor(this.game.displayedScores[2]);

        player1Info.classList.toggle('active', this.game.currentPlayer === 1);
        player2Info.classList.toggle('active', this.game.currentPlayer === 2);

        player1Info.style.color = this.game.player1Color;
        player2Info.style.color = this.game.player2Color;

        this.updatePlayerEffectsDisplay(1, player1Info);
        this.updatePlayerEffectsDisplay(2, player2Info);

        if (this.game.isMultiplayer) {
            this.game.isMyTurn = this.game.currentPlayer === this.game.myPlayerNumber;
            turnIndicator.textContent = this.game.isMyTurn ? 'Your Turn' : "Opponent's Turn";
        } else {
            turnIndicator.textContent = `Player ${this.game.currentPlayer}'s Turn`;
        }
        turnIndicator.style.color = this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;
    }

    /**
     * Update the visual display of active effects for a player
     */
    updatePlayerEffectsDisplay(playerNum, playerInfoElement) {
        if (!playerInfoElement) return;

        const effects = this.game.playerEffects[playerNum];
        let effectsContainer = playerInfoElement.querySelector('.player-effects');

        if (!effectsContainer) {
            effectsContainer = document.createElement('div');
            effectsContainer.className = 'player-effects';
            playerInfoElement.appendChild(effectsContainer);
        }

        const effectIcons = [];

        if (effects.frozenTurns > 0) {
            effectIcons.push(`<span title="Frozen for ${effects.frozenTurns} turn(s)">❄️</span>`);
        }
        if (effects.shieldCount > 0) {
            effectIcons.push(`<span title="Shield (${effects.shieldCount} squares protected)">🛡️</span>`);
        }
        if (effects.doublePointsCount > 0) {
            effectIcons.push(`<span title="Double points (${effects.doublePointsCount} squares)">✨×2</span>`);
        }
        if (effects.ghostLines > 0) {
            effectIcons.push(`<span title="Ghost lines (${effects.ghostLines} remaining)">👻</span>`);
        }
        if (effects.bonusTurns > 0) {
            effectIcons.push(`<span title="Bonus turns (${effects.bonusTurns} remaining)">🎁×${effects.bonusTurns}</span>`);
        }
        if (effects.doubleLine) {
            effectIcons.push(`<span title="Lightning - Draw 2 lines!">⚡</span>`);
        }

        effectsContainer.innerHTML = effectIcons.join(' ');
    }

    /**
     * Update populate button visibility
     */
    updatePopulateButtonVisibility() {
        const populateBtn = this.domCache.populateBtn;
        if (!populateBtn) return;

        if (this.game.isMultiplayer && !this.game.isHost) {
            populateBtn.classList.add('hidden');
            return;
        }

        const safeLines = this.game.gameLogic.getSafeLines();

        if (safeLines.length === 0) {
            populateBtn.classList.add('hidden');
        } else {
            populateBtn.classList.remove('hidden');
        }
    }

    /**
     * Trigger bonus turn visual
     */
    triggerBonusTurnVisual() {
        const turnIndicator = document.getElementById('turnIndicator');
        if (turnIndicator) {
            turnIndicator.textContent = '🎁 BONUS TURN! 🎁';
            turnIndicator.style.animation = 'pulse 0.5s ease-in-out 3';
            setTimeout(() => {
                turnIndicator.style.animation = '';
                this.updateUI();
            }, 1500);
        }

        const playerColor = this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;

            this.game.particleSystem.particles.push({
                x: this.game.logicalWidth / 2,
                y: this.game.logicalHeight / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: playerColor,
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                spark: true,
            });
        }
    }

    /**
     * Trigger skip turn visual
     */
    triggerSkipTurnVisual(skippedPlayer) {
        const turnIndicator = document.getElementById('turnIndicator');
        if (turnIndicator) {
            turnIndicator.textContent = `❄️ Player ${skippedPlayer} is FROZEN! Turn skipped! ❄️`;
            turnIndicator.style.color = '#03A9F4';
            setTimeout(() => {
                this.updateUI();
            }, 2000);
        }

        for (let i = 0; i < 25; i++) {
            this.game.particleSystem.particles.push({
                x: Math.random() * this.game.logicalWidth,
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

    /**
     * Trigger double points visual
     */
    triggerDoublePointsVisual() {
        const turnIndicator = document.getElementById('turnIndicator');
        if (turnIndicator) {
            turnIndicator.textContent = '✨ DOUBLE POINTS! ✨';
            turnIndicator.style.color = '#FFD700';
            setTimeout(() => {
                this.updateUI();
            }, 1500);
        }

        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;

            this.game.particleSystem.particles.push({
                x: this.game.logicalWidth / 2,
                y: this.game.logicalHeight / 2,
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

    /**
     * Trigger double line reminder
     */
    triggerDoubleLineReminder() {
        const turnIndicator = document.getElementById('turnIndicator');
        if (turnIndicator) {
            turnIndicator.textContent = '⚡ LIGHTNING! Draw another line! ⚡';
            turnIndicator.style.color = '#FFEB3B';
            setTimeout(() => {
                this.updateUI();
            }, 2000);
        }

        for (let i = 0; i < 25; i++) {
            this.game.particleSystem.particles.push({
                x: Math.random() * this.game.logicalWidth,
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

    /**
     * Show winner screen
     */
    showWinner() {
        const winner = this.game.scores[1] > this.game.scores[2] ? 1 : this.game.scores[2] > this.game.scores[1] ? 2 : 0;
        const winnerColor = winner === 1 ? this.game.player1Color : winner === 2 ? this.game.player2Color : '#FFD700';

        this.game.soundManager.playVictorySound();

        const winnerScreen = document.getElementById('winnerScreen');
        const winnerText = document.getElementById('winnerText');
        const finalScores = document.getElementById('finalScores');

        if (winner === 0) {
            winnerText.innerHTML = `🤝 It's a Tie! 🤝`;
            winnerText.style.color = '#FFD700';
        } else {
            winnerText.innerHTML = `🏆 Player ${winner} Wins! 🏆`;
            winnerText.style.color = winnerColor;
        }

        const players = [
            { num: 1, score: this.game.scores[1], color: this.game.player1Color },
            { num: 2, score: this.game.scores[2], color: this.game.player2Color },
        ].sort((a, b) => b.score - a.score);

        finalScores.innerHTML = players
            .map(
                (p, i) => `
            <div class="final-score-entry ${p.num === winner ? 'winner' : ''}">
                <span class="final-score-rank">${i === 0 ? '🥇' : '🥈'}</span>
                <div class="final-score-color" style="background-color: ${p.color}"></div>
                <span class="final-score-name">Player ${p.num}</span>
                <span class="final-score-points" style="color: ${p.color}">${p.score}</span>
            </div>
        `
            )
            .join('');

        document.getElementById('gameScreen').classList.remove('active');
        winnerScreen.classList.add('active');

        this.launchConfetti(winnerColor);
        this.launchFireworks(winnerColor);
    }

    /**
     * Launch confetti celebration
     */
    launchConfetti(accentColor) {
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

        for (let i = 0; i < 150; i++) {
            confetti.push({
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
            });
            confetti[i].startX = confetti[i].x;
        }

        let frame = 0;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let activeCount = 0;
            confetti.forEach((c) => {
                if (c.y < canvas.height + 50) {
                    activeCount++;
                    c.y += c.vy;
                    c.x = c.startX + Math.sin(frame * c.oscillationSpeed) * c.oscillationDistance;
                    c.rotation += c.rotationSpeed;

                    ctx.save();
                    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
                    ctx.rotate((c.rotation * Math.PI) / 180);
                    ctx.fillStyle = c.color;
                    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                    ctx.restore();
                }
            });

            frame++;

            if (activeCount > 0 && frame < 300) {
                requestAnimationFrame(animate);
            } else {
                canvas.remove();
            }
        };

        animate();
    }

    /**
     * Launch fireworks celebration
     */
    launchFireworks(accentColor) {
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
            launchCount++;
        }, 400);

        const animate = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            fireworks.forEach((fw, i) => {
                if (!fw.exploded) {
                    fw.y += fw.vy;
                    fw.vy += 0.2;

                    ctx.beginPath();
                    ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = fw.color;
                    ctx.fill();

                    if (fw.y <= fw.targetY || fw.vy >= 0) {
                        fw.exploded = true;

                        for (let j = 0; j < 40; j++) {
                            const angle = (Math.PI * 2 * j) / 40;
                            const speed = 3 + Math.random() * 4;
                            particles.push({
                                x: fw.x,
                                y: fw.y,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                color: fw.color,
                                life: 1,
                                decay: 0.015 + Math.random() * 0.01,
                            });
                        }
                    }
                }
            });

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.08;
                p.vx *= 0.98;
                p.life -= p.decay;

                if (p.life > 0) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle =
                        p.color +
                        Math.floor(p.life * 255)
                            .toString(16)
                            .padStart(2, '0');
                    ctx.fill();
                } else {
                    particles.splice(i, 1);
                }
            }

            if (particles.length > 0 || fireworks.some((f) => !f.exploded)) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => canvas.remove(), 1000);
            }
        };

        animate();
    }
}