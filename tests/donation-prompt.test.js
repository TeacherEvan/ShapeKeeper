import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DONATION_PROMPT_STORAGE_KEY,
    isDonor,
    maybeShowDonationPrompt,
    shouldShowDonationPrompt,
} from '../src/ui/DonationPrompt.js';

const MODAL_MARKUP = `
    <div id="donationPromptOverlay" hidden>
        <div id="donationAskCard">
            <div class="donation-prompt-heart" aria-hidden="true">❤️</div>
            <h2 id="donationPromptTitle">Consider donating</h2>
            <p id="donationPromptBody">ShapeKeeper is free.</p>
            <button id="donationSureBtn" type="button">Sure</button>
            <button id="donationLaterBtn" type="button" aria-label="Maybe later">🐷</button>
        </div>
        <div id="donationThanksCard" hidden>
            <h2 id="donationThanksTitle">Thank you for the kindness</h2>
            <p id="donationThanksBody">Nothing was unlocked.</p>
            <button id="donationConfirmBtn" type="button">I donated 🧚</button>
            <button id="donationThanksCloseBtn" type="button" aria-label="Close">close</button>
        </div>
    </div>
`;

const readStored = () => JSON.parse(localStorage.getItem(DONATION_PROMPT_STORAGE_KEY) || '{}');

describe('DonationPrompt', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = MODAL_MARKUP;
        window.DONATION_URL = 'https://example.com/donate';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.DONATION_URL;
        document.body.innerHTML = '';
    });

    it('only offers the prompt on every fifth completed level', () => {
        expect(shouldShowDonationPrompt(4)).toBe(false);
        expect(shouldShowDonationPrompt(5)).toBe(true);
        expect(shouldShowDonationPrompt(10)).toBe(true);
        expect(shouldShowDonationPrompt(11)).toBe(false);
    });

    it('asks with the heart and the pig, plays the chime, and opens the URL on Sure', () => {
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        const soundManager = {
            ensureAudioContext: vi.fn(),
            playDonationChime: vi.fn(),
        };

        maybeShowDonationPrompt({ level: 5, soundManager });
        const overlay = document.getElementById('donationPromptOverlay');
        const askCard = document.getElementById('donationAskCard');

        expect(overlay.hidden).toBe(false);
        expect(askCard.hidden).toBe(false);
        expect(askCard.textContent).toContain('❤️');
        expect(document.getElementById('donationLaterBtn').textContent.trim()).toBe('🐷');
        // The ask must never advertise the gratitude badge.
        expect(askCard.textContent).not.toContain('🧚');
        expect(askCard.textContent.toLowerCase()).not.toContain('unlock');

        expect(soundManager.ensureAudioContext).toHaveBeenCalledTimes(1);
        expect(soundManager.playDonationChime).toHaveBeenCalledTimes(1);

        document.getElementById('donationSureBtn').click();

        expect(open).toHaveBeenCalledWith(
            'https://example.com/donate',
            '_blank',
            'noopener,noreferrer'
        );
        // Sorry — gratitude, not a receipt: the ask gives way to a thank-you view.
        expect(document.getElementById('donationThanksCard').hidden).toBe(false);
        expect(askCard.hidden).toBe(true);
    });

    it('marks a donor only when the player explicitly confirms', async () => {
        vi.spyOn(window, 'open').mockReturnValue(null);
        const result = maybeShowDonationPrompt({ level: 5 });

        document.getElementById('donationSureBtn').click();
        expect(isDonor()).toBe(false);

        document.getElementById('donationConfirmBtn').click();

        await expect(result).resolves.toBe('donated');
        expect(isDonor()).toBe(true);
        expect(readStored()).toMatchObject({ donor: true, lastPromptLevel: 5 });
        expect(readStored().donatedAt).toBeTruthy();
        expect(document.getElementById('donationPromptOverlay').hidden).toBe(true);
    });

    it('does not mark a donor when the thank-you view is simply closed', async () => {
        vi.spyOn(window, 'open').mockReturnValue(null);
        const result = maybeShowDonationPrompt({ level: 5 });

        document.getElementById('donationSureBtn').click();
        document.getElementById('donationThanksCloseBtn').click();

        await expect(result).resolves.toBe('dismissed');
        expect(isDonor()).toBe(false);
        expect(readStored().donor).not.toBe(true);
    });

    it('shows a returning donor gratitude instead of the ask', async () => {
        localStorage.setItem(
            DONATION_PROMPT_STORAGE_KEY,
            JSON.stringify({ lastPromptLevel: 0, donor: true, donatedAt: '2026-10-25T00:00:00Z' })
        );
        const open = vi.spyOn(window, 'open').mockReturnValue(null);

        const result = maybeShowDonationPrompt({ level: 5 });

        expect(document.getElementById('donationAskCard').hidden).toBe(true);
        expect(document.getElementById('donationThanksCard').hidden).toBe(false);
        expect(document.getElementById('donationConfirmBtn').hidden).toBe(true);
        expect(document.getElementById('donationThanksCard').textContent).toContain('🧚');

        document.getElementById('donationThanksCloseBtn').click();

        await expect(result).resolves.toBe('thanked');
        // Gratitude never re-opens the donation page or changes anything.
        expect(open).not.toHaveBeenCalled();
        expect(isDonor()).toBe(true);
    });

    it('dismisses with the pig button and does not nag again for that level', async () => {
        const result = maybeShowDonationPrompt({ level: 5 });
        document.getElementById('donationLaterBtn').click();

        await expect(result).resolves.toBe('dismissed');
        expect(shouldShowDonationPrompt(5)).toBe(false);
        expect(shouldShowDonationPrompt(10)).toBe(true);
    });

    it('does nothing when no donation URL is configured', async () => {
        window.DONATION_URL = '';
        const soundManager = { ensureAudioContext: vi.fn(), playDonationChime: vi.fn() };

        await expect(maybeShowDonationPrompt({ level: 5, soundManager })).resolves.toBe('skipped');

        expect(document.getElementById('donationPromptOverlay').hidden).toBe(true);
        expect(soundManager.playDonationChime).not.toHaveBeenCalled();
    });

    it('does not stack a second prompt while one is already open', async () => {
        const first = maybeShowDonationPrompt({ level: 5 });
        await expect(maybeShowDonationPrompt({ level: 5 })).resolves.toBe('skipped');

        document.getElementById('donationLaterBtn').click();
        await expect(first).resolves.toBe('dismissed');
    });

    it('compliance invariant: the donation flow writes no other storage key', async () => {
        vi.spyOn(window, 'open').mockReturnValue(null);

        const result = maybeShowDonationPrompt({ level: 5 });
        document.getElementById('donationSureBtn').click();
        document.getElementById('donationConfirmBtn').click();
        await result;

        // Storage was cleared in beforeEach, so any other key here would be a
        // write from this flow — a level unlock, a progress save, a perk flag.
        const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
        expect(keys).toEqual([DONATION_PROMPT_STORAGE_KEY]);
        expect(isDonor()).toBe(true);
    });
});
