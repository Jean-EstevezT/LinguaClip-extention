import { applyTheme } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const selectionList = document.getElementById('selection-list');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  const emptyMessage = document.getElementById('empty-message');
  const controlsContainer = document.getElementById('controls');
  const openOptionsLink = document.getElementById('open-options-link');
  const exportCSVLink = document.getElementById('export-csv-link');
  const startStudyButton = document.getElementById('start-study-btn');

  // --- Helper Functions ---

  /**
   * Sanitizes HTML to prevent XSS.
   * @param {string} str The string to escape.
   * @returns {string} The escaped string.
   */
  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  /**
   * Toggles the visibility of UI elements based on whether there are cards.
   * @param {boolean} hasSelections - True if there are selections to display.
   */
  function updateUIState(hasSelections) {
    emptyMessage.style.display = hasSelections ? 'none' : 'block';
    controlsContainer.style.display = hasSelections ? 'flex' : 'none';
    startStudyButton.disabled = !hasSelections;
  }

  /**
   * Renders the last 5 selections in the popup list.
   * @param {Array} allSelections - The array of all saved selections.
   */
  function loadSelections(allSelections) {
    selectionList.innerHTML = '';
    updateUIState(allSelections.length > 0);

    if (allSelections.length > 0) {
      const startIndex = Math.max(0, allSelections.length - 5);
      const lastFive = allSelections.slice(startIndex).reverse();

      lastFive.forEach((selection, relativeIndex) => {
        const originalIndex = allSelections.length - 1 - relativeIndex;
        const itemHTML = `
          <li>
            <input type="checkbox" data-index="${originalIndex}">
            <div class="selection-content">
              <span class="original">${escapeHTML(selection.original)}</span>
              <span class="translation">${escapeHTML(selection.traduccion)}</span>
            </div>
          </li>
        `;
        selectionList.insertAdjacentHTML('beforeend', itemHTML);
      });
    }
  }

  /**
   * Exports all saved selections to a CSV file.
   */
  async function exportToCSV() {
    const { selecciones } = await chrome.storage.local.get({ selecciones: [] });

    if (selecciones.length === 0) {
      alert('No hay nada para exportar.');
      return;
    }

    const csvHeader = 'Original;Traducción\n';
    const csvRows = selecciones.map(s => {
      const original = `"${(s.original || '').replace(/"/g, '""')}"`;
      const traduccion = `"${(s.traduccion || '').replace(/"/g, '""')}"`;
      return `${original};${traduccion}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'linguaclip_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Deletes the currently checked selections from storage.
   */
  async function deleteSelected() {
    const checkedCheckboxes = document.querySelectorAll('#selection-list input[type="checkbox"]:checked');
    if (checkedCheckboxes.length === 0) {
      alert('Por favor, selecciona al menos un elemento para eliminar.');
      return;
    }

    const indicesToDelete = new Set(Array.from(checkedCheckboxes).map(cb => parseInt(cb.dataset.index, 10)));

    const { selecciones } = await chrome.storage.local.get({ selecciones: [] });
    const newSelections = selecciones.filter((_, index) => !indicesToDelete.has(index));
    
    await chrome.storage.local.set({ selecciones: newSelections });
    console.log('Selections deleted.');
    loadSelections(newSelections);
  }

  /**
   * Loads initial data and sets up the popup.
   */
  async function initialLoad() {
    const { theme = 'system', selecciones = [] } = await chrome.storage.local.get(['theme', 'selecciones']);
    applyTheme(theme);
    loadSelections(selecciones);
  }

  // --- Event Listeners ---
  deleteSelectedBtn.addEventListener('click', deleteSelected);

  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  exportCSVLink.addEventListener('click', (e) => {
    e.preventDefault();
    exportToCSV();
  });

  startStudyButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'study.html' });
  });

  // --- Initial Load ---
  initialLoad();
});
