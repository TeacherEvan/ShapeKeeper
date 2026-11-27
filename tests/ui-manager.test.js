import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UIManager } from '../ui-manager.js';

function makeGame(overrides = {}) {
    return {
        lastUIUpdate: 0,
        uiUpdateInterval: 0, // disable throttle so updateUI always runs
        scoreAnimationSpeed: 1,
        scores: { 1: 0, 2: 0 },
        displayedScores: { 1: 0, 2: 0 },
        currentPlayer: 1,
        player1Color: '#f00',
        player2Color: '#00f',
        isMultiplayer: false,
        myPlayerNumber: 1,
        isHost: true,
        playerEffects: { 1: {}, 2: {} },
        activatedEffects: new Set(),
        gameLogic: { getSafeLines: () => [1, 2, 3] },
        uiManager: null,
        updateUI: () => {},
        draw: () => {},
        ...overrides,
    };
}

function installDom() {
    const root = document.createElement('div');
    [
        'player1Score',
        'player2Score',
        'player1Info',
        'player2Info',
        'turnIndicator',
        'populateBtn',
        'gameLoadingSkeleton',
        'gameLiveRegion',
    ].forEach((id) => {
        const el = document.createElement('div');
        el.id = id;
        root.appendChild(el);
    });
    document.body.appendChild(root);
    return root;
}

describe('UIManager', () => {
    let root;
    beforeEach(() => {
        root = installDom();
    });
    afterEach(() => {
        root.remove();
    });

    it('caches the expected DOM nodes and starts with a clean render state', () => {
        const game = makeGame();
        const ui = new UIManager(game);
        expect(ui.domCache.player1Score.id).toBe('player1Score');
        expect(ui.domCache.turnIndicator.id).toBe('turnIndicator');
        expect(ui.lastRenderedState.player1Score).toBeNull();
    });

    it('displayLoadingSkeleton toggles the hidden class (loading=true hides the skeleton)', () => {
        const game = makeGame();
        const ui = new UIManager(game);
        const skeleton = ui.domCache.loadingSkeleton;
        ui.displayLoadingSkeleton(true);
        expect(skeleton.classList.contains('hidden')).toBe(false);
        ui.displayLoadingSkeleton(false);
        expect(skeleton.classList.contains('hidden')).toBe(true);
    });

    it('updateUI writes scores and a turn label into the DOM', () => {
        const game = makeGame({ scores: { 1: 4, 2: 2 }, currentPlayer: 1 });
        const ui = new UIManager(game);
        ui.updateUI();
        expect(ui.domCache.player1Score.textContent).toBe('4');
        expect(ui.domCache.player2Score.textContent).toBe('2');
        expect(ui.domCache.turnIndicator.textContent).toContain('Player 1');
    });

    it('updateUI is throttled by uiUpdateInterval', () => {
        const game = makeGame({ uiUpdateInterval: 100000, lastUIUpdate: Date.now() });
        const ui = new UIManager(game);
        // Should early-return without touching the score text.
        ui.updateUI();
        expect(ui.domCache.player1Score.textContent).toBe('');
    });

    it('updatePopulateButtonVisibility hides the button for non-host multiplayer', () => {
        const game = makeGame({ isMultiplayer: true, isHost: false });
        const ui = new UIManager(game);
        ui.updatePopulateButtonVisibility();
        expect(ui.domCache.populateBtn.classList.contains('hidden')).toBe(true);
    });

    it('updatePopulateButtonVisibility keeps the button visible for the host', () => {
        const game = makeGame({ isMultiplayer: true, isHost: true });
        const ui = new UIManager(game);
        ui.updatePopulateButtonVisibility();
        expect(ui.domCache.populateBtn.classList.contains('hidden')).toBe(false);
    });

    it('toggles multi-player header class and syncs all 6 player names', () => {
        const p1Name = document.createElement('span');
        p1Name.className = 'player-name';
        document.getElementById('player1Info').appendChild(p1Name);
        const p2Name = document.createElement('span');
        p2Name.className = 'player-name';
        document.getElementById('player2Info').appendChild(p2Name);

        const game = makeGame({
            playerCount: 6,
            isMultiplayer: true,
            playerNames: { 1: 'Evan', 2: 'Alex', 3: 'Sarah', 4: 'Marcus', 5: 'Priya', 6: 'Devon' },
            playerColors: { 1: '#f00', 2: '#00f', 3: '#0f0', 4: '#ff0', 5: '#a0f', 6: '#0ff' },
            scores: { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 0 },
        });
        const ui = new UIManager(game);
        ui.updateUI();

        expect(root.classList.contains('multi-player')).toBe(true);
        expect(p1Name.textContent).toBe('Evan');
        expect(p2Name.textContent).toBe('Alex');
        expect(document.getElementById('player6Name').textContent).toBe('Devon');
    });
});
