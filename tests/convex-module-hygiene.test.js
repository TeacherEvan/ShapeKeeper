import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd(), 'convex');
const SKIP = new Set(['_generated', 'node_modules']);

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        if (SKIP.has(name)) return [];
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}
const files = walk(ROOT);
const sources = files.filter((f) => /\.(ts|js)$/.test(f));

describe('convex module hygiene', () => {
    it('uses only [A-Za-z0-9_.] in every path segment (Convex rule)', () => {
        const bad = files
            .map((f) => relative(ROOT, f))
            .filter((rel) => rel.split('/').some((seg) => !/^[A-Za-z0-9_.]+$/.test(seg)));
        expect(bad).toEqual([]);
    });

    it('resolves every relative import', () => {
        const re = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
        const missing = [];
        for (const file of sources) {
            const text = readFileSync(file, 'utf8');
            for (const m of text.matchAll(re)) {
                const base = resolve(dirname(file), m[1]);
                const candidates = [
                    base,
                    `${base}.ts`,
                    `${base}.js`,
                    `${base}.tsx`,
                    join(base, 'index.ts'),
                    join(base, 'index.js'),
                    base.replace(/\.js$/, '.ts'),
                ];
                if (!candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
                    missing.push(`${relative(ROOT, file)} -> ${m[1]}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});
