# ShapeKeeper Live Lobby + Silly-Passcode Implementation Plan

> **For Claude/Hermes:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static 6-letter room code with a dynamically generated `[Adjective][Animal]` silly passcode (e.g. `EasterPig`, `SillyRabbit`) and ship a real-time live lobby where the host can see players joining live, copy an invite link, and let joiners land in the lobby via `?join=ROOMCODE&passcode=PASSCODE` URL params.

**Architecture:**
- **Server** (Convex): adds a `passcode` column to `rooms`, generates it on `createRoom` from a word-list (50 adjectives × 50 animals = 2500 combos, ~11 bits entropy, collision-checked against live rooms). `joinRoom` requires both `roomCode` + `passcode`.
- **Client** (vanilla JS): the existing `LobbyManager` is upgraded to a `LiveLobbyManager` that subscribes to a Convex query for the room + players list. A new "Copy Invite Link" button calls `navigator.clipboard.writeText` with a URL containing both code and passcode. URL params on load (`?join=…&passcode=…`) auto-fill the join screen.
- **No env file, no static secret, no random letters.** Passcode = silly word combo, generated server-side per room.

**Tech Stack:** Vanilla JS (ES modules), Convex backend (`convex/`), Vitest, ESLint, Vercel static hosting, Playwright (smoke only).

**Effort:** ~3 days | **Surfaces touched:** 1 package (root) | **New tables:** 0 (extend `rooms`) | **Feature flag:** none (lobby already wired; this just upgrades the passcode + adds invite link)

---

## Milestone Timeline

Ship in 4 slices. Each is independently mergeable; nothing is user-visible until slice 4.

### Milestone 1: Server-side silly passcode (Day 1 · AM)

Convex `rooms` schema gains a `passcode` field. `createRoom` generates it from a word-list. `joinRoom` validates it.

- `convex/rooms/shared.ts` — new `generateSillyPasscode()` + word lists
- `convex/schema.ts` — add `passcode: v.string()` + index
- `convex/rooms/mutations.ts` — generate on create, validate on join
- `convex/rooms.ts` — bump `createRoom` and `joinRoom` arg validators

**Gate:** `npx convex dev --once` succeeds; new vitest `passcode.test.ts` proves generation + validation.

### Milestone 2: Live player subscription + URL pre-fill (Day 1 · PM)

`LiveLobbyManager` subscribes to Convex `getRoomState(roomId)` query. New `subscribeToRoom()` returns an unsubscribe function. URL params on load pre-fill the join screen.

- `src/ui/LiveLobbyManager.js` — NEW (replaces the placeholder `LobbyManager` for online use)
- `convex-client.js` — expose `subscribeToRoom(roomId, callback)` and `getJoinParamsFromUrl()`
- `welcome.js` / `index.html` — wire `?join=&passcode=` query params

**Gate:** vitest `live-lobby.test.js` proves subscription + URL parse.

### Milestone 3: Invite-link UI + copy-to-clipboard (Day 2 · AM)

Lobby screen gains a "Copy Invite Link" button next to the room code. Click writes `${location.origin}/?join=${roomCode}&passcode=${passcode}` to the clipboard and shows a toast.

- `index.html` — new button in `.lobby-header`
- `src/ui/menu/eventBindings.js` — bind click handler
- `src/ui/menu/lobbyView.js` — render the link button (only for host, only when `passcode` is known)
- `src/ui/Toast.js` — already supports info/success; reuse

**Gate:** vitest `invite-link.test.js` proves URL composition; Playwright smoke confirms button click → toast.

### Milestone 4: Tests, docs, AGENTS.md, push (Day 2 · PM)

- `tests/passcode.test.js` (NEW): word-list size, collision resistance, format
- `tests/live-lobby.test.js` (NEW): subscription, unsubscribe, URL parse
- `tests/invite-link.test.js` (NEW): URL builder + clipboard fallback
- `tests/e2e/lobby-invite.spec.js` (NEW Playwright): host creates → guest opens link → both see each other
- `README.md` — document the new flow
- `docs/feature-multiplayer.md` — section on lobby + invite
- `AGENTS.md` — NEW: lobby invariants, passcode format, no-env-file rule

