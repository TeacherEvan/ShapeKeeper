/**
 * SHA-256 and HMAC-SHA256, in plain TypeScript.
 *
 * Why not WebCrypto: the Convex runtime's WebCrypto support varies by
 * deployment vintage, and a fulfilment webhook that cannot verify a
 * signature is a webhook that either blocks every sale or trusts every
 * caller. This module has no runtime dependency at all, and the test
 * suite proves it byte-for-byte against Node's `node:crypto`.
 *
 * The rule that matters: the signature is verified against the RAW request
 * body. Re-serialising the JSON first changes the bytes and breaks every
 * signature.
 */

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

function rotr(x: number, n: number): number {
    return (x >>> n) | (x << (32 - n));
}

/** SHA-256 over raw bytes. Returns the 32-byte digest. */
export function sha256Bytes(message: Uint8Array): Uint8Array {
    const bitLength = message.length * 8;
    // message + 0x80 + zero padding + 8-byte big-endian bit length, rounded up
    // to the next 64-byte boundary. `(len + 9)` is the minimum size; rounding
    // it up must not add a whole extra block when it is already a multiple
    // of 64 (that is the case for every length ≡ 55 mod 64).
    const paddedLength = ((message.length + 9 + 63) >> 6) << 6;
    const padded = new Uint8Array(paddedLength);
    padded.set(message);
    padded[message.length] = 0x80;

    const view = new DataView(padded.buffer);
    // JS bitwise ops are 32-bit; the length is written as a 64-bit big-endian
    // integer, so the high word goes first and the low word second.
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);

    const h = new Uint32Array(INITIAL);
    const w = new Uint32Array(64);

    for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let i = 0; i < 16; i++) {
            w[i] = view.getUint32(offset + i * 4, false);
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }

        let [a, b, c, d, e, f, g, hh] = h;

        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            hh = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }

        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
        h[5] = (h[5] + f) >>> 0;
        h[6] = (h[6] + g) >>> 0;
        h[7] = (h[7] + hh) >>> 0;
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
    return out;
}

export function toHex(bytes: Uint8Array): string {
    let hex = '';
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
    return hex;
}

export function sha256Hex(message: string): string {
    return toHex(sha256Bytes(new TextEncoder().encode(message)));
}

function xorPad(block: Uint8Array, pad: number): Uint8Array {
    const out = new Uint8Array(block.length);
    for (let i = 0; i < block.length; i++) out[i] = block[i] ^ pad;
    return out;
}

/** HMAC-SHA256 over the raw bytes of `body`, keyed with `secret`. */
export function hmacSha256Bytes(secret: string, body: Uint8Array): Uint8Array {
    const keyBytes = new TextEncoder().encode(secret);
    let key: Uint8Array = keyBytes;
    if (key.length > 64) {
        // Keys longer than the block size are hashed first (RFC 2104).
        key = new Uint8Array(sha256Bytes(key));
    }

    const paddedKey = new Uint8Array(64);
    paddedKey.set(key);

    const inner = new Uint8Array(64 + body.length);
    inner.set(xorPad(paddedKey, 0x36));
    inner.set(body, 64);
    const innerDigest = sha256Bytes(inner);

    const outer = new Uint8Array(64 + innerDigest.length);
    outer.set(xorPad(paddedKey, 0x5c));
    outer.set(innerDigest, 64);
    return sha256Bytes(outer);
}

export function hmacSha256Hex(secret: string, body: string): string {
    return toHex(hmacSha256Bytes(secret, new TextEncoder().encode(body)));
}

/**
 * Constant-time comparison of two hex strings. Length differences are not
 * secret (the expected length is fixed), but the content comparison must not
 * leak its first differing byte through timing.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
