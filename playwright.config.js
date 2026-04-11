import { defineConfig, devices } from '@playwright/test';

const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:9323';
const compatibilitySpecPatterns = [
    '**/smoke.spec.js',
    '**/local-gameplay.spec.js',
    '**/loading-state.spec.js',
    '**/browser-compatibility.spec.js',
];

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: defaultBaseUrl,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox-compat',
            testMatch: compatibilitySpecPatterns,
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit-compat',
            testMatch: compatibilitySpecPatterns,
            use: { ...devices['Desktop Safari'] },
        },
        {
            name: 'mobile-chrome-compat',
            testMatch: compatibilitySpecPatterns,
            use: { ...devices['Pixel 7'] },
        },
        {
            name: 'mobile-safari-compat',
            testMatch: compatibilitySpecPatterns,
            use: { ...devices['iPhone 13'] },
        },
        {
            name: 'tablet-safari-compat',
            testMatch: compatibilitySpecPatterns,
            use: { ...devices['iPad Pro 11'] },
        },
    ],
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: 'npx http-server . -p 9323 -a 127.0.0.1 -c-1 --silent',
              url: defaultBaseUrl,
              reuseExistingServer: !process.env.CI,
              timeout: 120000,
          },
});