**Gate:** all unit + e2e green; AGENTS.md committed.

---

## Data Flow

### Create Room (silly passcode generation)

```
Client (welcome.js)              Convex (createRoom)              Convex DB
  │                                    │                              │
  │── createRoom(playerName, 5) ──────►│                              │
  │                                    │── generateSillyPasscode()    │
  │                                    │   (pick word from 2 lists)   │
  │                                    │── check by_passcode index    │
  │                                    │   (loop until unique)        │
  │                                    │── insert room {code, passcode}│
  │◄── {roomId, roomCode, passcode} ───│                              │
  │                                    │                              │
  │── store in LiveLobbyManager ───────►                              │
  │── subscribeToRoom(roomId) ────────────────────────────────────────►│
  │                                                                     │
  │◄────── realtime: room + players list updates ─────────────────────│
```

### Join via Invite Link

```
Guest browser                  welcome.js              Convex (joinRoom)
  │                                │                          │
  │── load /?join=ABC&passcode=EasterPig                       │
  │── getJoinParamsFromUrl() ──►   │                          │
  │                                │── pre-fill join screen    │
  │── click "Join" ──────────────►│                          │
  │                                │── joinRoom(code, passcode)│
  │                                │─────────────────────────►│
  │                                │                          │── lookup by_code
  │                                │                          │── compare passcode
  │                                │                          │── insert player
  │                                │◄── {roomId, players} ───│
  │                                │── subscribeToRoom        │
  │◄── live player list updates ───│                          │
```

### Realtime Fan-Out (dashed path)

```
Convex DB ──change──► Convex query subscription ──push──► Other clients
  │                                                            │
  │                                                            ▼
  │                                                  LiveLobbyManager.players
  │                                                  → lobbyView.updateLobbyUI()
```

---

## Mockups

### A · Host's Lobby (after create)

```
┌──────────────────────────────────────────────────────────────┐
│  Game Lobby                                       [Leave]    │
│                                                              │
│  Invite friends:                                             │
│   ┌────────────────────────────────────┐  ┌──────────────┐  │
│   │ Code:     ABC123                    │  │  🔗 Copy     │  │
│   │ Passcode: EasterPig                │  │     Link     │  │
│   └────────────────────────────────────┘  └──────────────┘  │
│                                                              │
│  Game Settings                                               │
│   Grid Size:  ( 5x5 )  10x10  20x20  30x30                   │
│                                                              │
│  Players (2/6)                                               │
│   ●  Alice           [Host]  ✓ Ready                         │
│   ●  Bob                    Not Ready                       │
│                                                              │
│  Your Settings                                               │
│   Name: [____________]                                       │
│   Color: [#FF0000]                                           │
│                                                              │
│   [ Ready ]  [ Start Game ]                                  │
└──────────────────────────────────────────────────────────────┘
```

### B · Guest's Join Screen (URL-pre-filled)

```
┌──────────────────────────────────────────────────────────────┐
│  Join Game                                                  │
│                                                              │
│   Room Code:  [ ABC123          ]                           │
│   Passcode:   [ EasterPig        ]                           │
│   Your Name:  [                 ]                           │
│                                                              │
│             [  Join Game  ]                                  │
└──────────────────────────────────────────────────────────────┘
```

### C · Live Update (Bob joins)

```
   Players (3/6)
   ●  Alice           [Host]  ✓ Ready
   ●  Bob                    Not Ready       ◄── appears in realtime
   ●  Charlie               Not Ready       ◄── appears in realtime
```

---

## Passcode Format

