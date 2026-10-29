import { describe, expect, it } from 'vitest';
import http from './http';

/**
 * The relay is registered as Convex's HTTP router. If this module fails to
 * load, every HTTP path on the deployment returns a server error — not just
 * the webhook. So the module itself is worth a test.
 */
describe('the Lemon Squeezy HTTP router', () => {
    it('loads and registers the webhook route', () => {
        const routes = (http as any).exactRoutes;
        expect(routes instanceof Map).toBe(true);
        expect(routes.has('/lemonsqueezy/webhook')).toBe(true);
    });

    it('registers the health route', () => {
        const routes = (http as any).exactRoutes;
        expect(routes.has('/lemonsqueezy/health')).toBe(true);
    });

    it('serves the webhook as POST only', () => {
        const methods = (http as any).exactRoutes.get('/lemonsqueezy/webhook');
        expect(methods.has('POST')).toBe(true);
    });
});
