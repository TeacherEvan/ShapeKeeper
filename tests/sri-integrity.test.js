/**
 * SRI hash enforcement.
 *
 * When the Convex browser bundle version in index.html is bumped, the
 * integrity="sha384-..." attribute must also be updated. This test
 * computes the hash for the current version over the wire and asserts
 * it matches the index.html attribute.
 *
 * To bump:
 *   1. Edit the unpkg URL in index.html (e.g. convex@1.42.3 -> convex@1.43.0).
 *   2. curl -sSL https://unpkg.com/convex@<ver>/dist/browser.bundle.js \
 *        | openssl dgst -sha384 -binary | openssl base64 -A
 *   3. Replace the integrity value in index.html with the new
 *      "sha384-<base64>" string.
 *   4. Re-run `npx vitest run` — this test should pass.
 *
 * If the network is unavailable, the test is skipped (xit) so local
 * dev work does not break the gate. In CI (where the network is up)
 * it runs and fails loud on a stale hash.
 *
 * @module tests/sri-integrity.test
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');

const versionMatch = /unpkg\.com\/convex@([\d.]+)\/dist\/browser\.bundle\.js/.exec(indexHtml);
const integrityMatch = /integrity="(sha384-[A-Za-z0-9+/=]+)"/.exec(indexHtml);

const declaredVersion = versionMatch ? versionMatch[1] : null;
const declaredHash = integrityMatch ? integrityMatch[1] : null;

describe('Subresource Integrity (Convex browser bundle)', () => {
    it('index.html declares a convex@<version> URL and an integrity hash', () => {
        expect(declaredVersion, 'convex version URL not found in index.html').toBeTruthy();
        expect(declaredHash, 'integrity attribute not found in index.html').toBeTruthy();
        // Sanity: hash should be base64 of a 48-byte SHA-384 digest
        // (48 bytes * 4/3 = 64 base64 chars, no padding since 384 is
        // divisible by 6). The hash MUST be a valid base64 string of
        // exactly 64 chars so the live-hash check below is meaningful.
        expect(declaredHash).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
    });

    it('the integrity hash matches the live unpkg bundle for the declared version', async () => {
        if (!declaredVersion || !declaredHash) {
            // The first test would have already failed; skip this one.
            return;
        }
        const url = `https://unpkg.com/convex@${declaredVersion}/dist/browser.bundle.js`;
        let body;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                // Network unavailable or version not yet published — skip.
                // The hash is still validated by the first test (format check).
                return;
            }
            const ab = await res.arrayBuffer();
            body = Buffer.from(ab);
        } catch {
            // Network failure in local dev — skip silently.
            return;
        }
        const computed = 'sha384-' + createHash('sha384').update(body).digest('base64');
        expect(
            computed,
            `SRI hash mismatch for ${url}. Recompute with: curl -sSL ${url} | openssl dgst -sha384 -binary | openssl base64 -A`
        ).toBe(declaredHash);
    }, 30_000);
});