- **Pattern:** `[Adjective][Animal]`, TitleCase, no separator, no numbers.
- **Examples:** `EasterPig`, `SillyRabbit`, `BubblyBunny`, `WobblyWombat`, `MightyOtter`.
- **Word lists:** 50 adjectives + 50 animals (one per line, plain JS arrays in `convex/rooms/shared.ts`).
- **Entropy:** log2(50 × 50) ≈ 11 bits. With collision check against the live `by_passcode` index, the practical space is unbounded for a session. If 50×50 fills up (a 2500-room party), we add a second animal for 50×50×50 = 125k combos.
- **Why no numbers:** the user (2026-08-25) explicitly required word-only — `EasterPig`, not `EasterPig42`. Numbers feel sterile and read like a passcode from an env file.
- **Why no human names:** also user-relaxed. Animals + adjectives are sillier and avoid any PII risk.

---

## Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Collision storm if many rooms created | Low | Low | Word lists are 50×50 = 2500; collision loop with `by_passcode` index; if saturated, expand lists |
| Clipboard API blocked (insecure context) | Medium | Low | Fallback: show the URL in a selectable `<input readonly>` with a manual copy hint |
| Stale passcode shown to client on disconnect | Low | Medium | Passcode returned ONLY in `createRoom` response; never re-exposed via queries (security) |
| URL param pre-fill leaks passcode in browser history | Low | Low | Documented in AGENTS.md; recommend private/incognito for shared devices |
| Existing tests assert `roomCode`-only join | High | High | Update them in the same milestone; named explicitly in test file headers |
| Convex schema migration loses live rooms | Low | Critical | Dev-only deploy; production rooms (if any) get the new column as `undefined` → fallback path validates `roomCode` alone when `passcode` is empty (transitional) |

---

## Tasks

### Task 1: Word lists + `generateSillyPasscode()` (TDD)

**Files:**
- Modify: `convex/rooms/shared.ts`
- Create: `convex/rooms/shared.test.ts`

**Step 1: Write failing test**
```ts
// convex/rooms/shared.test.ts
import { generateSillyPasscode, ADJECTIVES, ANIMALS } from './shared';

test('passcode matches [Adjective][Animal] pattern, no numbers', () => {
    const code = generateSillyPasscode();
    expect(code).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
    expect(code).not.toMatch(/\d/);
});

test('passcode parts are from the word lists', () => {
    for (let i = 0; i < 200; i++) {
        const code = generateSillyPasscode();
        const [adj, animal] = [code.slice(0, code.search(/[A-Z]/g).slice(0, 1)?.[0] ?? 0), code]; // simple split at second capital
        const parts = code.split(/(?=[A-Z])/).filter(Boolean);
        expect(parts).toHaveLength(2);
        expect(ADJECTIVES).toContain(parts[0].toLowerCase());
        expect(ANIMALS).toContain(parts[1].toLowerCase());
    }
});

test('word lists are >= 50 each', () => {
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(50);
    expect(ANIMALS.length).toBeGreaterThanOrEqual(50);
});
```

**Step 2: Run, expect FAIL** — `npx vitest run convex/rooms/shared.test.ts`

**Step 3: Implement**
```ts
// convex/rooms/shared.ts
export const ADJECTIVES = [
    'silly', 'bubbly', 'wobbly', 'mighty', 'tiny', 'cosmic', 'crispy', 'dizzy',
    'eager', 'fancy', 'fluffy', 'fuzzy', 'giddy', 'goofy', 'jolly', 'jumpy',
    'lucky', 'mellow', 'nutty', 'perky', 'plucky', 'quirky', 'sassy', 'scruffy',
    'sleepy', 'sneaky', 'spooky', 'squishy', 'stinky', 'sunny', 'tippy', 'wiggly',
    'yappy', 'zany', 'brave', 'clever', 'dapper', 'dashing', 'easter', 'fabled',
    'gentle', 'glorious', 'happy', 'heroic', 'kindly', 'lavish', 'lively', 'merry',
    'noble', 'plump',
];
export const ANIMALS = [
    'pig', 'rabbit', 'wombat', 'otter', 'panda', 'badger', 'beaver', 'bison',
    'bobcat', 'buffalo', 'camel', 'chinchilla', 'cobra', 'crane', 'donkey', 'duck',
    'falcon', 'ferret', 'fox', 'gazelle', 'gecko', 'gorilla', 'hamster', 'hedgehog',
    'hippo', 'hyena', 'iguana', 'jaguar', 'koala', 'lemur', 'leopard', 'llama',
    'meerkat', 'mongoose', 'narwhal', 'ostrich', 'panther', 'pelican', 'pony', 'puffin',
    'python', 'quokka', 'raccoon', 'reindeer', 'sloth', 'snail', 'sparrow', 'squirrel',
    'stingray', 'tapir',
];

export function generateSillyPasscode(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return (adj.charAt(0).toUpperCase() + adj.slice(1))
        + (animal.charAt(0).toUpperCase() + animal.slice(1));
}
```

