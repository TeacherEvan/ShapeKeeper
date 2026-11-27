import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { ALLOWED_ORIGINS, isAllowedOrigin, paymentMatchesOrder, timingSafeHexEqual } from './paystackAuth';

/**
 * Public HTTP surface for Paystack unlock licences.
 *
 *  POST /license/validate  — game gate: form `license_key=<key>` -> {valid}
 *  POST /paystack/verify   — checkout page: JSON {reference} -> {key}
 *  POST /paystack/webhook  — Paystack: charge.success / charge.refunded
 *
 * The Paystack secret key is read from the Convex deployment env, never from
 * the browser and never from this repo. Set it with:
 *   npx convex env set PAYSTACK_SECRET_KEY sk_live_xxx
 *   npx convex env set PAYSTACK_AMOUNT_KOBO 1800
 */

// Convex runs actions on Node; read env via globalThis so no @types/node is needed.
const env = (globalThis as any).process?.env ?? {};
const SECRET = () => env.PAYSTACK_SECRET_KEY ?? '';
const EXPECTED_KOBO = (): number | null => {
    const raw = env.PAYSTACK_AMOUNT_KOBO;
    if (raw === undefined || raw === null || String(raw).trim() === '') return 1800;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const MAX_VERIFY_BODY_BYTES = 4096;
const MAX_WEBHOOK_BODY_BYTES = 65536;

function clientIpKey(request: Request): string {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp && cfIp.trim()) return cfIp.trim().slice(0, 64);
    const xff = request.headers.get('x-forwarded-for');
    if (xff && xff.trim()) return xff.split(',')[0].trim().slice(0, 64);
    return 'unknown';
}
// Amount alone is not enough: 1800 kobo and 1800 subunits of a cheaper currency
// are very different prices. Both server paths must check the currency too.
const EXPECTED_CURRENCY = () => String(env.PAYSTACK_CURRENCY || 'ZAR').toUpperCase();
const PAYSTACK_API = 'https://api.paystack.co/transaction/verify/';

function allowedOrigin(request: Request): string | null {
    const origin = request.headers.get('origin');
    // Missing/unknown Origin is denied; never fall back to a wildcard.
    return isAllowedOrigin(origin) ? origin : null;
}

function cors(origin: string | null): Record<string, string> {
    return {
        // Never emit a wildcard: denied requests fall back to the first explicit origin.
        'Access-Control-Allow-Origin': origin ?? ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-paystack-signature',
        Vary: 'Origin',
    };
}

function json(body: unknown, status: number, origin: string | null): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors(origin) },
    });
}

async function sha256Hex(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function makeKey(): string {
    const random = new Uint32Array(16);
    crypto.getRandomValues(random);
    let raw = '';
    for (const n of random) raw += KEY_ALPHABET[n % KEY_ALPHABET.length];
    const groups = [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12), raw.slice(12, 16)];
    return `SK-${groups.join('-')}`;
}

/** Mint once per Paystack reference; safe to call from both verify and webhook. */
async function mintLicence(
    ctx: any,
    reference: string,
    email: string | undefined,
    amountKobo: number
): Promise<{ key: string; created: boolean; status: 'active' | 'revoked' | 'refunded' }> {
    if (await ctx.runQuery(internal.licences.isRefunded, { reference })) {
        return { key: '', created: false, status: 'refunded' };
    }
    const existing = await ctx.runQuery(internal.licences.getByReference, { reference });
    if (existing) {
        if (existing.status === 'revoked') {
            return { key: existing.key, created: false, status: 'revoked' };
        }
        return { key: existing.key, created: false, status: 'active' };
    }

    const key = makeKey();
    const keyHash = await sha256Hex(key);
    // The mutation is the idempotency authority. Return ITS stored values, not
    // our locally generated key: two concurrent verifies can both pass the
    // read above, but only the first key is persisted by `issue`.
    const r = (await ctx.runMutation(internal.licences.issue, {
        keyHash,
        key,
        reference,
        email,
        amountKobo,
    })) as { refunded?: boolean; key?: string; created?: boolean; status?: 'active' | 'revoked' };
    if (r.refunded) return { key: '', created: false, status: 'refunded' as const };
    return {
        key: r.key ?? '',
        created: r.created ?? false,
        status: r.status === 'revoked' ? ('revoked' as const) : ('active' as const),
    };
}

