import { describe, expect, it } from 'vitest';

import {
    generateHostToken,
    hashToken,
    isAuthorisedHost,
    projectPlayersForClient,
    projectRoomForClient,
    timingSafeEqual,
} from '../convex/auth/token.js';

describe('generateHostToken', () => {
    it('returns a 64-character hex string', () => {
        const t = generateHostToken();
        expect(t).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different value on each call', () => {
        const samples = new Set();
        for (let i = 0; i < 16; i++) samples.add(generateHostToken());
        expect(samples.size).toBe(16);
    });
});

describe('hashToken', () => {
    it('hashes a token to a 64-char hex string', async () => {
        const h = await hashToken('abc');
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', async () => {
        const a = await hashToken('repeat-me');
        const b = await hashToken('repeat-me');
        expect(a).toBe(b);
    });

    it('returns null for non-string or empty inputs', async () => {
        expect(await hashToken('')).toBeNull();
        expect(await hashToken(null)).toBeNull();
        expect(await hashToken(undefined)).toBeNull();
        expect(await hashToken(123)).toBeNull();
    });

    it('produces a different hash for different inputs', async () => {
        const a = await hashToken('one');
        const b = await hashToken('two');
        expect(a).not.toBe(b);
    });
});

describe('timingSafeEqual', () => {
    it('returns true for equal strings', () => {
        expect(timingSafeEqual('abc', 'abc')).toBe(true);
    });

    it('returns false for unequal same-length strings', () => {
        expect(timingSafeEqual('abc', 'abd')).toBe(false);
    });

    it('returns false for strings of different length', () => {
        expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
        expect(timingSafeEqual(null, 'abc')).toBe(false);
        expect(timingSafeEqual('abc', undefined)).toBe(false);
        expect(timingSafeEqual(123, 123)).toBe(false);
    });

    it('returns true for two empty strings (length 0, vacuously equal)', () => {
        // Note: callers must check `length > 0` before relying on the result
        // (see isAuthorisedHost). An attacker cannot reach this with two
        // empty strings because the hostTokenHash is always 64 hex chars.
        expect(timingSafeEqual('', '')).toBe(true);
    });
});

describe('isAuthorisedHost', () => {
    const newRoom = {
        hostPlayerId: 'session_abc',
        hostTokenHash: 'hash_xyz',
    };
    const legacyRoom = {
        hostPlayerId: 'session_abc',
    };

    it('rejects when room is null/undefined', () => {
        expect(isAuthorisedHost(null, 'session_abc', 'hash_xyz')).toBe(false);
        expect(isAuthorisedHost(undefined, 'session_abc', 'hash_xyz')).toBe(false);
    });

    it('rejects when sessionId does not match', () => {
        expect(isAuthorisedHost(newRoom, 'session_other', 'hash_xyz')).toBe(false);
    });

    it('rejects when sessionId is missing', () => {
        expect(isAuthorisedHost(newRoom, undefined, 'hash_xyz')).toBe(false);
    });

    it('rejects new-scheme room with missing token hash', () => {
        expect(isAuthorisedHost(newRoom, 'session_abc', undefined)).toBe(false);
        expect(isAuthorisedHost(newRoom, 'session_abc', '')).toBe(false);
    });

    it('rejects new-scheme room with wrong token hash', () => {
        expect(isAuthorisedHost(newRoom, 'session_abc', 'hash_wrong')).toBe(false);
    });

    it('accepts new-scheme room with matching sessionId AND token hash', () => {
        expect(isAuthorisedHost(newRoom, 'session_abc', 'hash_xyz')).toBe(true);
    });

    it('accepts legacy room with matching sessionId (no token required)', () => {
        expect(isAuthorisedHost(legacyRoom, 'session_abc', undefined)).toBe(true);
        expect(isAuthorisedHost(legacyRoom, 'session_abc', 'irrelevant')).toBe(true);
    });

    it('rejects legacy room with wrong sessionId even if a token is presented', () => {
        expect(isAuthorisedHost(legacyRoom, 'session_other', 'hash_xyz')).toBe(false);
    });
});

