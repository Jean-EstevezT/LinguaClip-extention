import { getStudyStreak } from './streak.js';
import { applyTheme } from './utils.js';
import { showStatus, updateCards } from './options-helpers.js';

document.addEventListener('DOMContentLoaded', () => {
  const languageSelector = document.getElementById('language');
  const resetSrsBtn = document.getElementById('reset-srs-btn');
  const pomodoroWorkInput = document.getElementById('pomodoro-work');
  const pomodoroBreakInput = document.getElementById('pomodoro-break');
  const dailyLimitInput = document.getElementById('daily-limit');
  const cardListBody = document.getElementById('card-list-body');
  const importInput = document.getElementById('import-csv-input');
  const importBtn = document.getElementById('import-csv-btn');
  const themeSelector = document.getElementById('theme-selector');
  const deleteAllBtn = document.getElementById('delete-all-btn');

  // Listen for OS theme changes to update in real-time
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // Only re-apply the theme if the selected option is "system"
    if (themeSelector.value === 'system') {
      applyTheme('system');
    }
  });

  // Save options to chrome.storage
  function saveOptions() {
    const language = languageSelector.value;
    const workDuration = parseInt(pomodoroWorkInput.value, 10);
    const breakDuration = parseInt(pomodoroBreakInput.value, 10);
    const dailyLimit = parseInt(dailyLimitInput.value, 10);
    const theme = themeSelector.value;
    chrome.storage.local.set(
      { targetLanguage: language, pomodoroWork: workDuration, pomodoroBreak: breakDuration, dailyStudyLimit: dailyLimit, theme: theme },
      () => {
        showStatus('Opciones guardadas.', 1500);
      }
    );
  }

  // Load options from chrome.storage
  function restoreOptions() {
    chrome.storage.local.get({ targetLanguage: 'es', pomodoroWork: 25, pomodoroBreak: 5, dailyStudyLimit: 20, theme: 'system' }, (items) => {
      languageSelector.value = items.targetLanguage;
      pomodoroWorkInput.value = items.pomodoroWork;
      pomodoroBreakInput.value = items.pomodoroBreak;
      dailyLimitInput.value = items.dailyStudyLimit;
      themeSelector.value = items.theme;
      applyTheme(items.theme);
    });
  }

  /**
   * Loads and displays the study streak data on the page.
   */
  async function displayStreaks() {
      const currentStreakEl = document.getElementById('current-streak');
      const longestStreakEl = document.getElementById('longest-streak');

      if (!currentStreakEl || !longestStreakEl) {
          console.error("Streak elements not found in the DOM.");
          return;
      }

      try {
          const streakData = await getStudyStreak();
          currentStreakEl.textContent = streakData.currentStreak;
          longestStreakEl.textContent = streakData.longestStreak;
      } catch (error) {
          console.error("Error loading study streak:", error);
          currentStreakEl.textContent = '-';
          longestStreakEl.textContent = '-';
      }
  }

  // Load and display stats and chart
  function renderStats() {
    chrome.storage.local.get({ selecciones: [] }, (result) => {
        const cards = result.selecciones;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // --- Text Statistics ---
        const totalCards = cards.length;
        const dueTodayCount = cards.filter(c => new Date(c.due) <= now).length;
        const matureCount = cards.filter(c => c.stability >= 21).length; // "Learned" cards

        document.getElementById('total-cards').textContent = totalCards;
        document.getElementById('due-today').textContent = dueTodayCount;
        document.getElementById('mature-cards').textContent = matureCount;

        // --- Statistics for the chart (7-day forecast) ---
        const forecast = Array(7).fill(0);
        const labels = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            labels.push(date.toLocaleDateString(navigator.language, { weekday: 'short', day: 'numeric' }));
        }

        cards.forEach(card => {
            const dueDate = new Date(card.due);
            const diffTime = dueDate - today;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
                forecast[diffDays]++;
            }
        });

        // --- Render Chart ---
        const ctx = document.getElementById('forecast-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tarjetas a revisar',
                    data: forecast,
                    backgroundColor: 'rgba(38, 139, 210, 0.6)',
                    borderColor: 'rgba(38, 139, 210, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                },
                plugins: { legend: { display: false } }
            }
        });
    });
  }

  // Display the list of cards to manage them
  function renderCardList() {
    chrome.storage.local.get({ selecciones: [] }, (result) => {
      const cards = result.selecciones;
      const fragment = document.createDocumentFragment();
      
      if (cards.length === 0) {
        const row = cardListBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = 'No hay tarjetas guardadas.';
        cell.style.textAlign = 'center';
        return;
      }

      cards.forEach((card, index) => {
        const row = document.createElement('tr');
        row.insertCell().textContent = card.original;
        row.insertCell().textContent = card.traduccion;

        const dictCell = row.insertCell();
        dictCell.className = 'card-actions';

        const googleBtn = document.createElement('button');
        googleBtn.textContent = 'G';
        googleBtn.title = 'Buscar en Google Translate';
        googleBtn.onclick = () => openDictionary('google', card.traduccion);

        const wrBtn = document.createElement('button');
        wrBtn.textContent = 'WR';
        wrBtn.title = 'Buscar en WordReference';
        wrBtn.onclick = () => openDictionary('wordreference', card.traduccion, card.sourceLang);

        dictCell.appendChild(googleBtn);
        dictCell.appendChild(wrBtn);

        const actionsCell = row.insertCell();
        actionsCell.className = 'card-actions';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar'; 
        editBtn.onclick = () => handleEdit(index, row, cards);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.onclick = () => handleDelete(index, cards);

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
        
        fragment.appendChild(row);
      });

      cardListBody.innerHTML = ''; // Clear the DOM once
      cardListBody.appendChild(fragment); // Add everything at once
    });
  }

  function handleEdit(index, row) {
    const originalCell = row.cells[0];
    const translationCell = row.cells[1];
    const actionsCell = row.cells[3];

    originalCell.innerHTML = `<input type="text" value="${originalCell.textContent}" style="width: 95%;">`;
    translationCell.innerHTML = `<input type="text" value="${translationCell.textContent}" style="width: 95%;">`;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Guardar'; 
    saveBtn.onclick = () => handleSave(index, row);

    actionsCell.innerHTML = '';
    actionsCell.appendChild(saveBtn);
  }

  async function handleSave(index, row) {
    const newOriginal = row.cells[0].querySelector('input').value;
    const newTranslation = row.cells[1].querySelector('input').value;

    await updateCards(cards => {
      cards[index].original = newOriginal;
      cards[index].traduccion = newTranslation;
      return cards;
    });
    showStatus('Tarjeta actualizada.', 1500);
    renderCardList();
  }

  async function handleDelete(indexToDelete) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarjeta?')) return;
    await updateCards(cards => cards.filter((_, index) => index !== indexToDelete));
    showStatus('Tarjeta eliminada.');
    renderCardList();
    renderStats();
  }

  // Handles CSV file import
  async function handleImport() {
    const file = importInput.files[0];
    if (!file) {
      showStatus('Por favor, selecciona un archivo CSV.', 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target.result;
        const rows = csv.split('\n').filter(row => row.trim() !== '');

        const hasHeader = /original|traducción/i.test(rows[0]);
        const dataRows = hasHeader ? rows.slice(1) : rows;

        const newCards = dataRows.map(row => {
          const columns = row.split(';');
          if (columns.length < 2 || !columns[0] || !columns[1]) return null;
          return {
            original: columns[0].trim().replace(/^"|"$/g, ''),
            traduccion: columns[1].trim().replace(/^"|"$/g, ''),
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0.5,
            sourceLang: 'csv'
          };
        }).filter(Boolean);

        if (newCards.length === 0) {
          showStatus('No se encontraron tarjetas válidas para importar.', 3000);
          return;
        }

        await updateCards(cards => cards.concat(newCards));
        showStatus(`${newCards.length} tarjeta(s) importada(s).`);
        renderCardList();
        renderStats();
        importInput.value = ''; // Clear the input

      } catch (error) {
        console.error("Error importing CSV:", error);
        alert("Ocurrió un error al procesar el archivo.");
      }
    };
    reader.readAsText(file);
  }

  async function openDictionary(service, word, sourceLang) {
    const encodedWord = encodeURIComponent(word);
    let url;

    if (service === 'google') {
        const { targetLanguage } = await chrome.storage.local.get({ targetLanguage: 'es' });
        url = `https://translate.google.com/?sl=auto&tl=${targetLanguage}&text=${encodedWord}&op=translate`;
    } else if (service === 'wordreference') {
        const { targetLanguage } = await chrome.storage.local.get({ targetLanguage: 'es' });
        // Default to 'en' if source language is unknown or auto-detected
        const fromLang = sourceLang && !['auto', 'csv'].includes(sourceLang) ? sourceLang : 'en';
        const toLang = targetLanguage;
        // WordReference uses pairs like 'enes' for English-Spanish
        url = `https://www.wordreference.com/${fromLang}${toLang}/${encodedWord}`;
    }

    if (url) {
        chrome.tabs.create({ url });
    }
  }

  // Load options on page open
  restoreOptions();
  renderStats();
  renderCardList();
  displayStreaks();
  // Save on change
  languageSelector.addEventListener('change', saveOptions);
  pomodoroWorkInput.addEventListener('change', saveOptions);
  pomodoroBreakInput.addEventListener('change', saveOptions);
  dailyLimitInput.addEventListener('change', saveOptions);
  themeSelector.addEventListener('change', () => {
    // Apply theme immediately on change
    applyTheme(themeSelector.value);
    saveOptions();
  });
  importBtn.addEventListener('click', handleImport);
  deleteAllBtn.addEventListener('click', handleDeleteAll);

  // Reset SRS progress
  resetSrsBtn.addEventListener('click', async () => {
    const confirmReset = confirm('¿Estás seguro de que quieres reiniciar todo el progreso de estudio?');
    if (confirmReset) {
      await updateCards(cards => cards.map(s => ({
          ...s, 
          due: new Date().toISOString(),
          stability: 0,
          difficulty: 0.5,
      })));
      showStatus('Progreso de estudio reiniciado.');
      renderStats(); // Refresh stats
    }
  });

  // Delete all cards
  async function handleDeleteAll() {
    if (!confirm('¿Estás seguro de que quieres eliminar TODAS las tarjetas? Esta acción no se puede deshacer.')) return;
    
    await chrome.storage.local.set({ selecciones: [] });
    showStatus('Todas las tarjetas han sido eliminadas.');
    renderCardList();
    renderStats();
  }
});
