import { DARES, HYPOTHETICALS, PHYSICAL_CHALLENGES, SHAPE_MESSAGES, TRUTHS } from '../constants.js';

export function createEffectModal(system) {
    if (document.getElementById('effectModal')) {
        system.effectModal = document.getElementById('effectModal');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'effectModal';
    modal.className = 'effect-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'effectModalTitle');
    modal.setAttribute('aria-describedby', 'effectModalDescription');
    modal.innerHTML = `
        <div class="effect-modal-content">
            <div class="effect-modal-header">
                <span class="effect-icon"></span>
                <h2 class="effect-title" id="effectModalTitle"></h2>
            </div>
            <p class="effect-description" id="effectModalDescription"></p>
            <div class="effect-prompt"></div>
            <div class="effect-actions">
                <button class="effect-btn effect-btn-primary" type="button">Activate!</button>
                <button class="effect-btn effect-btn-secondary" style="display: none;" type="button">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    system.effectModal = modal;

    const primaryBtn = modal.querySelector('.effect-btn-primary');
    const secondaryBtn = modal.querySelector('.effect-btn-secondary');

    primaryBtn.addEventListener('click', () => system.activateCurrentEffect());
    secondaryBtn.addEventListener('click', () => system.closeEffectModal());
}

export function showEffectModal(system, effectData) {
    if (!system.effectModal) return;

    const { effect, type } = effectData;
    const isTrap = type === 'trap';

    const icon = system.effectModal.querySelector('.effect-icon');
    const title = system.effectModal.querySelector('.effect-title');
    const description = system.effectModal.querySelector('.effect-description');
    const prompt = system.effectModal.querySelector('.effect-prompt');
    const primaryBtn = system.effectModal.querySelector('.effect-btn-primary');

    icon.textContent = effect.icon;
    title.textContent = effect.name;
    description.textContent = effect.description;

    system.effectModal.classList.remove('trap-theme', 'powerup-theme');
    system.effectModal.classList.add(isTrap ? 'trap-theme' : 'powerup-theme');

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
        const challenge =
            PHYSICAL_CHALLENGES[Math.floor(Math.random() * PHYSICAL_CHALLENGES.length)];
        prompt.innerHTML = `<div class="effect-challenge">${challenge}</div>`;
        prompt.style.display = 'block';
    }

    primaryBtn.textContent = isTrap ? 'Accept Fate!' : 'Activate!';
    primaryBtn.style.background = effect.color;

    system.effectModal.classList.add('show');
    primaryBtn.focus({ preventScroll: true });
}

export function closeEffectModal(system) {
    if (system.effectModal) {
        system.effectModal.classList.remove('show');
        system.pendingEffect = null;
    }
}

export function showShapeMessage(system) {
    const message = SHAPE_MESSAGES[Math.floor(Math.random() * SHAPE_MESSAGES.length)];

    if (!system.effectModal) {
        createEffectModal(system);
    }

    const modal = system.effectModal;
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
    primaryBtn.onclick = () => system.closeEffectModal();
    secondaryBtn.style.display = 'none';
}