describe('projectRoomForClient', () => {
    const room = {
        _id: 'rooms:1',
        roomCode: 'ABC123',
        hostPlayerId: 'session_host',
        hostTokenHash: 'hash_secret',
        status: 'lobby',
        gridSize: 5,
    };

    it('strips hostTokenHash and hostPlayerId from the projection', () => {
        const out = projectRoomForClient(room);
        expect(out).not.toHaveProperty('hostTokenHash');
        expect(out).not.toHaveProperty('hostPlayerId');
    });

    it('keeps non-secret fields', () => {
        const out = projectRoomForClient(room);
        expect(out._id).toBe('rooms:1');
        expect(out.roomCode).toBe('ABC123');
        expect(out.status).toBe('lobby');
        expect(out.gridSize).toBe(5);
    });

    it('sets isHost=true when requestingSessionId matches the host', () => {
        const out = projectRoomForClient(room, 'session_host');
        expect(out.isHost).toBe(true);
    });

    it('sets isHost=false when requestingSessionId is a non-host player', () => {
        const out = projectRoomForClient(room, 'session_other');
        expect(out.isHost).toBe(false);
    });

    it('sets isHost=false when no requestingSessionId is provided', () => {
        const out = projectRoomForClient(room);
        expect(out.isHost).toBe(false);
    });

    it('returns null for null/undefined input', () => {
        expect(projectRoomForClient(null)).toBeNull();
        expect(projectRoomForClient(undefined)).toBeNull();
    });

    it('does NOT leak the raw hostTokenHash under any input', () => {
        const out = projectRoomForClient(room, 'session_host');
        // The hash is sensitive; assert it cannot be reconstructed from the
        // projection by an attacker holding a guessed sessionId.
        const serialised = JSON.stringify(out);
        expect(serialised).not.toContain('hash_secret');
        expect(serialised).not.toContain('session_host');
    });
});

describe('projectPlayersForClient', () => {
    const players = [
        {
            _id: 'players:1',
            sessionId: 'session_a',
            name: 'Alice',
            color: '#FF0000',
            score: 0,
            playerIndex: 0,
        },
        {
            _id: 'players:2',
            sessionId: 'session_b',
            name: 'Bob',
            color: '#0000FF',
            score: 0,
            playerIndex: 1,
        },
    ];

    it('strips sessionId from every player', () => {
        const out = projectPlayersForClient(players);
        for (const player of out) {
            expect(player).not.toHaveProperty('sessionId');
        }
    });

    it('keeps non-secret fields', () => {
        const out = projectPlayersForClient(players);
        expect(out[0]._id).toBe('players:1');
        expect(out[0].name).toBe('Alice');
        expect(out[0].color).toBe('#FF0000');
        expect(out[1].name).toBe('Bob');
    });

    it('sets isYou=true only on the player whose sessionId matches', () => {
        const out = projectPlayersForClient(players, 'session_b');
        expect(out[0].isYou).toBe(false);
        expect(out[1].isYou).toBe(true);
    });

    it('sets isYou=false for everyone when no requestingSessionId is provided', () => {
        const out = projectPlayersForClient(players);
        for (const player of out) {
            expect(player.isYou).toBe(false);
        }
    });

    it('returns an empty array for non-array input', () => {
        expect(projectPlayersForClient(null)).toEqual([]);
        expect(projectPlayersForClient(undefined)).toEqual([]);
        expect(projectPlayersForClient('not-an-array')).toEqual([]);
    });

    it('does NOT leak any sessionId in the serialised output', () => {
        const out = projectPlayersForClient(players, 'session_a');
        const serialised = JSON.stringify(out);
        expect(serialised).not.toContain('session_a');
        expect(serialised).not.toContain('session_b');
    });
});
