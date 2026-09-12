# AGENTS.md — ShapeKeeper

Browser-based Dots and Boxes game (ShapeKeeper), turn-based multiplayer via Convex, static frontend on Vercel (`shape-keeper.vercel.app`). Pure vanilla JS, no framework. Version: 4.3.0.

## Dev environment

- Node 22 (CI: `actions/setup-node@v4`, `node-version: '22'`). No `.nvmrc` in repo.
- **`npm ci` is required first.** This checkout is missing `node_modules`, so `npm run lint`, `npm run test`, and other CLIs error with "not found" until deps are installed.
- `.env.local` (`CONVEX_DEPLOYMENT` / `CONVEX_DEPLOY_KEY`) is for the local dev backend only (`oceanic-antelope-781`).
- Prod frontend is wired to prod Convex (`precise-ladybug-504.convex.cloud`) via `config.js` — no build step. Override with a separate script setting `window.CONVEX_URL` loaded BEFORE `config.js`.
- `file://` does not work: the app boots as browser ES modules. Serve over HTTP.

## Build, test, lint

Run everything from repo root (where `package.json` and `convex/` live).

| Command | What it does |
| --- | --- |
| `npm run dev` | `convex dev` — local Convex dev backend |
| `npm run serve` | `python -m http.server 8000` |
| `npm run start` | `npx http-server -p 8000 -o` |
| `npm run verify` | `npx convex typecheck` + `node -c` syntax checks on `game.js`, `welcome.js`, `convex-client.js` |
| `npm run lint` | `eslint .` (flat config `eslint.config.mjs` + compat from `.eslintrc.json`) |
| `npm run lint:fix` | `eslint . --fix` |
| `npm run format` | `prettier --write .` (`.prettierrc`: semi, singleQuote, tabWidth 4, printWidth 100, trailingComma es5) |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run test:e2e` | `playwright test` — full suite under `tests/e2e/` |
| `npm run test:e2e:smoke` | `playwright test tests/e2e/smoke.spec.js --project=chromium` |
| `npm run test:e2e:startup` | `playwright test tests/e2e/loading-state.spec.js --project=chromium` |
| `npm run test:e2e:multiplayer` | `playwright test tests/e2e/multiplayer-startup.spec.js --project=chromium` |
| `npm run test:e2e:reconnect` | `playwright test tests/e2e/reconnect.spec.js --project=chromium` |
| `npm run test:e2e:reliability` | `playwright test tests/e2e/multiplayer-sync.spec.js tests/e2e/reconnect.spec.js --project=chromium` |
| `npm run test:e2e:compat` | Playwright compat matrix: firefox / webkit / mobile-chrome / mobile-safari / tablet-safari |
| `npm run deploy` | `npx convex deploy --yes` |
| `npm run deploy:prod` | `npx convex deploy --cmd-url-env-var-name CONVEX_URL --yes` |

**Verified state on this checkout:**

- `npm run verify` currently **fails** at `npx convex typecheck`: resolution errors for `convex/values` (in `convex/rooms.ts`, `convex/games.ts`) and `convex/server` (in `convex/_generated/server.js`). This appears to be an environment / `npx` vs installed-package issue, not a repo-file defect — the same commands pass in CI.
- `npm run lint` and `npm run test` both fail here until `npm ci` has run.
- CI (`.github/workflows/ci.yml`) only gates on `npm run lint` + `npm run test`. E2E is intentionally **not** in the required gate because it needs a live Convex backend.

**Vitest specifics:**

- Config: `vitest.config.mjs`. `environment: 'jsdom'`, `globals: true`.
- Includes `**/*.test.js` AND `**/*.spec.js` (not just top-level `*.test.js` — there are `*.spec.js` files across the repo and under `tests/`).
- Excludes `node_modules/**`, `tests/e2e/**`, `**/.vercel/output/**`.

**Playwright specifics:**

- Config: `playwright.config.js`. Default base URL `http://127.0.0.1:9323`; override via `PLAYWRIGHT_BASE_URL`.
- Auto-starts `npx http-server . -p 9323 -a 127.0.0.1 -c-1 --silent` when `PLAYWRIGHT_BASE_URL` is unset and not CI.
- `chromium` project runs all specs; compat projects (`firefox-compat`, `webkit-compat`, `mobile-chrome-compat`, `mobile-safari-compat`, `tablet-safari-compat`) only run `compatibilitySpecPatterns` (smoke, local-gameplay, loading-state, browser-compatibility, settings-and-theme, achievement-panel, local-setup, winner-screen).
- E2E requires a live Convex backend reachable at base URL. Install browsers with `npx playwright install --with-deps`.

## Conventions

- ES6+ JS throughout. `const`/`let`, arrow functions, classes (PascalCase). Variables/functions `camelCase`; classes `PascalCase`.
- `game.js` and `welcome.js` are the authoritative browser-module entry points. `convex-client.js` is loaded as a classic script so it can attach `window.ShapeKeeperConvex`.
- `convex-client.js` is a thin bootstrap. The real Convex client logic lives in `convex-client/` as per-file IIFEs: `shared.js`, `room-operations.js`, `game-operations.js`, `subscriptions.js`.
- `dots-and-boxes-game.js` is the main `DotsAndBoxesGame` class. Other top-level modules include `game.js`, `welcome.js`, `config.js`, `constants.js`, `input-handler.js`, `game-state.js`, `game-logic.js`, `renderer.js`, `particle-system.js`, `effect-system.js`, `sound-manager.js`, `animation-system.js`, `tutorial-system.js`, `local-save-replay.js`, `achievement-system.js`, plus `src/` submodules under `core/`, `game/`, `effects/`, `animations/`, `sound/`, `ui/`.
- `convex/` backend: `schema.ts`, `rooms.ts`, `games.ts`, `log.js`, `tsconfig.json`, plus `auth/`, `rooms/`, `games/`, `_generated/`.
- Convex client modules use an IIFE pattern closing over `window`. `shared.js` owns connection/session state; `room-operations.js` and `game-operations.js` expose the `window.ShapeKeeperConvex.*` API surface.
- Line keys are normalized, sorted strings: `'1,2-1,3'` (horizontal), `'1,2-2,2'` (vertical), `'1,1-2,2'` (diagonal). Square keys: `'row,col'`. Grid is 0-indexed rows/cols, origin top-left.
- `jsconfig.json`: `target ES2022`, `module Node16`, `moduleResolution node16`, `lib ES2022 + DOM`, `checkJs false`, `noEmit true`. Include `*.js` + `**/*.js`, exclude `node_modules`. The README calls VSCode parse errors "cosmetic" — this config is why.
- `.gitignore` excludes `node_modules/`, `dist/`, `build/`, `.env*`, `.vercel`, `convex/.env*`, `playwright-report/`, `test-results/`, plus dev/AI scratch files: `bench.mjs`, `play-ai-medium.mjs`, `ai-diagnose.mjs`, `ai_*.mjs`, `ai_*.json`, `ai_*.png`, `*.prune/`, `docs/.scratch-audit/`. Do not hand-edit generated/scratch artifacts in those paths.
- ESLint: `no-unused-vars` is `warn` (ignores `_`-prefixed names), `no-console` is off. Ignores `dist`, `node_modules`, `.vercel/output`, and several `ai_*` bench/diagnose files.

## Security headers (`vercel.json`)

Production deploy ships strict headers:

- CSP: `default-src 'self'`; `script-src 'self' https://unpkg.com`; `style-src 'self' https://fonts.googleapis.com 'unsafe-inline'`; `font-src 'self' https://fonts.gstatic.com`; `img-src 'self' data:`; `connect-src 'self' https://precise-ladybug-504.convex.cloud https://*.convex.cloud wss://*.convex.cloud https://fonts.googleapis.com https://fonts.gstatic.com`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `upgrade-insecure-requests`. No `unsafe-inline` for script-src.
- SRI on the Convex browser bundle from `unpkg.com/convex@1.42.3`. If version changes, regenerate the hash:
  `curl -sSL https://unpkg.com/convex@<ver>/dist/browser.bundle.js | openssl dgst -sha384 -binary | openssl base64 -A`
  and update the `integrity` attribute in `index.html`.
- HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`.
- Cache-Control: HTML files `public, max-age=0, must-revalidate`; `config.js` `public, max-age=300, must-revalidate`.

## Pitfalls

- `file://` is not a supported startup path — ES modules require HTTP. Use `npm run serve`, `npm run dev`, or `npm run start`.
- **Run `npm ci` before lint/test/verify here.** `node_modules` is not present in this checkout; the npm scripts error with "not found" without it.
- **Expect `npm run verify` to fail on `npx convex typecheck` in this environment** (`convex/values` + `convex/server` resolution errors). CI passes the same check; this is an env/install issue, not a repo-file defect.
- `npx convex typecheck` is the thing that breaks, not `node -c`. If you only need JS syntax checks, `node -c game.js`, `node -c welcome.js`, `node -c convex-client.js` are the lightweight fallback.
- E2E tests fail without a reachable Convex backend. They are not in required CI for this reason.
- Deployment commands must run from repo root (where `package.json` and `convex/` live). Running `vercel` / `convex` from elsewhere deploys/fails incorrectly.
- `.env.local` is dev-backend only. Prod is configured via `config.js` + a `window.CONVEX_URL` override script loaded before `config.js`.
- Large grids (50×50+) can hurt performance on older devices (README lists this as a known limitation).
- `convex-client.js` and `convex-client/` are separate. Don't edit one and assume the other is the same file.
