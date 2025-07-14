/**
 * Shows a status message for a limited time.
 * @param {string} message The message to display.
 * @param {number} [duration=2000] Time in ms to show the message.
 */
export function showStatus(message, duration = 2000) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    setTimeout(() => {
      statusDiv.textContent = '';
    }, duration);
  }
}

/**
 * A generic function to update the cards in storage.
 * @param {function(Array): Array} updateFunction A function that takes the current cards array and returns the updated array.
 * @returns {Promise<void>}
 */
export async function updateCards(updateFunction) {
  const { selecciones } = await chrome.storage.local.get({ selecciones: [] });
  const updatedCards = updateFunction(selecciones);
  await chrome.storage.local.set({ selecciones: updatedCards });
}