/* -------------------------------------------------------------------------- */
/* POST /license/validate — called by UnlockGate.js                            */
/* -------------------------------------------------------------------------- */
export async function validateLicenseHandler(ctx: any, request: Request): Promise<Response> {
    const origin = allowedOrigin(request);
    if (!origin) return json({ valid: false, reason: 'Origin not allowed' }, 403, null);

    if (typeof ctx.runMutation === 'function') {
        const rl = (await ctx.runMutation(internal.licences.consumeHttpRateLimit, {
            action: 'httpValidateLicense',
            key: clientIpKey(request),
        })) as { allowed: boolean; resetMs?: number };
        if (rl && !rl.allowed) {
            const retryAfter = String(Math.max(1, Math.ceil((rl.resetMs ?? 60000) / 1000)));
            return new Response(JSON.stringify({ valid: false, reason: 'Too many requests' }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': retryAfter,
                    ...cors(origin),
                },
            });
        }
    }

    let key = '';
    try {
        const body = await request.text();
        if (body.length > MAX_VERIFY_BODY_BYTES) {
            return json({ valid: false, reason: 'Request too large' }, 413, origin);
        }
        const contentType = request.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const parsed = JSON.parse(body);
            key = typeof parsed.license_key === 'string' ? parsed.license_key.trim() : '';
        } else {
            key = new URLSearchParams(body).get('license_key')?.trim() ?? '';
        }
    } catch {
        return json({ valid: false, reason: 'Malformed request' }, 400, origin);
    }
    if (!key) return json({ valid: false, reason: 'Enter the key from your receipt' }, 400, origin);

    const result = await ctx.runQuery(internal.licences.getByHash, {
        keyHash: await sha256Hex(key),
    });
    return json(result, 200, origin);
}
const validateLicense = httpAction(validateLicenseHandler);

