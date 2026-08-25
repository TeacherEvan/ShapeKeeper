/**
 * LiveLobbyManager unit tests — pure JS, no Convex.
 *
 * The LiveLobbyManager is a state holder + URL helper. It receives snapshots
 * from a Convex subscription (mocked here) and exposes a small surface for
 * the lobby UI to read from.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiveLobbyManager, getJoinParamsFromUrl } from './LiveLobbyManager.js';

describe('LiveLobbyManager — initial state', () => {
    it('starts in idle with no room/passcode/players', () => {
        const m = new LiveLobbyManager();
        expect(m.status).toBe('idle');
        expect(m.roomCode).toBeNull();
        expect(m.passcode).toBeNull();
        expect(m.players).toEqual([]);
        expect(m.isHost).toBe(false);
    });
});

describe('LiveLobbyManager — applySnapshot', () => {
    let m;
    beforeEach(() => {
        m = new LiveLobbyManager();
    });

    it('applies room fields and stores passcode', () => {
        m.applySnapshot({
            room: { _id: 'r1', roomCode: 'ABC123', passcode: 'EasterPig', hostPlayerId: 's1', gridSize: 10, status: 'lobby' },
            players: [],
        });
        expect(m.roomId).toBe('r1');
        expect(m.roomCode).toBe('ABC123');
        expect(m.passcode).toBe('EasterPig');
        expect(m.hostSessionId).toBe('s1');
        expect(m.gridSize).toBe(10);
        expect(m.status).toBe('lobby');
    });

    it('sorts players by playerIndex and marks the host', () => {
        m.setMySessionId('s1');
        m.applySnapshot({
            room: { _id: 'r1', hostPlayerId: 's2', status: 'lobby' },
            players: [
                { sessionId: 's3', name: 'Charlie', color: '#00FF00', isReady: false, isConnected: true, playerIndex: 2 },
                { sessionId: 's1', name: 'Alice', color: '#FF0000', isReady: true, isConnected: true, playerIndex: 0 },
                { sessionId: 's2', name: 'Bob', color: '#0000FF', isReady: false, isConnected: true, playerIndex: 1 },
            ],
        });
        expect(m.players.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Charlie']);
        expect(m.players.find((p) => p.sessionId === 's2').isHost).toBe(true);
        // me is the host? no — me is s1, host is s2
        expect(m.isHost).toBe(false);
    });

    it('marks me as host when my sessionId matches hostPlayerId', () => {
        m.setMySessionId('s1');
        m.applySnapshot({
            room: { hostPlayerId: 's1' },
            players: [{ sessionId: 's1', name: 'Me', isHost: true, playerIndex: 0 }],
        });
        expect(m.isHost).toBe(true);
    });

    it('handles a legacy room without passcode (backward compat)', () => {
        m.applySnapshot({
            room: { _id: 'r1', roomCode: 'XYZ789' /* no passcode */ },
            players: [],
        });
        expect(m.passcode).toBeNull();
        expect(m.roomCode).toBe('XYZ789');
    });
});

describe('LiveLobbyManager — subscription lifecycle', () => {
    it('attachSubscription stores the unsubscribe fn', () => {
        const m = new LiveLobbyManager();
        const fn = vi.fn();
        m.attachSubscription(fn);
        m.detachSubscription();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('detachSubscription is idempotent', () => {
        const m = new LiveLobbyManager();
        const fn = vi.fn();
        m.attachSubscription(fn);
        m.detachSubscription();
        m.detachSubscription();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('detachSubscription swallows a throwing unsubscribe (logged warning)', () => {
        const m = new LiveLobbyManager();
        m.attachSubscription(() => {
            throw new Error('boom');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => m.detachSubscription()).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('LiveLobbyManager — buildInviteUrl', () => {
    it('returns null when roomCode is missing', () => {
        const m = new LiveLobbyManager();
        expect(m.buildInviteUrl({ base: 'https://example.com' })).toBeNull();
    });

    it('builds a URL with both code and passcode when present', () => {
        const m = new LiveLobbyManager();
        m.roomCode = 'ABC123';
        m.passcode = 'EasterPig';
        const url = m.buildInviteUrl({ base: 'https://example.com' });
        expect(url).toBe('https://example.com/?join=ABC123&passcode=EasterPig');
    });

    it('builds a URL with only the code for legacy rooms', () => {
        const m = new LiveLobbyManager();
        m.roomCode = 'ABC123';
        const url = m.buildInviteUrl({ base: 'https://example.com' });
        expect(url).toBe('https://example.com/?join=ABC123');
    });

    it('strips a trailing slash from the base', () => {
        const m = new LiveLobbyManager();
        m.roomCode = 'ABC123';
        m.passcode = 'SillyRabbit';
        const url = m.buildInviteUrl({ base: 'https://example.com/' });
        expect(url).toBe('https://example.com/?join=ABC123&passcode=SillyRabbit');
    });
});

describe('LiveLobbyManager — canStartGame', () => {
    it('host with 1 player cannot start (need at least 2)', () => {
        const m = new LiveLobbyManager();
        m.isHost = true;
        m.players = [{ isReady: true }];
        expect(m.canStartGame()).toBe(false);
    });

    it('host with 2+ ready players can start', () => {
        const m = new LiveLobbyManager();
        m.isHost = true;
        m.players = [{ isReady: true }, { isReady: true }];
        expect(m.canStartGame()).toBe(true);
    });

    it('host with 2+ players but one not ready cannot start', () => {
        const m = new LiveLobbyManager();
        m.isHost = true;
        m.players = [{ isReady: true }, { isReady: false }];
        expect(m.canStartGame()).toBe(false);
    });

    it('non-host can never start', () => {
        const m = new LiveLobbyManager();
        m.isHost = false;
        m.players = [{ isReady: true }, { isReady: true }];
        expect(m.canStartGame()).toBe(false);
    });
});

describe('getJoinParamsFromUrl', () => {
    it('returns null when no ?join param', () => {
        expect(getJoinParamsFromUrl('')).toBeNull();
        expect(getJoinParamsFromUrl('?foo=bar')).toBeNull();
    });

    it('returns {roomCode} when only ?join is set', () => {
        expect(getJoinParamsFromUrl('?join=ABC123')).toEqual({ roomCode: 'ABC123', passcode: null });
    });

    it('returns {roomCode, passcode} when both set', () => {
        expect(getJoinParamsFromUrl('?join=ABC123&passcode=EasterPig')).toEqual({
            roomCode: 'ABC123',
            passcode: 'EasterPig',
        });
    });

    it('uppercases the room code (matches Convex by_code index behavior)', () => {
        expect(getJoinParamsFromUrl('?join=abc123&passcode=easterpig')).toEqual({
            roomCode: 'ABC123',
            passcode: 'easterpig',
        });
    });

    it('accepts the leading-? or not', () => {
        expect(getJoinParamsFromUrl('join=ABC123&passcode=EasterPig')).toEqual({
            roomCode: 'ABC123',
            passcode: 'EasterPig',
        });
    });
});
