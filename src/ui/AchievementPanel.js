import { ACHIEVEMENT_DEFINITIONS } from '../../achievement-system.js';
import { showToast } from './Toast.js';

const ACHIEVEMENT_LIST_ID = 'achievementsList';
const ACHIEVEMENT_BADGE_ID = 'achievementCountBadge';

function getListElement() {
    return document.getElementById(ACHIEVEMENT_LIST_ID);
}

function getCountBadge() {
    return document.getElementById(ACHIEVEMENT_BADGE_ID);
}

export function notifyAchievementUnlock(achievement) {
    if (!achievement) {
        return;
    }

    showToast(`Achievement unlocked: ${achievement.icon} ${achievement.title}`, 'success', 2800);
}

export function renderAchievementPanel(unlockedAchievements = []) {
    const list = getListElement();
    const badge = getCountBadge();
    if (!list || !badge) {
        return;
    }

    badge.textContent = `${unlockedAchievements.length}/${ACHIEVEMENT_DEFINITIONS.length}`;

    if (unlockedAchievements.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'achievement-empty';
        empty.textContent = 'No achievements unlocked yet.';
        list.replaceChildren(empty);
        return;
    }

    const items = unlockedAchievements.map((achievement) => {
        const item = document.createElement('li');
        item.className = 'achievement-item';

        const header = document.createElement('div');
        header.className = 'achievement-item-header';
        header.textContent = `${achievement.icon} ${achievement.title}`;

        const description = document.createElement('div');
        description.className = 'achievement-item-description';
        description.textContent = achievement.description;

        item.append(header, description);
        return item;
    });

    list.replaceChildren(...items);
}