/* -------------------------------------------------------------------------- */
/* POST /paystack/verify — checkout page after Paystack redirects back          */
/* -------------------------------------------------------------------------- */
export async function verifyPaymentHandler(ctx: any, request: Request): Promise<Response> {
    const origin = allowedOrigin(request);
    if (!origin) return json({ ok: false, reason: 'Origin not allowed' }, 403, null);

    if (typeof ctx.runMutation === 'function') {
        const rl = (await ctx.runMutation(internal.licences.consumeHttpRateLimit, {
            action: 'httpVerifyPayment',
            key: clientIpKey(request),
        })) as { allowed: boolean; resetMs?: number };
        if (rl && !rl.allowed) {
            const retryAfter = String(Math.max(1, Math.ceil((rl.resetMs ?? 60000) / 1000)));
            return new Response(JSON.stringify({ ok: false, reason: 'Too many requests' }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': retryAfter,
                    ...cors(origin),
                },
            });
        }
    }

    let reference = '';
    try {
        const rawBody = await request.text();
        if (rawBody.length > MAX_VERIFY_BODY_BYTES) {
            return json({ ok: false, reason: 'Request too large' }, 413, origin);
        }
        const body = JSON.parse(rawBody);
        reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    } catch {
        return json({ ok: false, reason: 'Malformed request' }, 400, origin);
    }
    if (!reference || !/^[A-Za-z0-9_-]{6,64}$/.test(reference)) {
        return json({ ok: false, reason: 'Invalid payment reference' }, 400, origin);
    }

    const expectedKobo = EXPECTED_KOBO();
    if (expectedKobo === null) {
        return json({ ok: false, reason: 'Payments misconfigured' }, 503, origin);
    }

    const secret = SECRET();
    if (!secret) {
        return json({ ok: false, reason: 'Payments are not configured yet' }, 503, origin);
    }

    let data: any;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${PAYSTACK_API}${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Paystack ${response.status}`);
        data = (await response.json()).data;
    } catch {
        return json({ ok: false, reason: 'Could not reach Paystack. Try again.' }, 502, origin);
    } finally {
        clearTimeout(timeout);
    }

    // Never trust the browser: status, amount AND currency come from Paystack's API.
    if (!paymentMatchesOrder(data, expectedKobo, EXPECTED_CURRENCY())) {
        return json({ ok: false, reason: 'Payment did not match the order' }, 402, origin);
    }

    const minted = await mintLicence(
        ctx,
        reference,
        typeof data.customer?.email === 'string' ? data.customer.email : undefined,
        Number(data.amount)
    );
    if (minted.status === 'revoked' || minted.status === 'refunded') {
        const reason =
            minted.status === 'refunded'
                ? 'This payment was refunded. Contact support.'
                : 'This licence was revoked. Contact support.';
        return json({ ok: false, reason }, 402, origin);
    }
    return json({ ok: true, key: minted.key, created: minted.created }, 200, origin);
}
const verifyPayment = httpAction(verifyPaymentHandler);

/* -------------------------------------------------------------------------- */
/* POST /paystack/webhook — authoritative refund + success relay               */
/* -------------------------------------------------------------------------- */
export async function paystackWebhookHandler(ctx: any, request: Request): Promise<Response> {
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
        return new Response('Payload too large', { status: 413 });
    }
    const raw = await request.text();
    if (raw.length > MAX_WEBHOOK_BODY_BYTES) {
        return new Response('Payload too large', { status: 413 });
    }
    const secret = SECRET();
    const signature = request.headers.get('x-paystack-signature') ?? '';

    if (!secret || !signature) {
        return new Response('Missing signature', { status: 401 });
    }
    // HMAC-SHA512 hex is exactly 128 chars. Cap untrusted input before the
    // constant-time loop so its cost cannot be inflated by a huge header.
    if (!/^[0-9a-f]{128}$/i.test(signature)) {
        return new Response('Invalid signature', { status: 401 });
    }

    // Paystack signs the RAW body with HMAC-SHA512.
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    const expected = Array.from(new Uint8Array(sigBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    if (!timingSafeHexEqual(expected, signature.toLowerCase())) {
        return new Response('Invalid signature', { status: 401 });
    }

    let event: any;
    try {
        event = JSON.parse(raw);
    } catch {
        return new Response('Malformed JSON', { status: 400 });
    }

    const data = event?.data;
    const reference = data?.reference;
    if (typeof reference !== 'string') {
        return new Response('ok', { status: 200 });
    }

    const expectedKobo = EXPECTED_KOBO();
    if (
        event.event === 'charge.success' &&
        expectedKobo !== null &&
        paymentMatchesOrder(data, expectedKobo, EXPECTED_CURRENCY())
    ) {
        await mintLicence(
            ctx,
            reference,
            typeof data.customer?.email === 'string' ? data.customer.email : undefined,
            Number(data.amount)
        );
    } else if (event.event === 'charge.refunded') {
        // Tombstone first: a refund can arrive before the licence exists.
        await ctx.runMutation(internal.licences.markRefunded, { reference });
        await ctx.runMutation(internal.licences.revokeByReference, { reference });
    }

    return new Response('ok', { status: 200 });
}
const paystackWebhook = httpAction(paystackWebhookHandler);

const http = httpRouter();
http.route({ path: '/license/validate', method: 'POST', handler: validateLicense });
http.route({ path: '/license/validate', method: 'OPTIONS', handler: httpAction(async (_ctx, req) =>
    new Response(null, { status: 204, headers: cors(allowedOrigin(req)) })) });
http.route({ path: '/paystack/verify', method: 'POST', handler: verifyPayment });
http.route({ path: '/paystack/verify', method: 'OPTIONS', handler: httpAction(async (_ctx, req) =>
    new Response(null, { status: 204, headers: cors(allowedOrigin(req)) })) });
http.route({ path: '/paystack/webhook', method: 'POST', handler: paystackWebhook });

export default http;
