#!/usr/bin/env node
// Injects the deployment-specific Convex URL into the built index.html.
// Convex static-site pattern: no bundler, so we replace a placeholder token
// with process.env.CONVEX_URL (set by Vercel project env at build time).
//
// IMPORTANT: we write ONLY to the Vercel build output (static/index.html),
// never back to the source index.html — so the committed template keeps its
// %%CONVEX_URL%% placeholder and stays environment-agnostic.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sourceHtml = join(root, 'index.html');

const fallback = 'https://oceanic-antelope-781.convex.cloud';
const url =
    process.env.CONVEX_URL && process.env.CONVEX_URL.startsWith('http')
        ? process.env.CONVEX_URL
        : fallback;

// Vercel writes build output here when buildCommand is set.
const outDir = join(root, '.vercel', 'output', 'static');

// Ensure the output dir and copy ALL static assets (Vercel serves from here).
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Copy every source file into the output dir so nothing is missing.
import { readdirSync, statSync } from 'node:fs';
for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.vercel' || entry === 'scripts' || entry.startsWith('.')) continue;
    const src = join(root, entry);
    if (statSync(src).isDirectory()) continue;
    copyFileSync(src, join(outDir, entry));
}

// Now inject the URL into the copied index.html (source stays untouched).
const html = readFileSync(sourceHtml, 'utf8');
if (html.includes('%%CONVEX_URL%%')) {
    writeFileSync(join(outDir, 'index.html'), html.replaceAll('%%CONVEX_URL%%', url));
    console.log(`[inject-convex-url] wrote CONVEX_URL = ${url} into build output`);
} else {
    console.warn('[inject-convex-url] placeholder %%CONVEX_URL%% not found in source; copying as-is');
    copyFileSync(sourceHtml, join(outDir, 'index.html'));
}
