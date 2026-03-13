/**
 * Toast notification system for ShapeKeeper
 * @module ui/Toast
 */

/**
 * Show a toast notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of toast: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    toast.setAttribute(
        'aria-live',
        type === 'error' || type === 'warning' ? 'assertive' : 'polite'
    );
    toast.setAttribute('aria-atomic', 'true');

    const messageEl = document.createElement('span');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Dismiss notification');
    closeButton.textContent = '×';

    toast.append(messageEl, closeButton);

    // Add to body
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Close button handler
    closeButton.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });

    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}
