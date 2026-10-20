/**
 * TurnNoticeBubble - Comic-style speech bubble notifications
 *
 * Provides funny 2-second speech bubbles for:
 * - AI penalty box triggers (0.2x multiplier)
 * - Missed turn / timeout auto-moves
 *
 * @module ui/TurnNoticeBubble
 */

export const AI_PENALTY_QUIPS = [
    'Who put a discount on my box?!',
    'Error 0.2: dignity not found.',
    'I meant to do that. Totally.',
    '80% off… and not the good kind.',
    'Note to self: avoid sparkly boxes.',
    'My circuits feel… smaller.',
    "Wait, that wasn't in my minimax tree!",
    'That box was a trap! A shiny trap!',
    'Recalculating... ego severely damaged.',
    'Congratulations, you played... me.',
    'Did somebody shrink my score?!',
    'Fine. You can have that 0.2 box.',
    'Beep boop... sadness protocol initiated 🥺',
    'I demand to speak to the Shape Keeper!',
    'My points just went through a hot wash cycle!',
    'That was not points... that was crumbs!',
];

export const TIMEOUT_QUIPS = [
    'Too slow! The dice chose for you 🎲',
    'Snooze you lose… a line!',
    'Autopilot engaged ✈️',
    "Time's up! Let fate decide ⚡",
    'Tick tock! Random line locked in ⏱️',
];

export function getNextRandomQuip(quipList, lastQuip) {
    if (!Array.isArray(quipList) || quipList.length === 0) return '';
    if (quipList.length === 1) return quipList[0];

    const available = quipList.filter((q) => q !== lastQuip);
    const chosenIndex = Math.floor(Math.random() * available.length);
    return available[chosenIndex];
}

export class TurnNoticeBubble {
    constructor(parentContainer) {
        this.parentContainer = parentContainer || null;
        this.element = null;
        this.hideTimeout = null;
        this.lastAiQuip = null;
        this.lastTimeoutQuip = null;
    }

    getParent() {
        if (this.parentContainer && this.parentContainer.isConnected) {
            return this.parentContainer;
        }
        return document.getElementById('gameScreen') || document.body;
    }

    ensureElement() {
        if (!this.element || !this.element.isConnected) {
            const parent = this.getParent();
            let el = parent.querySelector('#turnNoticeBubble');
            if (!el) {
                el = document.createElement('aside');
                el.id = 'turnNoticeBubble';
                el.className = 'turn-notice-bubble';
                el.setAttribute('role', 'status');
                el.setAttribute('aria-live', 'polite');
                parent.appendChild(el);
            }
            this.element = el;
        }
        return this.element;
    }

    show(variant = 'ai-penalty') {
        const el = this.ensureElement();
        if (!el) return;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        let quip = '';
        let avatar = '🤖';

        if (variant === 'ai-penalty') {
            quip = getNextRandomQuip(AI_PENALTY_QUIPS, this.lastAiQuip);
            this.lastAiQuip = quip;
            avatar = '🤖';
            el.className = 'turn-notice-bubble ai-penalty';
        } else {
            quip = getNextRandomQuip(TIMEOUT_QUIPS, this.lastTimeoutQuip);
            this.lastTimeoutQuip = quip;
            avatar = '⏰';
            el.className = 'turn-notice-bubble timeout';
        }

        el.innerHTML = `
            <span class="bubble-avatar" aria-hidden="true">${avatar}</span>
            <span class="bubble-text">${quip}</span>
        `;

        // Restart animation
        el.classList.remove('active');
        // Force reflow
        void el.offsetWidth;
        el.classList.add('active');

        // Visible for 2 seconds
        this.hideTimeout = setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('active');
            }
            this.hideTimeout = null;
        }, 2000);
    }

    destroy() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}
