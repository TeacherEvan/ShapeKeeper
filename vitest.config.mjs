import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
        exclude: [
            'node_modules/**',
            'tests/e2e/**',
            '**/.vercel/output/**',
            'docs/**',
            '.kilo/**',
            'myenv/**',
            'ShapeKeeper/**',
            'playwright-report/**',
            'test-results/**',
        ],
        globals: true,
        setupFiles: ['vitest.setup.js'],
    },
});
