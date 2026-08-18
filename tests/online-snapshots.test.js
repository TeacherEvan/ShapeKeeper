import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    saveOnlineSnapshot,
    getOnlineSnapshot,
    listOnlineSnapshots,
    deleteOnlineSnapshot,
    purgeExpiredOnlineSnapshots,
} from '../local-save-replay.js';
import { TIMING_CONSTANTS } from '../constants.js';

function makeStorage() {
    const map = new Map();
    return {
        _map: map,
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
        get length() {
            return map.size;
        },
        key: (i) => Array.from(map.keys())[i] ?? null,
    };
}

function makeSnapshot(roomId, over = {}) {
    return {
        roomCode: 'XK92L1',
        gridSize: 10,
        lines: ['0,0-0,1'],
        scores: { 1: 6, 2: 4 },
        currentPlayer: 1,
        playerCount: 2,
        status: 'playing',
        ...over,
    };
}

describe('online snapshots (FR-4)', () => {
    let storage;
    let now;
    const NOW = 1_700_000_000_000;
    let realNow;
    beforeEach(() => {
        storage = makeStorage();
        now = NOW;
        realNow = Date.now;
        Date.now = () => NOW; // make saveOnlineSnapshot's savedAt align with injected now
    });
    afterEach(() => {
        Date.now = realNow;
    });

    it('saves and reads back a snapshot', () => {
        expect(saveOnlineSnapshot('room1', makeSnapshot('room1'), storage)).toBe(true);
        const rec = getOnlineSnapshot('room1', storage, now);
        expect(rec).not.toBeNull();
        expect(rec.roomCode).toBe('XK92L1');
        expect(rec.lines).toEqual(['0,0-0,1']);
    });

    it('returns null for an unknown room', () => {
        expect(getOnlineSnapshot('nope', storage, now)).toBeNull();
    });

    it('purges snapshots older than the 48h TTL', () => {
        saveOnlineSnapshot('room1', makeSnapshot('room1'), storage);
        const expiredAt = NOW + TIMING_CONSTANTS.SNAPSHOT_TTL_MS + 1000;
        expect(getOnlineSnapshot('room1', storage, expiredAt)).toBeNull();
        // the expired entry was cleaned up
        expect(storage.getItem(TIMING_CONSTANTS.SNAPSHOT_PREFIX + 'room1')).toBeNull();
    });

    it('hides finished matches', () => {
        saveOnlineSnapshot('room1', makeSnapshot('room1', { status: 'finished' }), storage);
        expect(getOnlineSnapshot('room1', storage, now)).toBeNull();
    });

    it('lists only live, in-progress snapshots', () => {
        saveOnlineSnapshot('room1', makeSnapshot('room1'), storage);
        saveOnlineSnapshot('room2', makeSnapshot('room2'), storage);
        saveOnlineSnapshot('room3', makeSnapshot('room3', { status: 'finished' }), storage);
        const list = listOnlineSnapshots(storage, now);
        expect(list.map((r) => r.roomId).sort()).toEqual(['room1', 'room2']);
    });

    it('deletes a single snapshot', () => {
        saveOnlineSnapshot('room1', makeSnapshot('room1'), storage);
        expect(deleteOnlineSnapshot('room1', storage)).toBe(true);
        expect(getOnlineSnapshot('room1', storage, now)).toBeNull();
    });

    it('purgeExpiredOnlineSnapshots removes only expired entries', () => {
        saveOnlineSnapshot('room1', makeSnapshot('room1'), storage);
        // make room1 look expired by rewriting its savedAt
        storage.setItem(
            TIMING_CONSTANTS.SNAPSHOT_PREFIX + 'room1',
            JSON.stringify({
                ...makeSnapshot('room1'),
                savedAt: NOW - TIMING_CONSTANTS.SNAPSHOT_TTL_MS - 1,
            })
        );
        saveOnlineSnapshot('room2', makeSnapshot('room2'), storage);
        const before = storage._map.size; // raw count, before any filtering
        const removed = purgeExpiredOnlineSnapshots(storage, NOW);
        expect(removed).toBe(1);
        expect(listOnlineSnapshots(storage, NOW).map((r) => r.roomId)).toEqual(['room2']);
    });

    it('uses the configured snapshot prefix', () => {
        expect(TIMING_CONSTANTS.SNAPSHOT_PREFIX).toBe('shapekeeper.online.snapshots.');
    });
});
