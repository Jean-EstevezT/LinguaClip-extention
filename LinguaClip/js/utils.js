/**
 * Applies a theme to the document body by setting the 'data-theme' attribute.
 * Handles 'system' theme by checking user's OS preference.
 * @param {string} theme - The theme to apply ('system', 'dark', 'cozy-light').
 */
export function applyTheme(theme) {
    if (theme === 'system') {
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = systemIsDark ? 'dark' : 'cozy-light';
    } else {
        document.body.dataset.theme = theme;
    }
}