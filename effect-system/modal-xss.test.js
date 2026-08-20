import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { createEffectModal, showEffectModal } from './modal.js';
import { HYPOTHETICALS, DARES, TRUTHS, PHYSICAL_CHALLENGES } from '../constants.js';

// Each effect prompt is built from one of these content arrays. To prove the
// rendering path is XSS-immune, we splice a hostile payload into the array at
// index 0, force the random pick to choose index 0, and assert the payload is
// emitted as inert text rather than parsed markup.
const MALICIOUS = '<img src=x onerror=alert(1)>';

describe('effect modal prompt rendering (AUD-6 XSS safety)', () => {
    let system;

    beforeEach(() => {
        document.body.innerHTML = '';
        system = {
            effectModal: null,
            pendingEffect: null,
            activateCurrentEffect: () => {},
            closeEffectModal: () => {},
        };
        createEffectModal(system);
        HYPOTHETICALS.unshift(MALICIOUS);
        DARES.unshift(MALICIOUS);
        TRUTHS.unshift(MALICIOUS);
        PHYSICAL_CHALLENGES.unshift(MALICIOUS);
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        HYPOTHETICALS.shift();
        DARES.shift();
        TRUTHS.shift();
        PHYSICAL_CHALLENGES.shift();
        vi.restoreAllMocks();
    });

    function promptFor(effectId, type) {
        showEffectModal(system, { effect: { id: effectId, name: 'X', description: '' }, type });
        return system.effectModal.querySelector('.effect-prompt');
    }

    it('renders the hypothetical prompt as inert text, not parsed HTML', () => {
        const prompt = promptFor('hypothetical', 'powerup');
        const child = prompt.querySelector('.effect-question');
        expect(child).not.toBeNull();
        expect(child.textContent).toContain(MALICIOUS);
        expect(prompt.querySelector('img')).toBeNull();
    });

    it('renders the dare prompt as inert text', () => {
        const prompt = promptFor('dared', 'trap');
        const child = prompt.querySelector('.effect-dare');
        expect(child).not.toBeNull();
        expect(child.textContent).toContain(MALICIOUS);
        expect(prompt.querySelector('img')).toBeNull();
    });

    it('renders the truth prompt as inert text', () => {
        const prompt = promptFor('truth', 'powerup');
        const child = prompt.querySelector('.effect-truth');
        expect(child).not.toBeNull();
        expect(child.textContent).toContain(MALICIOUS);
        expect(prompt.querySelector('img')).toBeNull();
    });

    it('renders the physical challenge prompt as inert text', () => {
        const prompt = promptFor('physical_challenge', 'trap');
        const child = prompt.querySelector('.effect-challenge');
        expect(child).not.toBeNull();
        expect(child.textContent).toContain(MALICIOUS);
        expect(prompt.querySelector('img')).toBeNull();
    });
});
