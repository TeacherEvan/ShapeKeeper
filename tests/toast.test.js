// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToast, showToast } from '../src/ui/Toast.js';

describe('Toast notification helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        clearToast();
        vi.useRealTimers();
    });

    it('renders one toast at a time and clearToast removes it immediately', () => {
        showToast('First notice', 'info', 4000);
        showToast('Second notice', 'warning', 4000);

        const toasts = document.querySelectorAll('.toast-notification');
        expect(toasts).toHaveLength(1);
        expect(toasts[0].querySelector('.toast-message').textContent).toBe('Second notice');

        clearToast();
        expect(document.querySelectorAll('.toast-notification')).toHaveLength(0);
    });
});
