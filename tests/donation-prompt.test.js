import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DONATION_PROMPT_STORAGE_KEY,
    maybeShowDonationPrompt,
    shouldShowDonationPrompt,
} from '../src/ui/DonationPrompt.js';

const MODAL_MARKUP = `
    <div id="donationPromptOverlay" hidden>
        <div>
            <h2 id="donationPromptTitle">Consider donating</h2>
            <p id="donationPromptBody">ShapeKeeper is free.</p>
            <button id="donationSureBtn" type="button">Sure</button>
            <button id="donationLaterBtn" type="button" aria-label="Maybe later">🐷</button>
        </div>
    </div>
`;

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

    it('never asks for a tip once the paid edition is on', () => {
        window.PAYWALL_ENABLED = true;
        expect(shouldShowDonationPrompt(5)).toBe(false);
        expect(shouldShowDonationPrompt(10, { force: true })).toBe(false);
        window.PAYWALL_ENABLED = false;
        expect(shouldShowDonationPrompt(5)).toBe(true);
    });

    it('shows the prompt, plays the chime, and opens the donation URL on Sure', async () => {
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        const soundManager = {
            ensureAudioContext: vi.fn(),
            playDonationChime: vi.fn(),
        };

        const result = maybeShowDonationPrompt({ level: 5, soundManager });
        const overlay = document.getElementById('donationPromptOverlay');

        expect(overlay.hidden).toBe(false);
        expect(soundManager.ensureAudioContext).toHaveBeenCalledTimes(1);
        expect(soundManager.playDonationChime).toHaveBeenCalledTimes(1);

        document.getElementById('donationSureBtn').click();

        await expect(result).resolves.toBe('donated');
        expect(open).toHaveBeenCalledWith(
            'https://example.com/donate',
            '_blank',
            'noopener,noreferrer'
        );
        expect(overlay.hidden).toBe(true);
        expect(JSON.parse(localStorage.getItem(DONATION_PROMPT_STORAGE_KEY))).toEqual({
            lastPromptLevel: 5,
        });
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
});
