// js/streak.js

/**
 * Current date as a string in YYYY-MM-DD format.
 * @returns {string} The current date.
 */
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Gets the date of the day before a given date.
 * @param {string} dateString - A date string in YYYY-MM-DD format.
 * @returns {string} The previous day's date string.
 */
function getYesterdayString(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - 1);
    
    const prevYear = date.getUTCFullYear();
    const prevMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const prevDay = String(date.getUTCDate()).padStart(2, '0');
    return `${prevYear}-${prevMonth}-${prevDay}`;
}

/**
 * Updates the user's study streak.
 * This function can be safely called every time a card is reviewed.
 */
export async function updateStudyStreak() {
    const todayStr = getTodayString();
    
    const data = await chrome.storage.local.get({
        studyHistory: {
            lastStudyDay: null,
            currentStreak: 0,
            longestStreak: 0,
        }
    });

    const history = data.studyHistory;

    // If already studied today, do nothing.
    if (history.lastStudyDay === todayStr) {
        return;
    }

    const yesterdayStr = getYesterdayString(todayStr);

    if (history.lastStudyDay === yesterdayStr) {
        // Studied yesterday, the streak continues.
        history.currentStreak++;
    } else {
        // The streak was broken, reset to 1 for today's study.
        history.currentStreak = 1;
    }

    history.lastStudyDay = todayStr;

    // Update the longest streak if necessary.
    if (history.currentStreak > history.longestStreak) {
        history.longestStreak = history.currentStreak;
    }

    await chrome.storage.local.set({ studyHistory: history });
    console.log('Study streak updated:', history);
}

/**
 * Gets the study streak data.
 * @returns {Promise<{lastStudyDay: string|null, currentStreak: number, longestStreak: number}>}
 */
export async function getStudyStreak() {
    const data = await chrome.storage.local.get({
        studyHistory: {
            lastStudyDay: null,
            currentStreak: 0,
            longestStreak: 0,
        }
    });
    
    // If the last study day was not today or yesterday, the current streak is 0.
    const todayStr = getTodayString();
    const yesterdayStr = getYesterdayString(todayStr);
    if (data.studyHistory.lastStudyDay !== todayStr && data.studyHistory.lastStudyDay !== yesterdayStr) {
        data.studyHistory.currentStreak = 0;
    }

    return data.studyHistory;
}
