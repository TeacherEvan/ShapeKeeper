import { describe, it, expect, beforeEach } from 'vitest';
import {
    activateCurrentEffect,
    executeEffect,
    createEffectModal,
} from '../effect-system/gameplay.js';
import { createEffectModal as initModal, closeEffectModal } from '../effect-system/modal.js';

// Minimal stand-in for the game + UI the effect system drives.
function makeSystem(pendingEffect = null) {
    const game = {
        activatedEffects: new Set(),
        playerEffects: {
            1: { frozenTurns: 0, ghostLines: 0, bonusTurns: 0, shieldCount: 0 },
            2: { frozenTurns: 0, ghostLines: 0, bonusTurns: 0, shieldCount: 0 },
        },
        particleSystem: { createFreezeParticles() {}, createReverseParticles() {} },
        soundManager: { playEffectActivationSound: () => {} },
        uiManager: { updateUI: () => {} },
        draw: () => {},
    };
    const system = {
        game,
        pendingEffect,
        effectModal: null,
        announceTurnMessage: (text) => {
            system._lastMessage = text;
        },
        closeEffectModal: () => {
            system.effectModal = null;
        },
    };
    return system;
}

describe('effect-system/gameplay', () => {
    it('activateCurrentEffect with no pending effect just closes the modal', () => {
        const system = makeSystem(null);
        activateCurrentEffect(system);
        expect(system.effectModal).toBeNull();
    });

    it('freeze effect sets frozenTurns on the acting player', () => {
        const system = makeSystem({
            squareKey: '1-1',
            player: 1,
            effectData: { effect: { id: 'freeze' }, type: 'trap', activated: false },
        });
        activateCurrentEffect(system);
        expect(system.game.playerEffects[1].frozenTurns).toBe(1);
        expect(system.game.activatedEffects.has('1-1')).toBe(true);
    });

    it('ghost effect grants ghost lines', () => {
        const system = makeSystem({
            squareKey: '2-2',
            player: 2,
            effectData: { effect: { id: 'ghost' }, type: 'powerup', activated: false },
        });
        activateCurrentEffect(system);
        expect(system.game.playerEffects[2].ghostLines).toBe(3);
    });

    it('reverse effect grants a bonus turn and announces', () => {
        const system = makeSystem({
            squareKey: '0-0',
            player: 1,
            effectData: { effect: { id: 'reverse' }, type: 'powerup', activated: false },
        });
        activateCurrentEffect(system);
        expect(system.game.playerEffects[1].bonusTurns).toBe(1);
        expect(system._lastMessage).toContain('REVERSE');
    });

    it('executeEffect handles a no-op social effect without mutating state', () => {
        const system = makeSystem();
        const before = JSON.stringify(system.game.playerEffects);
        executeEffect(system, 'truth', 'social', 1, '3-3');
        expect(JSON.stringify(system.game.playerEffects)).toBe(before);
    });

    it('closeEffectModal hides the modal and clears the pending effect', () => {
        // Build a real modal via modal.js, then confirm close removes the
        // `show` class and drops the pending effect. The rendered node is kept
        // in the DOM (created once, populated via textContent only), so the
        // reference persists — which is fine; what matters is it is hidden.
        document.body.innerHTML = '';
        const sys = { effectModal: null, pendingEffect: { effect: { id: 'truth' } } };
        initModal(sys);
        expect(sys.effectModal).not.toBeNull();
        const node = document.getElementById('effectModal');
        node.classList.add('show');
        expect(node.classList.contains('show')).toBe(true);
        closeEffectModal(sys);
        expect(node.classList.contains('show')).toBe(false);
        expect(sys.pendingEffect).toBeNull();
    });
});
