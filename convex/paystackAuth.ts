/**
 * Pure helpers for the Paystack HTTP surface. Kept free of Convex imports so
 * they can be unit-tested in isolation and reused from http.ts.
 *
 * No secrets live here. Never put the Paystack secret key in this module.
 */

/** Explicit browser origins permitted to call the license / verify endpoints. */
export const ALLOWED_ORIGINS = [
    'https://shape-keeper.vercel.app',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://localhost:3000',
];

/**
 * True only for an explicit allowlist entry. A missing Origin (null/undefined)
 * is denied — never a wildcard. Preview deployments are not implicitly trusted:
 * any <anything>.vercel.app could be registered by another account.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
    if (typeof origin !== 'string' || origin.length === 0) return false;
    return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Constant-time comparison of two equal-length hex strings. XOR-accumulates
 * every character difference plus the length difference; a zero accumulator
 * means the two strings are identical. WebCrypto-compatible (no Node crypto).
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    let diff = a.length ^ b.length;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
        diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
}

/**
 * Single authoritative order check for BOTH server-side verification paths.
 * Amount alone is unsafe: 1800 subunits of a cheaper currency is not R18.
 * Everything comes from Paystack's API, never from the browser.
 */
export function paymentMatchesOrder(
    data: { status?: unknown; amount?: unknown; currency?: unknown } | null | undefined,
    expectedKobo: number,
    expectedCurrency: string
): boolean {
    return (
        data?.status === 'success' &&
        Number(data.amount) === expectedKobo &&
        String(data.currency ?? '').toUpperCase() === expectedCurrency.toUpperCase()
    );
}

// URL-safe base64 alphabet (64 symbols, so an 8-bit byte maps uniformly).
const REF_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Build a Paystack reference with 96 bits of CSPRNG entropy, shaped as
 * `SK-` + base64url characters: matches [A-Za-z0-9_-]{6,64}. Synchronous and
 * browser-safe (uses only globalThis.crypto.getRandomValues).
 */
export function generateReference(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let body = '';
    for (const byte of bytes) body += REF_ALPHABET[byte % REF_ALPHABET.length];
    return `SK-${body}`;
}
