/**
 * Lobby event bindings.
 * Wires room creation/joining, the open-lobby browser, invite links, and the
 * lobby UI controls (grid size, turn duration, player name/color, ready).
 *
 * Module-private state:
 *   - openLobbiesCleanup  teardown fn for the live open-lobbies subscription
 *   - turnDurationDebounceTimer  debounce for the lobby turn-duration input
 */

import { showScreen } from '../ScreenTransition.js';
import { showToast } from '../Toast.js';

let openLobbiesCleanup = null;
let turnDurationDebounceTimer = null;

function stopOpenLobbiesSubscription() {
    openLobbiesCleanup?.();
    openLobbiesCleanup = null;
}

const STORAGE_KEY_NAME = 'shapekeeper.playerName';

function getStoredPlayerName() {
    try {
        return (
            (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_NAME)) || ''
        );
    } catch {
        return '';
    }
}

function setStoredPlayerName(name) {
    try {
        if (typeof localStorage !== 'undefined' && name) {
            localStorage.setItem(STORAGE_KEY_NAME, name);
        }
    } catch {
        // Ignore localStorage quota or access errors
    }
}

function getBrowserPlayerName() {
    const input = document.getElementById('browserPlayerName');
    return input?.value.trim() || getStoredPlayerName() || 'Player';
}

