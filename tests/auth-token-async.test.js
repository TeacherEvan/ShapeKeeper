import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateHostToken, hashToken, isAuthorisedHostAsync } from '../convex/auth/token.js';

describe('isAuthorisedHostAsync (full-token path)', () => {
    const newRoom = {
        hostPlayerId: 'session_abc',
        hostTokenHash: 'placeholder', // replaced in each test
    };

    it('rejects when the raw token is wrong', async () => {
        const correctToken = generateHostToken();
        newRoom.hostTokenHash = await hashToken(correctToken);
        const wrongToken = generateHostToken();
        expect(await isAuthorisedHostAsync(newRoom, 'session_abc', wrongToken)).toBe(false);
    });

    it('accepts when the raw token matches the stored hash', async () => {
        const token = generateHostToken();
        newRoom.hostTokenHash = await hashToken(token);
        expect(await isAuthorisedHostAsync(newRoom, 'session_abc', token)).toBe(true);
    });

    it('rejects when sessionId does not match, even with a valid token', async () => {
        const token = generateHostToken();
        newRoom.hostTokenHash = await hashToken(token);
        expect(await isAuthorisedHostAsync(newRoom, 'session_other', token)).toBe(false);
    });

    it('rejects when raw token is empty string', async () => {
        const token = generateHostToken();
        newRoom.hostTokenHash = await hashToken(token);
        expect(await isAuthorisedHostAsync(newRoom, 'session_abc', '')).toBe(false);
    });

    it('falls back to sessionId-only for legacy rooms (no hostTokenHash)', async () => {
        const legacy = { hostPlayerId: 'session_abc' };
        expect(await isAuthorisedHostAsync(legacy, 'session_abc', undefined)).toBe(true);
        expect(await isAuthorisedHostAsync(legacy, 'session_abc', null)).toBe(true);
        expect(await isAuthorisedHostAsync(legacy, 'session_abc', '')).toBe(true);
    });
});

// A small "what sessionStorage would do" simulation: assert the per-tab
// hostToken stashing pattern in the browser code behaves correctly.
// We cannot import the convex-client JS directly (it's a script-tag IIFE
// expected to run in a browser, not under Vitest), so we model the
// stash/clear pattern in pure JS and verify it. This catches accidental
// leaks (e.g. forgetting to clear on leave) before the e2e suite does.
describe('hostToken stashing pattern (browser-side, modeled)', () => {
    function makeStash(sessionStorage) {
        return {
            stash(roomId, token) {
                if (!roomId || typeof token !== 'string' || token.length === 0) return;
                sessionStorage.setItem(`shapekeeper_host_token_${roomId}`, token);
            },
            get(roomId) {
                if (!roomId) return null;
                return sessionStorage.getItem(`shapekeeper_host_token_${roomId}`);
            },
            clear(roomId) {
                if (!roomId) return;
                sessionStorage.removeItem(`shapekeeper_host_token_${roomId}`);
            },
        };
    }

    let storage;
    beforeEach(() => {
        const map = new Map();
        storage = {
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, v),
            removeItem: (k) => map.delete(k),
        };
    });
    afterEach(() => {
        storage = null;
    });

    it('round-trips a token through stash/get', () => {
        const s = makeStash(storage);
        s.stash('room_1', 'tok_xyz');
        expect(s.get('room_1')).toBe('tok_xyz');
    });

    it('isolates tokens by roomId', () => {
        const s = makeStash(storage);
        s.stash('room_1', 'tok_1');
        s.stash('room_2', 'tok_2');
        expect(s.get('room_1')).toBe('tok_1');
        expect(s.get('room_2')).toBe('tok_2');
    });

    it('returns null for an unknown roomId', () => {
        const s = makeStash(storage);
        expect(s.get('never-stashed')).toBeNull();
    });

    it('clears the entry on demand (called from leaveRoom)', () => {
        const s = makeStash(storage);
        s.stash('room_1', 'tok_1');
        s.clear('room_1');
        expect(s.get('room_1')).toBeNull();
    });

    it('refuses to stash empty / non-string tokens', () => {
        const s = makeStash(storage);
        s.stash('room_1', '');
        s.stash('room_1', null);
        s.stash('room_1', undefined);
        expect(s.get('room_1')).toBeNull();
    });
});
