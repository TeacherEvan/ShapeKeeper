/**
 * Lobby screen DOM rendering helpers.
 */

export function updateLobbyUI(lobbyManager) {
    document.getElementById('playerCount').textContent = lobbyManager.getPlayerCount();

    const playersList = document.getElementById('playersList');
    playersList.replaceChildren();

    lobbyManager.players.forEach((player) => {
        const entry = document.createElement('div');
        entry.className = 'player-entry';
        if (player.isReady) entry.classList.add('ready');
        if (player.isHost) entry.classList.add('host');

        const colorDot = document.createElement('div');
        colorDot.className = 'player-color-dot';
        colorDot.style.backgroundColor = player.color;

        const name = document.createElement('span');
        name.className = 'player-entry-name';
        name.textContent = player.name;

        entry.append(colorDot, name);

        if (player.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'host-badge';
            hostBadge.textContent = 'Host';
            entry.appendChild(hostBadge);
        }

        const status = document.createElement('span');
        status.className = 'player-entry-status';
        status.textContent = player.isReady ? '✓ Ready' : 'Not Ready';
        entry.appendChild(status);

        playersList.appendChild(entry);
    });

    const canStart = lobbyManager.canStartGame();
    document.getElementById('startMultiplayerGame').disabled = !canStart;

    const startHint = document.getElementById('lobbyStartHint');
    if (startHint) {
        if (canStart) {
            startHint.hidden = true;
            startHint.textContent = '';
        } else {
            const count = lobbyManager.players?.length || 0;
            if (!lobbyManager.isHost) {
                startHint.textContent = 'Waiting for the host to start the match.';
            } else if (count < 2) {
                startHint.textContent = 'Waiting for at least 2 players to join.';
            } else {
                startHint.textContent = 'Waiting for all players to mark Ready.';
            }
            startHint.hidden = false;
        }
    }

    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.disabled = !lobbyManager.isHost;
        btn.style.opacity = lobbyManager.isHost ? '1' : '0.5';
    });

    const lobbyTurnTimer = document.getElementById('lobbyTurnTimer');
    if (lobbyTurnTimer) {
        lobbyTurnTimer.disabled = !lobbyManager.isHost;
        const resolvedMs = Number.isFinite(lobbyManager.turnDurationMs)
            ? lobbyManager.turnDurationMs
            : Number.isFinite(lobbyManager.turnDurationSeconds)
              ? lobbyManager.turnDurationSeconds * 1000
              : 15000;
        lobbyTurnTimer.value = String(resolvedMs);
    }

    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.setAttribute('aria-pressed', String(Boolean(lobbyManager.isReady)));
    }

    const inviteBar = document.getElementById('lobbyInviteBar');
    const codeEl = document.getElementById('lobbyRoomCodeValue');
    const passcodeEl = document.getElementById('lobbyPasscodeValue');
    if (inviteBar && codeEl) {
        if (lobbyManager.roomCode) {
            inviteBar.hidden = false;
            codeEl.textContent = `Code: ${lobbyManager.roomCode}`;
            if (passcodeEl) {
                if (lobbyManager.passcode) {
                    passcodeEl.hidden = false;
                    passcodeEl.textContent = `Passcode: ${lobbyManager.passcode}`;
                } else {
                    passcodeEl.hidden = true;
                }
            }
        } else {
            inviteBar.hidden = true;
        }
    }
}
