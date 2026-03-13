const pendingAnnouncements = new Map();

function scheduleAnnouncement(regionId, message) {
    const region = document.getElementById(regionId);
    const normalizedMessage = `${message || ''}`.trim();

    if (!region || !normalizedMessage) {
        return;
    }

    const existingTimeout = pendingAnnouncements.get(regionId);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    region.textContent = '';

    const timeoutId = window.setTimeout(() => {
        region.textContent = normalizedMessage;
        pendingAnnouncements.delete(regionId);
    }, 30);

    pendingAnnouncements.set(regionId, timeoutId);
}

export function announceStatus(message) {
    scheduleAnnouncement('appLiveRegion', message);
}

export function announceAlert(message) {
    scheduleAnnouncement('appAlertRegion', message);
}