**Step 4: Run, expect PASS**

**Step 5: Commit** — `git add convex/rooms/shared.ts convex/rooms/shared.test.ts && git commit -m "feat(lobby): silly Adjective+Animal passcode generator"`

### Task 2: Schema + createRoom + joinRoom

**Files:**
- Modify: `convex/schema.ts`, `convex/rooms/mutations.ts`, `convex/rooms.ts`
- Create: `convex/rooms/lobby.test.ts`

**Step 1: Write failing test** (uses convex-test or a hand-rolled mock per the existing test pattern — check `convex-client.test.js` style)

**Step 2: Run, expect FAIL**

**Step 3: Implement**
- Add `passcode: v.string()` to `rooms` table; add `.index('by_passcode', ['passcode'])`
- `createRoom` calls `generateSillyPasscode()`, collision-checks against `by_passcode` index
- `joinRoom` accepts `passcode: v.string()` arg, looks up by `by_code`, validates `passcode` matches

**Step 4: Run, expect PASS**

**Step 5: Commit** — `git commit -m "feat(lobby): passcode column + validated join"`

### Task 3: LiveLobbyManager + subscribeToRoom

**Files:**
- Create: `src/ui/LiveLobbyManager.js`, `src/ui/LiveLobbyManager.test.js`
- Modify: `convex-client.js`, `convex-client.test.js`

(Follows the same Vitest pattern as `convex-client.test.js`.)

**Commit:** `git commit -m "feat(lobby): LiveLobbyManager with realtime subscription"`

### Task 4: URL pre-fill + invite-link UI

**Files:**
- Modify: `src/ui/menu/eventBindings.js`, `src/ui/menu/lobbyView.js`, `index.html`, `welcome.js`
- Create: `tests/invite-link.test.js`

**Commit:** `git commit -m "feat(lobby): URL pre-fill + copy-invite-link button"`

### Task 5: E2E smoke (Playwright) + docs + AGENTS.md

**Files:**
- Create: `tests/e2e/lobby-invite.spec.js`
- Modify: `README.md`, `docs/feature-multiplayer.md`
- Create: `AGENTS.md`

**Commit:** `git commit -m "docs(lobby): README + feature doc + AGENTS.md invariants"`

### Task 6: Quality gates + push

- `npm run lint && npx convex typecheck && npm test`
- `git push -u origin feat/live-lobby-silly-passcode`
- Open PR against `main`

---

## Verify Visual & Transform Claims (n/a)

No 3D / animation / CSS in this slice. UI is plain DOM.

## Verify External / Library / Package Facts

- Convex `mutation`/`query` arg shape — verified against existing `convex/rooms.ts` patterns
- `navigator.clipboard.writeText` — standard browser API; fallback path uses a readonly `<input>` + `select()`

## Detect Live Sidecar Processes (preflight)

Before writing any file under `convex/_generated/`, run:
```bash
ps -ef | grep -E "convex" | grep -v grep
```
If `npx convex dev` is running, kill it before any schema change; restart after the migration.

## Detect Pre-Existing Draft Plans

`docs/plans/` searched. Existing plans (`2026-08-25-*`) are unrelated (UI overhaul, etc.). This plan is fresh.

## Mandatory Skill Header — present above ✓

**Goal · Architecture · Tech Stack · Effort / Surfaces / New tables / Feature flag** — all in the header.
**Milestone Timeline · Data Flow · Mockups · Risk Table** — all present.
**TDD bite-sized tasks** — Task 1 shown in full as the template.
