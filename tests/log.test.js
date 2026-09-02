/**
 * Tests for convex/log.js: the prod-logging gate.
 *
 * In production, log() should be a no-op unless CONVEX_DEBUG is set.
 * errorLog() is always-on because thrown conditions must surface.
 *
 * The module reads process.env.CONVEX_DEBUG at import time, so each test
 * mutates the env, calls vi.resetModules(), then re-imports the module
 * to pick up the new env value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('convex/log.js debug gate', () => {
    let originalEnv;
    let originalLog;
    let originalWarn;
    let originalError;

    beforeEach(() => {
        originalEnv = process.env.CONVEX_DEBUG;
        originalLog = console.log;
        originalWarn = console.warn;
        originalError = console.error;
        console.log = vi.fn();
        console.warn = vi.fn();
        console.error = vi.fn();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.CONVEX_DEBUG;
        } else {
            process.env.CONVEX_DEBUG = originalEnv;
        }
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        vi.resetModules();
    });

    async function loadFresh() {
        vi.resetModules();
        return import('../convex/log.js');
    }

    it('log() is a no-op when CONVEX_DEBUG is unset', async () => {
        delete process.env.CONVEX_DEBUG;
        const { log } = await loadFresh();
        log('scope', { roomId: 'r1', sessionId: 's1' });
        expect(console.log).not.toHaveBeenCalled();
    });

    it('log() is a no-op when CONVEX_DEBUG is "0"', async () => {
        process.env.CONVEX_DEBUG = '0';
        const { log } = await loadFresh();
        log('scope', { roomId: 'r1' });
        expect(console.log).not.toHaveBeenCalled();
    });

    it('log() is a no-op when CONVEX_DEBUG is "false" (case-insensitive)', async () => {
        process.env.CONVEX_DEBUG = 'False';
        const { log } = await loadFresh();
        log('scope', { roomId: 'r1' });
        expect(console.log).not.toHaveBeenCalled();
    });

    it('log() emits when CONVEX_DEBUG is "1"', async () => {
        process.env.CONVEX_DEBUG = '1';
        const { log } = await loadFresh();
        log('scope', { roomId: 'r1' });
        expect(console.log).toHaveBeenCalledWith('[scope]', { roomId: 'r1' });
    });

    it('log() emits when CONVEX_DEBUG is any truthy non-"0"/"false" value', async () => {
        process.env.CONVEX_DEBUG = 'yes';
        const { log } = await loadFresh();
        log('scope', { roomId: 'r1' });
        expect(console.log).toHaveBeenCalledWith('[scope]', { roomId: 'r1' });
    });

    it('errorLog() is always-on, even when CONVEX_DEBUG is unset', async () => {
        delete process.env.CONVEX_DEBUG;
        const { errorLog } = await loadFresh();
        errorLog('scope', { message: 'boom' });
        expect(console.error).toHaveBeenCalledWith('[scope]', { message: 'boom' });
    });

    it('errorLog() unwraps Error instances to (message, stack)', async () => {
        delete process.env.CONVEX_DEBUG;
        const { errorLog } = await loadFresh();
        const err = new Error('test');
        errorLog('scope', err);
        expect(console.error).toHaveBeenCalledWith('[scope]', 'test', err.stack);
    });

    it('warn() is gated by CONVEX_DEBUG like log()', async () => {
        delete process.env.CONVEX_DEBUG;
        const { warn } = await loadFresh();
        warn('scope', { x: 1 });
        expect(console.warn).not.toHaveBeenCalled();

        process.env.CONVEX_DEBUG = '1';
        const { warn: warnOn } = await loadFresh();
        warnOn('scope', { x: 1 });
        expect(console.warn).toHaveBeenCalledWith('[scope]', { x: 1 });
    });
});
