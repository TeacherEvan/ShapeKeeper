/**
 * Lobby screen DOM rendering helpers.
 */

export function updateLobbyUI(lobbyManager) {
    document.getElementById('roomCode').textContent = lobbyManager.roomCode || '------';

    // Show the passcode section ONLY when a passcode has been generated.
    // Legacy rooms and unfinished bootstraps hide it.
    const passcodeSection = document.getElementById('lobbyPasscodeSection');
    const passcodeEl = document.getElementById('roomPasscode');
    if (passcodeSection && passcodeEl) {
        if (lobbyManager.passcode) {
            passcodeSection.hidden = false;
            passcodeEl.textContent = lobbyManager.passcode;
        } else {
            passcodeSection.hidden = true;
            passcodeEl.textContent = '------';
        }
    }

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

    document.getElementById('startMultiplayerGame').disabled = !lobbyManager.canStartGame();

    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.disabled = !lobbyManager.isHost;
        btn.style.opacity = lobbyManager.isHost ? '1' : '0.5';
    });

    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.setAttribute('aria-pressed', String(Boolean(lobbyManager.isReady)));
    }
}
