import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('.vercelignore deploy hygiene (P1-14)', () => {
    const ignoreLines = fs
        .readFileSync(path.join(ROOT, '.vercelignore'), 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));

    it('excludes the 8MB media/ directory and scratch tooling from Vercel uploads', () => {
        expect(ignoreLines).toContain('media/');
        expect(ignoreLines).toContain('tests/');
        expect(ignoreLines).toContain('docs/');
    });

    it('never excludes any local script, stylesheet, or image referenced by HTML entrypoints', () => {
        const htmlFiles = ['index.html', 'checkout.html', 'donate.html'];
        const assetRegex = /(?:src|href)="([^"]+)"/g;
        const ignoredPrefixes = ignoreLines
            .filter((l) => l.endsWith('/'))
            .map((l) => l.replace(/^\//, ''));

        for (const htmlFile of htmlFiles) {
            const fullPath = path.join(ROOT, htmlFile);
            if (!fs.existsSync(fullPath)) continue;
            const html = fs.readFileSync(fullPath, 'utf8');
            let match;
            while ((match = assetRegex.exec(html)) !== null) {
                const ref = match[1];
                if (
                    ref.startsWith('http://') ||
                    ref.startsWith('https://') ||
                    ref.startsWith('#') ||
                    ref.startsWith('data:') ||
                    ref.startsWith('mailto:')
                ) {
                    continue;
                }
                const normalized = ref.split('?')[0].replace(/^\.?\//, '');
                if (!normalized) continue;
                for (const prefix of ignoredPrefixes) {
                    expect(
                        normalized.startsWith(prefix),
                        `${htmlFile} references ${normalized} which is excluded by ${prefix}`
                    ).toBe(false);
                }
            }
        }
    });
});
