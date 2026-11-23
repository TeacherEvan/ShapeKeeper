import { describe, expect, it, vi } from 'vitest';

const registered: Array<{ name: string; schedule: unknown }> = [];

vi.mock(import('convex/server'), async (importOriginal) => {
    const actual = await importOriginal<typeof import('convex/server')>();
    return {
        ...actual,
        cronJobs: (() => ({
            interval: (name: string, schedule: unknown) => {
                registered.push({ name, schedule });
            },
        })) as any,
    } as any;
});

describe('turn deadline cron registration', () => {
    it('does not register a sub-minute sweep that re-enqueues expireTurn', async () => {
        await import('./crons');

        const sweeps = registered.filter((job) => job.name === 'sweep-turn-deadlines');
        expect(sweeps).toHaveLength(0);
    });
});
