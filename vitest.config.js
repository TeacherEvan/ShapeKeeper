import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['**/*.test.js', '**/*.spec.js'],
        exclude: ['node_modules/**', 'tests/e2e/**'],
        globals: true,
    },
});
