// Convex builds the .ts files in this directory; the .js file alongside is
// only here so Vitest can import the same implementation for unit tests
// without bringing in the Convex runtime. Keep the two in sync.

export const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(random = Math.random) {
    const out = new Array(ROOM_CODE_LENGTH);
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        out[i] = ROOM_CODE_CHARSET.charAt(Math.floor(random() * ROOM_CODE_CHARSET.length));
    }
    return out.join('');
}

// Cryptographically-strong variant. Use this on the server (Convex runtime
// has crypto.getRandomValues globally available). Falls back to Math.random
// only if the runtime is somehow missing the Web Crypto API, which would be
// a misconfiguration — log loud so it surfaces in monitoring.
export function generateSecureRoomCode() {
    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
        console.error(
            '[generateSecureRoomCode] crypto.getRandomValues unavailable; falling back to Math.random. Investigate the Convex runtime.'
        );
        return generateRoomCode(Math.random);
    }
    return generateRoomCode(() => {
        // 32 bits of entropy is far more than the 32^6 = ~30-bit code
        // space; the modulo bias is negligible.
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] / 0x100000000;
    });
}
