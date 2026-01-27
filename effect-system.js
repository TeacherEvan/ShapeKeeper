/**
 * ShapeKeeper - Effect System
 * Tile effects, player effects, and modal management
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { DARES, HYPOTHETICALS, PHYSICAL_CHALLENGES, SHAPE_MESSAGES, TILE_EFFECTS, TRUTHS } from './constants.js';

export class EffectSystem {
    constructor(game) {
        this.game = game;
        this.effectModal = null;
        this.pendingEffect = null;
        this.oracleVisionActive = false;
        this.oracleVisionTimeout = null;
        this.effectShimmer = 0;

        this.createEffectModal();
    }

    /**
     * Initialize multipliers (legacy system)
     */
    initializeMultipliers() {
        const totalSquares = (this.game.gridRows - 1) * (this.game.gridCols - 1);

        const allSquareKeys = [];
        for (let row = 0; row < this.game.gridRows - 1; row++) {
            for (let col = 0; col < this.game.gridCols - 1; col++) {
                allSquareKeys.push(`${row},${col}`);
            }
        }

        // Shuffle array
        for (let i = allSquareKeys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allSquareKeys[i], allSquareKeys[j]] = [allSquareKeys[j], allSquareKeys[i]];
        }

        const counts = {
            x2: Math.floor(totalSquares * 0.65),
            x3: Math.floor(totalSquares * 0.2),
            x4: Math.floor(totalSquares * 0.1),
            x5: Math.floor(totalSquares * 0.04),
            x10: Math.max(1, Math.floor(totalSquares * 0.01)),
        };

        let index = 0;

        for (let i = 0; i < counts.x2; i++) {
            if (index < allSquareKeys.length) {
                this.game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 2 };
            }
        }
        for (let i = 0; i < counts.x3; i++) {
            if (index < allSquareKeys.length) {
                this.game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 3 };
            }
        }
        for (let i = 0; i < counts.x4; i++) {
            if (index < allSquareKeys.length) {
                this.game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 4 };
            }
        }
        for (let i = 0; i < counts.x5; i++) {
            if (index < allSquareKeys.length) {
                this.game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 5 };
            }
        }
        for (let i = 0; i < counts.x10; i++) {
            if (index < allSquareKeys.length) {
                this.game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 10 };
            }
        }

        while (index < allSquareKeys.length) {
            this.game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 2 };
        }
    }

    /**
     * Initialize tile effects
     */
    initializeTileEffects() {
        const totalSquares = (this.game.gridRows - 1) * (this.game.gridCols - 1);

        if (!this.game.partyModeEnabled) {
            console.log('[TileEffects] Party Mode disabled - no tile effects');
            return;
        }

        const allPositions = [];
        for (let row = 0; row < this.game.gridRows - 1; row++) {
            for (let col = 0; col < this.game.gridCols - 1; col++) {
                allPositions.push(`${row},${col}`);
            }
        }

        // Shuffle positions
        for (let i = allPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
        }

        const effectCount = totalSquares;
        const trapsCount = Math.floor(effectCount / 2);
        const powerupsCount = effectCount - trapsCount;

        let index = 0;

        // Assign traps
        for (let i = 0; i < trapsCount && index < allPositions.length; i++) {
            const trap = TILE_EFFECTS.traps[Math.floor(Math.random() * TILE_EFFECTS.traps.length)];
            this.game.tileEffects[allPositions[index++]] = {
                type: 'trap',
                effect: trap,
                revealed: false,
                activated: false,
            };
        }

        // Assign powerups
        for (let i = 0; i < powerupsCount && index < allPositions.length; i++) {
            const powerup = TILE_EFFECTS.powerups[Math.floor(Math.random() * TILE_EFFECTS.powerups.length)];
            this.game.tileEffects[allPositions[index++]] = {
                type: 'powerup',
                effect: powerup,
                revealed: false,
                activated: false,
            };
        }

        console.log(
            `[TileEffects] Party Mode enabled - ALL ${effectCount} squares have effects (${trapsCount} traps, ${powerupsCount} powerups)`
        );
    }

    /**
     * Create the effect modal
     */
    createEffectModal() {
        if (document.getElementById('effectModal')) {
            this.effectModal = document.getElementById('effectModal');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'effectModal';
        modal.className = 'effect-modal';
        modal.innerHTML = `
            <div class="effect-modal-content">
                <div class="effect-modal-header">
                    <span class="effect-icon"></span>
                    <h2 class="effect-title"></h2>
                </div>
                <p class="effect-description"></p>
                <div class="effect-prompt"></div>
                <div class="effect-actions">
                    <button class="effect-btn effect-btn-primary">Activate!</button>
                    <button class="effect-btn effect-btn-secondary" style="display: none;">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.effectModal = modal;

        const primaryBtn = modal.querySelector('.effect-btn-primary');
        const secondaryBtn = modal.querySelector('.effect-btn-secondary');

        primaryBtn.addEventListener('click', () => this.activateCurrentEffect());
        secondaryBtn.addEventListener('click', () => this.closeEffectModal());
    }

    /**
     * Reveal tile effect
     */
    revealTileEffect(squareKey) {
        const effectData = this.game.tileEffects[squareKey];
        if (!effectData || this.game.revealedEffects.has(squareKey)) return;

        this.game.revealedEffects.add(squareKey);
        effectData.revealed = true;

        this.pendingEffect = {
            squareKey,
            effectData,
            player: this.game.gameLogic.getCellOwnerForEffects(squareKey),
        };

        this.game.soundManager.playEffectRevealSound(effectData.type);
        this.game.particleSystem.createEffectParticles(squareKey, effectData, this.game.gameLogic.parseSquareKey);

        this.showEffectModal(effectData);
        this.game.draw();
    }

    /**
     * Show effect modal
     */
    showEffectModal(effectData) {
        if (!this.effectModal) return;

        const { effect, type } = effectData;
        const isTrap = type === 'trap';

        const icon = this.effectModal.querySelector('.effect-icon');
        const title = this.effectModal.querySelector('.effect-title');
        const description = this.effectModal.querySelector('.effect-description');
        const prompt = this.effectModal.querySelector('.effect-prompt');
        const primaryBtn = this.effectModal.querySelector('.effect-btn-primary');

        icon.textContent = effect.icon;
        title.textContent = effect.name;
        description.textContent = effect.description;

        this.effectModal.classList.remove('trap-theme', 'powerup-theme');
        this.effectModal.classList.add(isTrap ? 'trap-theme' : 'powerup-theme');

        prompt.innerHTML = '';
        prompt.style.display = 'none';

        if (effect.id === 'hypothetical') {
            const question = HYPOTHETICALS[Math.floor(Math.random() * HYPOTHETICALS.length)];
            prompt.innerHTML = `<div class="effect-question">"${question}"</div>`;
            prompt.style.display = 'block';
        } else if (effect.id === 'dared' || effect.id === 'dare_left') {
            const dare = DARES[Math.floor(Math.random() * DARES.length)];
            prompt.innerHTML = `<div class="effect-dare">${dare}</div>`;
            prompt.style.display = 'block';
        } else if (effect.id === 'truth') {
            const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
            prompt.innerHTML = `<div class="effect-truth">${truth}</div>`;
            prompt.style.display = 'block';
        } else if (effect.id === 'physical_challenge') {
            const challenge = PHYSICAL_CHALLENGES[Math.floor(Math.random() * PHYSICAL_CHALLENGES.length)];
            prompt.innerHTML = `<div class="effect-challenge">${challenge}</div>`;
            prompt.style.display = 'block';
        }

        primaryBtn.textContent = isTrap ? 'Accept Fate!' : 'Activate!';
        primaryBtn.style.background = effect.color;

        this.effectModal.classList.add('show');
    }

    /**
     * Close effect modal
     */
    closeEffectModal() {
        if (this.effectModal) {
            this.effectModal.classList.remove('show');
            this.pendingEffect = null;
        }
    }

    /**
     * Activate current effect
     */
    activateCurrentEffect() {
        if (!this.pendingEffect) {
            this.closeEffectModal();
            return;
        }

        const { squareKey, effectData, player } = this.pendingEffect;
        const { effect } = effectData;

        this.game.activatedEffects.add(squareKey);
        effectData.activated = true;

        this.game.soundManager.playEffectActivationSound(effectData.type, effect.id);

        this.executeEffect(effect.id, effectData.type, player, squareKey);

        this.closeEffectModal();

        this.game.uiManager.updateUI();
        this.game.draw();
    }

    /**
     * Execute effect
     */
    executeEffect(effectId, effectType, player, squareKey) {
        const otherPlayer = player === 1 ? 2 : 1;

        switch (effectId) {
            case 'landmine':
                if (this.game.squares[squareKey]) {
                    delete this.game.squares[squareKey];
                    this.game.protectedSquares.delete(squareKey);
                    this.game.scores[player] = Math.max(0, this.game.scores[player] - 1);
                } else if (this.game.triangles && this.game.triangles[squareKey]) {
                    delete this.game.triangles[squareKey];
                    this.game.scores[player] = Math.max(0, this.game.scores[player] - 0.5);
                }

                this.game.particleSystem.createLandmineParticles(squareKey, this.game.gameLogic.parseSquareKey);
                this.game.shakeIntensity = 15;

                this.playerEffects[player].bonusTurns = 0;
                this.playerEffects[player].doubleLine = false;
                if (this.game.currentPlayer === player) {
                    this.game.comboCount = 0;
                    this.game.switchToNextPlayer();
                } else {
                    this.playerEffects[player].frozenTurns = Math.max(
                        this.playerEffects[player].frozenTurns,
                        1
                    );
                }
                break;

            case 'secret':
            case 'hypothetical':
            case 'drink':
            case 'dared':
            case 'truth':
                break;

            case 'reverse':
                this.game.particleSystem.createReverseParticles();
                this.announceTurnMessage('🔄 REVERSE! Play Again!', '#E91E63', 2000);
                this.playerEffects[player].bonusTurns += 1;
                break;

            case 'freeze':
                this.playerEffects[player].frozenTurns = 1;
                this.game.particleSystem.createFreezeParticles();
                break;

            case 'swap_scores': {
                const temp = this.game.scores[player];
                this.game.scores[player] = this.game.scores[otherPlayer];
                this.game.scores[otherPlayer] = temp;
                this.game.particleSystem.createSwapParticles();
                break;
            }

            case 'ghost':
                this.playerEffects[player].ghostLines = 3;
                break;

            case 'chaos':
                this.triggerChaosStorm();
                break;

            case 'extra_turns':
                this.playerEffects[player].bonusTurns += 2;
                this.game.particleSystem.createPowerupParticles(squareKey, '#4CAF50', this.game.gameLogic.parseSquareKey);
                break;

            case 'steal_territory':
                this.stealConnectedTerritory(player, otherPlayer);
                break;

            case 'dare_left':
            case 'physical_challenge':
                break;

            case 'shield':
                this.playerEffects[player].shieldCount = 3;
                this.game.animationSystem.triggerEffectAnimation('shield', player);
                this.game.particleSystem.createShieldParticles();
                break;

            case 'lightning':
                this.playerEffects[player].doubleLine = true;
                this.game.particleSystem.createLightningParticles();
                break;

            case 'gift':
                this.giftRandomShape(player, otherPlayer);
                break;

            case 'oracle':
                this.activateOracleVision();
                break;

            case 'double_points':
                this.playerEffects[player].doublePointsCount = 3;
                this.game.particleSystem.createPowerupParticles(squareKey, '#FFD700', this.game.gameLogic.parseSquareKey);
                break;

            case 'wildcard':
                this.applyWildcardPowerup(player, squareKey);
                break;
        }
    }

    /**
     * Steal connected territory
     */
    stealConnectedTerritory(player, opponent) {
        const opponentSquares = Object.keys(this.game.squares).filter(
            (key) => this.game.squares[key] === opponent && !this.game.protectedSquares.has(key)
        );

        if (opponentSquares.length === 0) {
            this.announceTurnMessage('🛡️ Steal blocked!', '#3F51B5', 1500);
            return;
        }

        const startKey = opponentSquares[Math.floor(Math.random() * opponentSquares.length)];
        const region = this.getConnectedSquareRegion(startKey, opponent);

        if (region.length === 0) {
            this.announceTurnMessage('🛡️ Steal blocked!', '#3F51B5', 1500);
            return;
        }

        for (const key of region) {
            this.game.squares[key] = player;
        }

        this.game.scores[opponent] = Math.max(0, this.game.scores[opponent] - region.length);
        this.game.scores[player] += region.length;

        this.game.particleSystem.createStealParticles(startKey, this.game.gameLogic.parseSquareKey);
    }

    /**
     * Get connected square region
     */
    getConnectedSquareRegion(startKey, owner) {
        const visited = new Set();
        const queue = [startKey];
        const region = [];

        while (queue.length > 0) {
            const key = queue.pop();
            if (visited.has(key)) continue;
            visited.add(key);

            if (this.game.squares[key] !== owner) continue;
            if (this.game.protectedSquares.has(key)) continue;

            region.push(key);

            const { row, col } = this.game.gameLogic.parseSquareKey(key);
            const neighbors = [
                `${row - 1},${col}`,
                `${row + 1},${col}`,
                `${row},${col - 1}`,
                `${row},${col + 1}`,
            ];
            for (const n of neighbors) {
                if (!visited.has(n) && this.game.squares[n] === owner) {
                    queue.push(n);
                }
            }
        }

        return region;
    }

    /**
     * Gift random shape
     */
    giftRandomShape(fromPlayer, toPlayer) {
        const ownedSquares = Object.keys(this.game.squares).filter(
            (key) => this.game.squares[key] === fromPlayer
        );

        if (ownedSquares.length > 0) {
            const key = ownedSquares[Math.floor(Math.random() * ownedSquares.length)];
            this.game.squares[key] = toPlayer;
            this.game.scores[fromPlayer] = Math.max(0, this.game.scores[fromPlayer] - 1);
            this.game.scores[toPlayer] += 1;
            this.game.particleSystem.createGiftParticles();
            return;
        }

        const ownedTriangles = Object.keys(this.game.triangles || {}).filter(
            (key) => this.game.triangles[key] === fromPlayer
        );

        if (ownedTriangles.length > 0) {
            const key = ownedTriangles[Math.floor(Math.random() * ownedTriangles.length)];
            this.game.triangles[key] = toPlayer;
            this.game.scores[fromPlayer] = Math.max(0, this.game.scores[fromPlayer] - 0.5);
            this.game.scores[toPlayer] += 0.5;
            this.game.particleSystem.createGiftParticles();
            return;
        }

        this.game.scores[toPlayer] += 1;
        this.game.particleSystem.createGiftParticles();
    }

    /**
     * Apply wildcard powerup
     */
    applyWildcardPowerup(player, squareKey) {
        const powerups = TILE_EFFECTS.powerups.filter((p) => p.id !== 'wildcard');
        const chosen = powerups[Math.floor(Math.random() * powerups.length)];

        this.game.particleSystem.createWildcardParticles(squareKey, this.game.gameLogic.parseSquareKey);
        this.announceTurnMessage(`🌟 Wildcard: ${chosen.name}`, chosen.color, 2000);
        this.executeEffect(chosen.id, 'powerup', player, squareKey);
    }

    /**
     * Announce turn message
     */
    announceTurnMessage(text, color, durationMs = 2000) {
        const turnIndicator = document.getElementById('turnIndicator');
        if (!turnIndicator) return;

        const prevText = turnIndicator.textContent;
        const prevColor = turnIndicator.style.color;

        turnIndicator.textContent = text;
        if (color) {
            turnIndicator.style.color = color;
        }

        setTimeout(() => {
            turnIndicator.textContent = prevText;
            turnIndicator.style.color = prevColor;
            this.game.uiManager.updateUI();
        }, durationMs);
    }

    /**
     * Activate Oracle's Vision
     */
    activateOracleVision() {
        this.oracleVisionActive = true;
        this.game.draw();

        if (this.oracleVisionTimeout) {
            clearTimeout(this.oracleVisionTimeout);
        }

        this.oracleVisionTimeout = setTimeout(() => {
            this.oracleVisionActive = false;
            this.game.draw();
        }, 10000);
    }

    /**
     * Trigger chaos storm
     */
    triggerChaosStorm() {
        const allSquares = Object.keys(this.game.squares);

        const players = allSquares.map((key) => this.game.squares[key]);
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        allSquares.forEach((key, i) => {
            this.game.squares[key] = players[i];
        });

        if (this.game.triangles) {
            const allTriangles = Object.keys(this.game.triangles);
            if (allTriangles.length > 0) {
                const triPlayers = allTriangles.map((key) => this.game.triangles[key]);
                for (let i = triPlayers.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [triPlayers[i], triPlayers[j]] = [triPlayers[j], triPlayers[i]];
                }
                allTriangles.forEach((key, i) => {
                    this.game.triangles[key] = triPlayers[i];
                });
            }
        }

        this.game.scores = { 1: 0, 2: 0 };
        Object.values(this.game.squares).forEach((player) => {
            this.game.scores[player]++;
        });
        if (this.game.triangles) {
            Object.values(this.game.triangles).forEach((player) => {
                this.game.scores[player] += 0.5;
            });
        }

        this.game.shakeIntensity = 12;
        this.game.screenPulse = 1.5;
        this.game.particleSystem.createChaosParticles();
    }

    /**
     * Reveal multiplier
     */
    async revealMultiplier(squareKey) {
        if (this.game.isMultiplayer) {
            const squareOwner = this.game.squares[squareKey];
            if (squareOwner !== this.game.myPlayerNumber) {
                return;
            }

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.revealMultiplier(squareKey);
                if (result.error) {
                    console.error('[Game] Error revealing multiplier:', result.error);
                    return;
                }
                return;
            }
        }

        this.game.revealedMultipliers.add(squareKey);
        const multiplierData = this.game.squareMultipliers[squareKey];
        const player = this.game.squares[squareKey];

        if (multiplierData && multiplierData.type === 'multiplier') {
            const currentScore = this.game.scores[player];
            const multiplierValue = multiplierData.value;
            this.game.scores[player] = currentScore * multiplierValue;

            this.game.animationSystem.triggerMultiplierAnimation(squareKey, multiplierValue, this.game.gameLogic.parseSquareKey, this.game.offsetX, this.game.offsetY, this.game.cellSize, this.game.particleSystem.createMultiplierParticles);
            this.game.uiManager.updateUI();
        }
        this.game.draw();
    }

    /**
     * Reveal multiplier for cell
     */
    revealMultiplierForCell(cellKey) {
        this.game.revealedMultipliers.add(cellKey);

        const multiplierData = this.game.squareMultipliers[cellKey];
        const owner = this.game.gameLogic.getCellOwnerForEffects(cellKey);

        if (multiplierData && multiplierData.type === 'multiplier' && owner) {
            const currentScore = this.game.scores[owner];
            const multiplierValue = multiplierData.value;
            this.game.scores[owner] = currentScore * multiplierValue;
            this.game.animationSystem.triggerMultiplierAnimation(cellKey, multiplierValue, this.game.gameLogic.parseSquareKey, this.game.offsetX, this.game.offsetY, this.game.cellSize, this.game.particleSystem.createMultiplierParticles);
            this.game.uiManager.updateUI();
        }
        this.game.draw();
    }

    /**
     * Show shape message
     */
    showShapeMessage(cellKey) {
        const messages = SHAPE_MESSAGES;
        const message = messages[Math.floor(Math.random() * messages.length)];

        if (!this.effectModal) {
            this.createEffectModal();
        }

        const modal = this.effectModal;
        const content = modal.querySelector('.effect-modal-content');
        const title = modal.querySelector('.effect-title');
        const desc = modal.querySelector('.effect-description');
        const icon = modal.querySelector('.effect-icon');
        const prompt = modal.querySelector('.effect-prompt');
        const primaryBtn = modal.querySelector('.effect-btn-primary');
        const secondaryBtn = modal.querySelector('.effect-btn-secondary');

        modal.className = 'effect-modal show powerup-theme';

        icon.textContent = '🔺';
        title.textContent = 'Triangle Wisdom';
        desc.textContent = message;
        prompt.innerHTML = '';

        primaryBtn.textContent = 'Awesome!';
        primaryBtn.onclick = () => this.closeEffectModal();
        secondaryBtn.style.display = 'none';
    }
}