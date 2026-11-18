/**
 * ShapeKeeper checkout — Paystack Inline JS -> server-verified licence key.
 *
 * The browser never decides whether a payment succeeded. Paystack redirects
 * back with a reference; /paystack/verify asks Paystack's API server-side,
 * mints the licence once, and returns the key. Keys are idempotent per
 * reference, so refreshing the page cannot mint a second licence.
 */
/* global PaystackPop */
(function checkout() {
    'use strict';

    // Amount comes from config.js (window.PAYSTACK_AMOUNT_KOBO); 1800 is a
    // fallback for when config.js has not been loaded. Never change the price
    // here without also updating the server-side EXPECTED_KOBO check.
    const AMOUNT_KOBO = window.PAYSTACK_AMOUNT_KOBO || 1800;
    const CURRENCY = 'ZAR';
    const statusEl = document.getElementById('status');
    const form = document.getElementById('payform');
    const emailEl = document.getElementById('email');
    const payBtn = document.getElementById('pay');
    const keyBox = document.getElementById('keybox');
    const keyEl = document.getElementById('key');
    const copyBtn = document.getElementById('copy');
    const backBtn = document.getElementById('back');

    const publicKey = window.PAYSTACK_PUBLIC_KEY || '';
    const verifyUrl = window.PAYSTACK_VERIFY_URL || '';

    function setStatus(message, kind) {
        statusEl.textContent = message;
        statusEl.dataset.kind = kind || 'info';
    }

    // URL-safe alphabet (64 symbols) so each random byte maps uniformly.
    const REF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    function generateReference() {
        // 16 bytes -> 16 base64url chars = 96 bits of CSPRNG entropy, shaped SK- + base64url.
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        let body = '';
        for (const byte of bytes) body += REF_ALPHABET[byte % REF_ALPHABET.length];
        return `SK-${body}`;
    }

    function showKey(key, reference) {
        keyEl.textContent = key;
        keyBox.style.display = 'block';
        setStatus('Payment received. Your unlock key is ready.', 'success');
        // Keep the reference client-side only: a URL fragment is never sent to
        // the server or in Referer headers, unlike a query string.
        try {
            sessionStorage.setItem('shapekeeper_paystack_reference', reference);
        } catch (_error) {
            /* storage can be blocked; the fragment still survives a refresh */
        }
        history.replaceState(
            null,
            '',
            `${location.pathname}#reference=${encodeURIComponent(reference)}`
        );
    }

    async function verify(reference) {
        setStatus('Confirming your payment…', 'info');
        try {
            const response = await fetch(verifyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok || typeof data.key !== 'string') {
                setStatus(data.reason || 'Could not confirm the payment yet.', 'error');
                return false;
            }
            showKey(data.key, reference);
            return true;
        } catch {
            setStatus('Could not reach the licence service. Check your connection.', 'error');
            return false;
        }
    }

    // A returning buyer gets the same key back. The reference lives in the
    // fragment (never sent to a server) with sessionStorage as a fallback.
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    let storedReference = null;
    try {
        storedReference = sessionStorage.getItem('shapekeeper_paystack_reference');
    } catch (_error) {
        storedReference = null;
    }
    const returning = hashParams.get('reference') || storedReference;
    if (returning) {
        payBtn.disabled = true;
        verify(returning);
    }

    if (!publicKey || !verifyUrl) {
        payBtn.disabled = true;
        if (!returning) {
            setStatus(
                'Payments are not configured yet — ask the owner to set the Paystack public key.',
                'error'
            );
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = emailEl.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setStatus('Enter a valid email for your receipt.', 'error');
            return;
        }
        if (typeof PaystackPop === 'undefined') {
            setStatus('Paystack could not load. Check your connection.', 'error');
            return;
        }

        payBtn.disabled = true;
        setStatus('Opening secure payment…', 'info');
        const reference = generateReference();
        const handler = PaystackPop.setup({
            key: publicKey,
            email,
            amount: AMOUNT_KOBO,
            currency: CURRENCY,
            ref: reference,
            metadata: {
                custom_fields: [
                    {
                        display_name: 'Product',
                        variable_name: 'product',
                        value: 'ShapeKeeper unlock',
                    },
                ],
            },
            callback: () => verify(reference),
            onClose: () => {
                payBtn.disabled = false;
                setStatus(
                    'Payment window closed. If you paid, use the reference from your receipt below.',
                    'info'
                );
            },
        });
        handler.openIframe();
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(keyEl.textContent);
            setStatus('Key copied. Paste it into the game.', 'success');
        } catch {
            setStatus('Select the key and copy it manually.', 'info');
        }
    });

    backBtn.addEventListener('click', () => {
        location.href = '/';
    });
})();