export function bindLobbyEvents(deps) {
    const { getState, setStartupState, STARTUP_STATES, subscribeToRoomUpdates, updateLobbyUI } =
        deps;

    // Initialize player name inputs if stored
    const initialName = getStoredPlayerName();
    const lobbyPlayerNameInput = document.getElementById('playerName');
    const browserPlayerNameInput = document.getElementById('browserPlayerName');
    if (initialName) {
        if (lobbyPlayerNameInput && !lobbyPlayerNameInput.value) {
            lobbyPlayerNameInput.value = initialName;
        }
        if (browserPlayerNameInput && !browserPlayerNameInput.value) {
            browserPlayerNameInput.value = initialName;
        }
    }

    browserPlayerNameInput?.addEventListener('input', (event) => {
        const val = event.target.value.trim();
        if (val) {
            setStoredPlayerName(val);
        }
    });

    document.getElementById('createGameBtn').addEventListener('click', async () => {
        const { lobbyManager } = getState();
        const playerNameInput = document.getElementById('playerName');
        const playerName = playerNameInput?.value.trim() || getStoredPlayerName() || 'Host';
        setStoredPlayerName(playerName);
        if (playerNameInput) playerNameInput.value = playerName;
        const gridSize = lobbyManager.gridSize || 5;

        if (window.ShapeKeeperConvex) {
            setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
            showToast('Creating room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.createRoom(playerName, gridSize, false);

            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            subscribeToRoomUpdates();
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

            lobbyManager.roomCode = result.roomCode;
            lobbyManager.isHost = true;
            if (result.passcode) {
                lobbyManager.setIdentity({ passcode: result.passcode });
            }
            showToast('Lobby created', 'success', 4000);
        } else {
            lobbyManager.createRoom(playerName);
        }

        updateLobbyUI();
        showScreen('lobbyScreen');
    });

    document.getElementById('joinGameBtn').addEventListener('click', () => {
        const browserInput = document.getElementById('browserPlayerName');
        if (browserInput && !browserInput.value) {
            browserInput.value = getStoredPlayerName() || '';
        }
        showScreen('lobbyBrowserScreen');

        // Live list of open lobbies — no room codes, no passcodes.
        stopOpenLobbiesSubscription();
        if (window.ShapeKeeperConvex?.subscribeToOpenLobbies) {
            openLobbiesCleanup =
                window.ShapeKeeperConvex.subscribeToOpenLobbies(renderOpenLobbies) || null;
        } else {
            renderOpenLobbies([]);
        }
    });

    function renderOpenLobbies(lobbies) {
        const list = document.getElementById('openLobbiesList');
        const emptyState = document.getElementById('openLobbiesEmpty');
        if (!list) return;

        list.replaceChildren();

        if (!lobbies || lobbies.length === 0) {
            if (emptyState) emptyState.hidden = false;
            return;
        }
        if (emptyState) emptyState.hidden = true;

        lobbies.forEach((lobby) => {
            const entry = document.createElement('button');
            entry.type = 'button';
            entry.className = 'lobby-entry';
            entry.dataset.testid = 'open-lobby-entry';
            entry.dataset.roomCode = lobby.roomCode;

            const host = document.createElement('span');
            host.className = 'lobby-entry-host';
            host.textContent = `${lobby.hostName}'s lobby`;

            const meta = document.createElement('span');
            meta.className = 'lobby-entry-meta';
            const timerLabel =
                lobby.turnDurationSeconds > 0 ? ` · ${lobby.turnDurationSeconds}s/turn` : '';
            meta.textContent = `${lobby.playerCount}/${lobby.maxPlayers} players · ${lobby.gridSize}x${lobby.gridSize}${timerLabel}`;

            entry.append(host, meta);
            entry.addEventListener('click', () => {
                joinLobbyByCode(lobby.roomCode, getBrowserPlayerName());
            });
            list.appendChild(entry);
        });
    }

    let playerUpdateDebounceTimer = null;

    /**
     * Join a specific lobby by its (internal) room code. Used by the lobby
     * browser entries and the ?join= deep link.
     */
    async function joinLobbyByCode(roomCode, playerName, passcode = '') {
        const { lobbyManager } = getState();

        if (!window.ShapeKeeperConvex) {
            showToast('Multiplayer mode requires backend integration.', 'info', 5000);
            return;
        }

        const effectiveName = playerName?.trim() || getStoredPlayerName() || 'Player';
        setStoredPlayerName(effectiveName);
        const lobbyPlayerNameInput = document.getElementById('playerName');
        if (lobbyPlayerNameInput) lobbyPlayerNameInput.value = effectiveName;

        setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
        showToast('Joining lobby...', 'info', 2000);
        const result = await window.ShapeKeeperConvex.joinRoom(roomCode, effectiveName, passcode);

        if (result.error) {
            showToast('Error: ' + result.error, 'error');
            return;
        }
        if (!result.roomId) {
            showToast('Could not join that lobby.', 'error');
            return;
        }

        stopOpenLobbiesSubscription();
        subscribeToRoomUpdates();
        setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

        lobbyManager.roomCode = roomCode.toUpperCase();
        if (passcode) lobbyManager.setIdentity({ passcode });
        lobbyManager.isHost = false;
        showToast('Joined lobby', 'success', 3000);
        updateLobbyUI();
        showScreen('lobbyScreen');
    }

    document.getElementById('backToMenuFromBrowser')?.addEventListener('click', () => {
        stopOpenLobbiesSubscription();
        showScreen('mainMenuScreen');
    });

    document.getElementById('refreshLobbiesBtn')?.addEventListener('click', () => {
        // Re-subscribe for an immediate redelivery of the current list.
        stopOpenLobbiesSubscription();
        if (window.ShapeKeeperConvex?.subscribeToOpenLobbies) {
            openLobbiesCleanup =
                window.ShapeKeeperConvex.subscribeToOpenLobbies(renderOpenLobbies) || null;
        } else {
            renderOpenLobbies([]);
        }
    });

    // Invite-link deep link (?join=CODE): welcome.js dispatches this once the
    // app is initialized; join that lobby directly, bypassing the browser.
    window.addEventListener('shapekeeper:joinFromUrl', (event) => {
        const { roomCode, passcode } = event.detail || {};
        if (!roomCode) return;
        const storedName = getStoredPlayerName() || 'Player';
        joinLobbyByCode(roomCode, storedName, passcode || '');
    });

    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const { lobbyManager } = getState();
            if (!lobbyManager.isHost) return;

            const newSize = parseInt(btn.dataset.size);

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updateGridSize(newSize);
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                }
                return;
            }

            document
                .querySelectorAll('.lobby-grid-btn')
                .forEach((candidate) => candidate.classList.remove('selected'));
            btn.classList.add('selected');
            lobbyManager.setGridSize(newSize);
        });
    });

    const lobbyTimerSelect = document.getElementById('lobbyTurnTimer');
    if (lobbyTimerSelect) {
        let previousTimerValue = lobbyTimerSelect.value;
        lobbyTimerSelect.addEventListener('focus', () => {
            previousTimerValue = lobbyTimerSelect.value;
        });
        lobbyTimerSelect.addEventListener('change', async (event) => {
            const newValue = event.target.value;
            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updateTurnDuration(Number(newValue));
                if (result?.error) {
                    showToast('Error: ' + result.error, 'error');
                    lobbyTimerSelect.value = previousTimerValue;
                    return;
                }
                previousTimerValue = newValue;
            }
        });
    }

    const copyCodeBtn = document.getElementById('copyCodeBtn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            const code = document.getElementById('roomCode')?.textContent;
            if (code) {
                navigator.clipboard.writeText(code).then(() => {
                    copyCodeBtn.textContent = '✓';
                    copyCodeBtn.classList.add('copied');
                    showToast('Room code copied to clipboard!', 'success', 2000);
                    setTimeout(() => {
                        copyCodeBtn.textContent = '📋';
                        copyCodeBtn.classList.remove('copied');
                    }, 2000);
                });
            }
        });
    }

    const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
    if (copyInviteLinkBtn) {
        copyInviteLinkBtn.addEventListener('click', () => {
            const { lobbyManager } = getState();
            const inviteUrl = lobbyManager.buildInviteUrl
                ? lobbyManager.buildInviteUrl()
                : `${window.location.origin}/?join=${lobbyManager.roomCode}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(inviteUrl).then(() => {
                    copyInviteLinkBtn.textContent = '✓ Link Copied!';
                    showToast('Invite link copied!', 'success');
                    setTimeout(() => {
                        copyInviteLinkBtn.textContent = '🔗 Copy Invite Link';
                    }, 2000);
                });
            }
        });
    }

    // Allowed Time (free-form seconds input, host only). Debounced change
    // handler pushes to the server; the server validates (0-600, whole
    // numbers) and the next room snapshot re-renders the input.
    const turnDurationInput = document.getElementById('lobbyTurnDuration');
    if (turnDurationInput) {
        turnDurationInput.addEventListener('change', async () => {
            const { lobbyManager } = getState();
            if (!lobbyManager.isHost) return;

            const raw = turnDurationInput.value.trim();
            // Empty or 0 = no limit
            const seconds = raw === '' || parseInt(raw, 10) === 0 ? 0 : parseInt(raw, 10);

            if (raw !== '' && (!Number.isInteger(seconds) || seconds < 0)) {
                showToast('Allowed Time must be a whole number of seconds (0 = no limit)', 'error');
                turnDurationInput.value =
                    lobbyManager.turnDurationSeconds > 0
                        ? String(lobbyManager.turnDurationSeconds)
                        : '0';
                return;
            }

            if (turnDurationDebounceTimer) clearTimeout(turnDurationDebounceTimer);
            turnDurationDebounceTimer = setTimeout(async () => {
                if (window.ShapeKeeperConvex) {
                    const result = await window.ShapeKeeperConvex.updateTurnDuration(seconds);
                    if (result?.error) {
                        showToast('Error: ' + result.error, 'error');
                        return;
                    }
                    lobbyManager.turnDurationSeconds = seconds;
                    showToast(
                        seconds === 0 ? 'Turn timer disabled' : `Allowed Time set to ${seconds}s`,
                        'success'
                    );
                }
            }, 300);
        });
    }

    document.getElementById('playerName').addEventListener('input', (event) => {
        const { lobbyManager } = getState();
        const newName = event.target.value.trim() || 'Player';
        setStoredPlayerName(newName);
        lobbyManager.updateMyName(newName);
        updateLobbyUI();

        if (window.ShapeKeeperConvex) {
            if (playerUpdateDebounceTimer) clearTimeout(playerUpdateDebounceTimer);
            playerUpdateDebounceTimer = setTimeout(async () => {
                await window.ShapeKeeperConvex.updatePlayer({ name: newName });
            }, 250);
        }
    });

    document.getElementById('playerColor').addEventListener('input', (event) => {
        const { lobbyManager } = getState();
        const newColor = event.target.value;
        lobbyManager.updateMyColor(newColor);
        updateLobbyUI();

        if (window.ShapeKeeperConvex) {
            if (playerUpdateDebounceTimer) clearTimeout(playerUpdateDebounceTimer);
            playerUpdateDebounceTimer = setTimeout(async () => {
                await window.ShapeKeeperConvex.updatePlayer({ color: newColor });
            }, 250);
        }
    });

    document.getElementById('readyBtn').addEventListener('click', async () => {
        const { lobbyManager } = getState();
        const readyButton = document.getElementById('readyBtn');

        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.toggleReady();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            readyButton.textContent = result.isReady ? 'Ready ✓' : 'Ready';
            readyButton.classList.toggle('is-ready', result.isReady);
            readyButton.setAttribute('aria-pressed', String(result.isReady));
            return;
        }

        const isReady = lobbyManager.toggleReady();
        readyButton.textContent = isReady ? 'Ready ✓' : 'Ready';
        readyButton.classList.toggle('is-ready', isReady);
        readyButton.setAttribute('aria-pressed', String(isReady));
        updateLobbyUI();
    });
}
